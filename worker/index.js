/* Servidor de avisos (Cloudflare Worker + D1).
   La app le envía los próximos recordatorios; cada minuto el Worker revisa cuáles ya tocan
   y los entrega como notificaciones push (Web Push cifrado + VAPID), aunque la app esté cerrada.
   Las claves VAPID se generan solas la primera vez y se guardan en D1: no hay que configurar secretos. */

const DAY = 86400000;
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)windows\.com$/, /(^|\.)mozaws\.net$/];
const enc = new TextEncoder();

/* ---------- utilidades ---------- */
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0)),
};
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

/* ---------- base de datos ---------- */
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, subscription TEXT NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS reminders (id TEXT NOT NULL, device TEXT NOT NULL, fire_at INTEGER NOT NULL, title TEXT, body TEXT, tag TEXT, attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (device, id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_fire ON reminders (fire_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)"),
  ]);
  schemaReady = true;
}

/* ---------- claves VAPID (se crean solas) ---------- */
let cachedKeys = null;
async function getKeys(db) {
  if (cachedKeys) return cachedKeys;
  const row = await db.prepare("SELECT v FROM kv WHERE k = 'vapid'").first();
  let jwk;
  if (row) jwk = JSON.parse(row.v);
  else {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    await db.prepare("INSERT OR IGNORE INTO kv (k, v) VALUES ('vapid', ?1)").bind(JSON.stringify(jwk)).run();
  }
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const publicRaw = concat(new Uint8Array([4]), b64u.dec(jwk.x), b64u.dec(jwk.y));
  cachedKeys = { privateKey, publicB64: b64u.enc(publicRaw) };
  return cachedKeys;
}

async function vapidHeader(keys, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.enc(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u.enc(sig)}, k=${keys.publicB64}`;
}

/* ---------- cifrado del mensaje (RFC 8291, aes128gcm) ---------- */
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

async function encryptPayload(subscription, plaintext, opts = {}) {
  const uaPublic = b64u.dec(subscription.keys.p256dh);
  const authSecret = b64u.dec(subscription.keys.auth);
  const asPair = opts.asKeyPair || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asPair.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPair.privateKey, 256));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = concat(plaintext, new Uint8Array([2])); // 0x02 = último (y único) bloque
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, data));
  const rs = new Uint8Array([0, 0, 16, 0]); // tamaño de bloque 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function sendPush(env, keys, subscription, payload) {
  const body = await encryptPayload(subscription, enc.encode(JSON.stringify(payload)));
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(keys, subscription.endpoint, env.VAPID_SUBJECT || "mailto:admin@example.com"),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
}

/* ---------- entrega (cada minuto) ---------- */
async function deliver(env) {
  const db = env.DB;
  await ensureSchema(db);
  const keys = await getKeys(db);
  const now = Date.now();
  await db.prepare("DELETE FROM reminders WHERE fire_at < ?1").bind(now - DAY).run();
  await db.prepare("DELETE FROM devices WHERE updated_at < ?1").bind(now - 90 * DAY).run();
  const { results } = await db.prepare(
    "SELECT r.id, r.device, r.title, r.body, r.tag, r.attempts, d.subscription FROM reminders r JOIN devices d ON d.id = r.device WHERE r.fire_at <= ?1 ORDER BY r.fire_at LIMIT 40"
  ).bind(now).all();
  let sent = 0;
  for (const r of results) {
    let status = 0;
    try {
      const res = await sendPush(env, keys, JSON.parse(r.subscription), { title: r.title, body: r.body, tag: r.tag });
      status = res.status;
    } catch { status = 599; }
    if (status >= 200 && status < 300) { sent++; await db.prepare("DELETE FROM reminders WHERE device = ?1 AND id = ?2").bind(r.device, r.id).run(); }
    else if (status === 404 || status === 410) { // el dispositivo ya no existe
      await db.batch([db.prepare("DELETE FROM reminders WHERE device = ?1").bind(r.device), db.prepare("DELETE FROM devices WHERE id = ?1").bind(r.device)]);
    } else if (r.attempts >= 4) await db.prepare("DELETE FROM reminders WHERE device = ?1 AND id = ?2").bind(r.device, r.id).run();
    else await db.prepare("UPDATE reminders SET attempts = attempts + 1 WHERE device = ?1 AND id = ?2").bind(r.device, r.id).run();
  }
  return sent;
}

/* ---------- API para la app ---------- */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
const str = (v, max) => typeof v === "string" && v.length <= max;

function validSubscription(sub, env) {
  try {
    const u = new URL(sub.endpoint);
    const hostOk = env.ALLOW_ANY_PUSH_HOST === "1" || PUSH_HOSTS.some((re) => re.test(u.hostname));
    return u.protocol === "https:" && hostOk && str(sub.keys?.p256dh, 200) && str(sub.keys?.auth, 100);
  } catch { return false; }
}

async function handleSync(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const { device, subscription, items } = body || {};
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(device || "")) return json({ error: "device inválido" }, 400);
  if (!validSubscription(subscription, env)) return json({ error: "suscripción inválida" }, 400);
  if (!Array.isArray(items) || items.length > 300) return json({ error: "items inválidos" }, 400);
  const now = Date.now();
  const rows = [];
  for (const it of items) {
    if (!str(it.id, 80) || !Number.isFinite(it.fireAt) || it.fireAt < now - 5 * 60000 || it.fireAt > now + 31 * DAY ||
        !str(it.title, 200) || !str(it.body, 200) || !str(it.tag, 120)) return json({ error: "item inválido" }, 400);
    rows.push(it);
  }
  const db = env.DB;
  await ensureSchema(db);
  await db.batch([
    db.prepare("INSERT INTO devices (id, subscription, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET subscription = ?2, updated_at = ?3").bind(device, JSON.stringify(subscription), now),
    db.prepare("DELETE FROM reminders WHERE device = ?1").bind(device),
    ...rows.map((it) => db.prepare("INSERT OR REPLACE INTO reminders (id, device, fire_at, title, body, tag) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(it.id, device, it.fireAt, it.title, it.body, it.tag)),
  ]);
  return json({ ok: true, count: rows.length });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    try {
      await ensureSchema(env.DB);
      if (pathname === "/vapid" && request.method === "GET") return json({ publicKey: (await getKeys(env.DB)).publicB64 });
      if (pathname === "/sync" && request.method === "PUT") return await handleSync(request, env);
      if (pathname === "/unsync" && request.method === "POST") {
        const { device } = await request.json().catch(() => ({}));
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(device || "")) return json({ error: "device inválido" }, 400);
        await env.DB.batch([env.DB.prepare("DELETE FROM reminders WHERE device = ?1").bind(device), env.DB.prepare("DELETE FROM devices WHERE id = ?1").bind(device)]);
        return json({ ok: true });
      }
      if (pathname === "/") return new Response("Servidor de avisos funcionando ✓", { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
      return json({ error: "no encontrado" }, 404);
    } catch (err) {
      return json({ error: "error interno", detail: String(err && err.message || err) }, 500);
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(deliver(env)); },
  _test: { encryptPayload, vapidHeader, getKeys, deliver, b64u },
};
