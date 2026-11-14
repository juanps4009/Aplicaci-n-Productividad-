/* Servidor de avisos (Cloudflare Worker + D1).
   La app le envía los próximos recordatorios; cada minuto el Worker revisa cuáles ya tocan
   y los entrega como notificaciones push (Web Push cifrado + VAPID), aunque la app esté cerrada.
   Las claves VAPID se generan solas la primera vez y se guardan en D1: no hay que configurar secretos. */

const DAY = 86400000;
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)windows\.com$/, /(^|\.)mozaws\.net$/];
const enc = new TextEncoder();

/* Límites para que un servicio abierto y gratuito no se agote (por código / dispositivo / IP) */
const LIMITS = {
  recordChars: 200000,        // tamaño máximo de un registro cifrado
  recordsPerSpace: 3000,      // tareas + resúmenes por código
  bytesPerSpace: 3000000,     // ~3 MB por código
  maxSpaces: 20000,           // códigos en total
  maxDevices: 20000,          // dispositivos con avisos en total
  ipPerMinute: 120,           // peticiones por minuto por IP (varias personas pueden compartir red)
  spacePerMinute: 40,         // peticiones por minuto por código (en cada isolate del Worker)
};
const hits = new Map();
function tooMany(key, max) {
  const minute = Math.floor(Date.now() / 60000);
  const h = hits.get(key);
  if (!h || h.minute !== minute) { hits.set(key, { minute, n: 1 }); if (hits.size > 5000) hits.clear(); return false; }
  return ++h.n > max;
}

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
    db.prepare("CREATE TABLE IF NOT EXISTS spaces (space TEXT PRIMARY KEY, created_at INTEGER NOT NULL, touched_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS records (space TEXT NOT NULL, id TEXT NOT NULL, col TEXT NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '', seq INTEGER NOT NULL, PRIMARY KEY (space, id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_records_seq ON records (space, seq)"),
    // Llamadas y mensajes con Claude (ver «Llamadas» más abajo)
    db.prepare("CREATE TABLE IF NOT EXISTS call_devices (space TEXT NOT NULL, device TEXT NOT NULL, fcm TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (space, device))"),
    db.prepare("CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, space TEXT NOT NULL, dir TEXT NOT NULL, state TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0, invite TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_calls_space ON calls (space, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS messages (space TEXT NOT NULL, id TEXT NOT NULL, seq INTEGER NOT NULL, sender TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (space, id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages (space, seq)"),
    db.prepare("CREATE TABLE IF NOT EXISTS quota (space TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (space, day, kind))"),
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
  await db.prepare("DELETE FROM records WHERE deleted = 1 AND updated_at < ?1").bind(now - 60 * DAY).run();
  await db.prepare("DELETE FROM records WHERE space IN (SELECT space FROM spaces WHERE touched_at < ?1)").bind(now - 180 * DAY).run();
  await db.prepare("DELETE FROM spaces WHERE touched_at < ?1").bind(now - 180 * DAY).run();
  await expireCalls(env, now);
  await db.prepare("DELETE FROM calls WHERE created_at < ?1").bind(now - 30 * DAY).run();
  await db.prepare("DELETE FROM messages WHERE created_at < ?1").bind(now - 180 * DAY).run();
  await db.prepare("DELETE FROM quota WHERE day < ?1").bind(dayKey(now - 3 * DAY)).run();
  await db.prepare("DELETE FROM call_devices WHERE updated_at < ?1").bind(now - 90 * DAY).run();
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
        !str(it.title, 800) || !str(it.body, 800) || !str(it.tag, 120)) return json({ error: "item inválido" }, 400);
    rows.push(it);
  }
  const db = env.DB;
  await ensureSchema(db);
  const known = await db.prepare("SELECT 1 AS x FROM devices WHERE id = ?1").bind(device).first();
  if (!known) {
    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM devices").first();
    if (n >= LIMITS.maxDevices) return json({ error: "servicio lleno" }, 503);
  }
  await db.batch([
    db.prepare("INSERT INTO devices (id, subscription, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET subscription = ?2, updated_at = ?3").bind(device, JSON.stringify(subscription), now),
    db.prepare("DELETE FROM reminders WHERE device = ?1").bind(device),
    ...rows.map((it) => db.prepare("INSERT OR REPLACE INTO reminders (id, device, fire_at, title, body, tag) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(it.id, device, it.fireAt, it.title, it.body, it.tag)),
  ]);
  return json({ ok: true, count: rows.length });
}

/* ---------- Sincronización entre dispositivos (espacio = hash del código) ---------- */
const SEQ_NEXT = "(SELECT COALESCE(MAX(seq), 0) + 1 FROM records WHERE space = ?1)";

async function handleSpaceSync(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const { space, since, records } = body || {};
  if (!/^[0-9a-f]{64}$/.test(space || "")) return json({ error: "space inválido" }, 400);
  if (!Number.isInteger(since) || since < 0) return json({ error: "since inválido" }, 400);
  if (!Array.isArray(records) || records.length > 100) return json({ error: "records inválidos" }, 400);
  if (tooMany("space:" + space, LIMITS.spacePerMinute)) return json({ error: "demasiadas peticiones" }, 429);
  const now = Date.now();
  for (const r of records) {
    const ok = r && str(r.id, 80) && r.id.length > 0 && (r.col === "tasks" || r.col === "books") &&
      Number.isFinite(r.updatedAt) && r.updatedAt > 0 && r.updatedAt <= now + DAY &&
      (r.deleted === 0 || r.deleted === 1) && str(r.data, LIMITS.recordChars);
    if (!ok) return json({ error: "registro inválido" }, 400);
  }
  const db = env.DB;
  if (records.length) {
    const used = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM records WHERE space = ?1").bind(space).first();
    const incoming = records.reduce((sum, r) => sum + r.data.length, 0);
    if (used.n + records.length > LIMITS.recordsPerSpace || used.bytes + incoming > LIMITS.bytesPerSpace * 1.5) {
      return json({ error: "espacio lleno" }, 413);
    }
    if (used.n === 0) { // espacio nuevo: tope global
      const { s } = await db.prepare("SELECT COUNT(*) AS s FROM spaces").first();
      if (s >= LIMITS.maxSpaces) return json({ error: "servicio lleno" }, 503);
    }
    await db.batch([
      db.prepare("INSERT INTO spaces (space, created_at, touched_at) VALUES (?1, ?2, ?2) ON CONFLICT(space) DO UPDATE SET touched_at = ?2").bind(space, now),
      ...records.map((r) => db.prepare(
        `INSERT INTO records (space, id, col, updated_at, deleted, data, seq) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ${SEQ_NEXT})
         ON CONFLICT(space, id) DO UPDATE SET col = ?3, updated_at = ?4, deleted = ?5, data = ?6, seq = ${SEQ_NEXT}
         WHERE excluded.updated_at >= records.updated_at`
      ).bind(space, r.id, r.col, r.updatedAt, r.deleted, r.data)),
    ]);
  } else {
    await db.prepare("UPDATE spaces SET touched_at = ?2 WHERE space = ?1").bind(space, now).run();
  }
  const { results } = await db.prepare(
    "SELECT id, col, updated_at, deleted, data, seq FROM records WHERE space = ?1 AND seq > ?2 ORDER BY seq LIMIT 501"
  ).bind(space, since).all();
  const more = results.length > 500;
  const page = more ? results.slice(0, 500) : results;
  return json({
    records: page.map((r) => ({ id: r.id, col: r.col, updatedAt: r.updated_at, deleted: r.deleted, data: r.data })),
    seq: page.length ? page[page.length - 1].seq : since,
    more,
  });
}

async function handleSpaceDelete(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  if (!/^[0-9a-f]{64}$/.test(body && body.space || "")) return json({ error: "space inválido" }, 400);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM records WHERE space = ?1").bind(body.space),
    env.DB.prepare("DELETE FROM spaces WHERE space = ?1").bind(body.space),
    env.DB.prepare("DELETE FROM calls WHERE space = ?1").bind(body.space),
    env.DB.prepare("DELETE FROM messages WHERE space = ?1").bind(body.space),
    env.DB.prepare("DELETE FROM call_devices WHERE space = ?1").bind(body.space),
    env.DB.prepare("DELETE FROM quota WHERE space = ?1").bind(body.space),
  ]);
  return json({ ok: true });
}

/* ---------- Llamadas y mensajes con Claude ----------
   Idea tomada de agentring (github.com/mutonby/agentring, Apache-2.0) y rehecha para este servidor gratuito:
   - Claude (herramientas/llamar.mjs) crea una llamada; el servidor despierta el celular con un aviso de Firebase (FCM)
     de alta prioridad que solo lleva el id. El celular suena, pide los datos, contesta y habla DIRECTAMENTE con
     Gemini Live usando un token temporal que le da este servidor (la clave de Gemini nunca sale de aquí).
   - Al colgar, el celular guarda la transcripción en la llamada y Claude la lee.
   - Sin contestar en 40 s → «perdida» y queda como mensaje. Desde el celular también se puede llamar: lo que se pida
     para Claude queda como mensaje «encargo» que la próxima tarea programada atiende.
   Todo el contenido (motivo, contexto, transcripción, mensajes) llega cifrado con la clave del código de
   sincronización (formato «e1:» de sync.js): el servidor solo ve ids, estados y horas.
   Secretos del Worker (opcionales; sin ellos las llamadas responden «no configurado»):
     FCM_SERVICE_ACCOUNT  JSON de la cuenta de servicio de Firebase (privado)
     FCM_GOOGLE_SERVICES  contenido de google-services.json (público; el widget lo pide en /call/config)
     GEMINI_API_KEY       clave de Google AI Studio
     ROUTINE_FIRE_URL / ROUTINE_FIRE_TOKEN  (opcional) disparador por API de la rutina de Claude que atiende los
                          encargos: al guardar un encargo del dueño el servidor la dispara al instante (ver fireRoutine)
     GEMINI_LIVE_MODEL / GEMINI_VOICE  (opcional) modelo y voz de Gemini Live */
const CALL = {
  ringMs: 40000,               // sin contestar → perdida
  maxMs: 20 * 60000,           // una llamada abierta se cierra sola
  perDay: { call: 20, voice: 30, msg: 300, fire: 24 },
  fireCooldownMs: 3 * 60000,   // como mucho un disparo de Claude cada 3 minutos por código
  fireText: "Hay un encargo nuevo en la app de Pendientes. Atiéndelo con node herramientas/llamar.mjs encargos.",
  devicesPerSpace: 5,
  inviteChars: 20000, resultChars: 200000, msgChars: 20000,
  liveModel: "gemini-3.8-live", voice: "Charon",
  liveUrl: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained",
};
const NEXT_STATES = {
  invited: ["ringing", "active", "declined", "missed", "ended"],
  ringing: ["ringing", "active", "declined", "missed", "ended"],
  active: ["active", "ended"],
};
const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const MSG_SEQ_NEXT = "(SELECT COALESCE(MAX(seq), 0) + 1 FROM messages WHERE space = ?1)";

async function useQuota(db, space, kind, now) {
  const day = dayKey(now);
  const row = await db.prepare("SELECT n FROM quota WHERE space = ?1 AND day = ?2 AND kind = ?3").bind(space, day, kind).first();
  if (row && row.n >= CALL.perDay[kind]) return false;
  await db.prepare("INSERT INTO quota (space, day, kind, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(space, day, kind) DO UPDATE SET n = n + 1").bind(space, day, kind).run();
  return true;
}

/* Llamadas sin contestar → perdidas (y un mensaje con el motivo); abiertas demasiado tiempo → terminadas */
async function expireCalls(env, now) {
  const db = env.DB;
  const { results } = await db.prepare("SELECT id, space, dir, invite FROM calls WHERE state IN ('invited', 'ringing') AND created_at < ?1 LIMIT 100").bind(now - CALL.ringMs).all();
  for (const c of results) {
    const stmts = [db.prepare("UPDATE calls SET state = 'missed', updated_at = ?2 WHERE id = ?1 AND state IN ('invited', 'ringing')").bind(c.id, now)];
    if (c.dir === "out") stmts.push(db.prepare(`INSERT OR IGNORE INTO messages (space, id, seq, sender, kind, ref, data, created_at) VALUES (?1, ?2, ${MSG_SEQ_NEXT}, 'claude', 'missed', ?3, ?4, ?5)`).bind(c.space, "x" + c.id, c.id, c.invite, now));
    await db.batch(stmts);
  }
  await db.prepare("UPDATE calls SET state = 'ended', updated_at = ?1 WHERE state = 'active' AND updated_at < ?2").bind(now, now - CALL.maxMs).run();
}

/* Firebase Cloud Messaging (HTTP v1): token OAuth firmado con la cuenta de servicio (RS256, WebCrypto) */
let fcmAuth = null;
async function fcmAccessToken(env, sa) {
  if (fcmAuth && fcmAuth.email === sa.client_email && fcmAuth.exp > Date.now() + 60000) return fcmAuth.token;
  const pem = String(sa.private_key || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u.enc(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64u.enc(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud, iat, exp: iat + 3600 })));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${claims}`));
  const res = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${claims}.${b64u.enc(sig)}`,
  });
  if (!res.ok) throw new Error("Firebase no aceptó la cuenta de servicio (" + res.status + ")");
  const j = await res.json();
  fcmAuth = { email: sa.client_email, token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmAuth.token;
}

async function fcmSend(env, space, data, ttl) {
  const db = env.DB;
  const { results } = await db.prepare("SELECT device, fcm FROM call_devices WHERE space = ?1").bind(space).all();
  if (!results.length || !env.FCM_SERVICE_ACCOUNT) return { devices: results.length, sent: 0 };
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const token = await fcmAccessToken(env, sa);
  let sent = 0;
  for (const d of results) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token: d.fcm, data, android: { priority: "HIGH", ttl } } }),
    });
    if (res.ok) sent++;
    else {
      const text = await res.text().catch(() => "");
      if (res.status === 404 || /UNREGISTERED/.test(text)) await db.prepare("DELETE FROM call_devices WHERE space = ?1 AND device = ?2").bind(space, d.device).run();
    }
  }
  return { devices: results.length, sent };
}

/* google-services.json (secreto FCM_GOOGLE_SERVICES) → lo que el widget necesita para iniciar Firebase.
   Son datos públicos (van dentro de cualquier app); se sirven desde aquí para que el mismo APK funcione sin recompilar. */
const WIDGET_PACKAGE = "app.productividad.widget";
function firebaseClientConfig(env) {
  try {
    const g = JSON.parse(env.FCM_GOOGLE_SERVICES || "");
    const client = (g.client || []).find((c) => c.client_info?.android_client_info?.package_name === WIDGET_PACKAGE);
    const out = { projectId: g.project_info?.project_id, senderId: g.project_info?.project_number, appId: client?.client_info?.mobilesdk_app_id, apiKey: client?.api_key?.[0]?.current_key };
    return Object.values(out).every((v) => typeof v === "string" && v) ? out : null;
  } catch { return null; }
}

/* Despierta a Claude cuando el dueño deja un encargo: dispara la rutina de claude.ai con su disparador por API
   (POST …/v1/claude_code/routines/<id>/fire con el token de esa rutina). El texto es fijo: el contenido del encargo
   está cifrado y nunca sale de aquí. Con límites (cada 3 min y 24 al día por código) para no gastar el plan del dueño;
   si falla, el encargo ya está guardado y lo atiende el repaso de respaldo. */
const FIRE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_-]+\/fire$/;
const fireReady = (env) => !!(env.ROUTINE_FIRE_TOKEN && FIRE_URL_RE.test(env.ROUTINE_FIRE_URL || ""));

async function fireRoutine(env, ctx, space, now) {
  if (!fireReady(env)) return "apagado";
  const db = env.DB, key = "lastfire:" + space;
  const last = await db.prepare("SELECT v FROM kv WHERE k = ?1").bind(key).first();
  if (last && now - Number(last.v) < CALL.fireCooldownMs) return "espera";
  if (!(await useQuota(db, space, "fire", now))) return "limite";
  await db.prepare("INSERT INTO kv (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?2").bind(key, String(now)).run();
  const job = fetch(env.ROUTINE_FIRE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ROUTINE_FIRE_TOKEN}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
    },
    body: JSON.stringify({ text: CALL.fireText }),
  }).then((res) => (res.ok ? "enviado" : "rechazado")).catch(() => "sin_red");
  if (ctx && typeof ctx.waitUntil === "function") { ctx.waitUntil(job); return "enviado"; }
  return await job;
}

const callOut = (c) => ({ id: c.id, dir: c.dir, state: c.state, urgent: c.urgent, invite: c.invite, result: c.result, createdAt: c.created_at, updatedAt: c.updated_at });

async function handleCalls(pathname, body, env, ctx) {
  const db = env.DB, now = Date.now();
  const { space } = body;

  if (pathname === "/call/status") { // ¿está todo listo para llamar? (sin datos personales)
    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM call_devices WHERE space = ?1").bind(space).first();
    return json({ devices: n, push: !!env.FCM_SERVICE_ACCOUNT, voice: !!env.GEMINI_API_KEY, instant: fireReady(env) });
  }

  if (pathname === "/call/config") { // configuración PÚBLICA de Firebase para el widget (sale de google-services.json)
    const cfg = firebaseClientConfig(env);
    return cfg ? json(cfg) : json({ error: "llamadas_no_configuradas" }, 503);
  }

  if (pathname === "/call/device") { // el celular registra (o quita) su token de Firebase
    if (!ID_RE.test(body.device || "")) return json({ error: "device inválido" }, 400);
    if (body.remove) {
      await db.prepare("DELETE FROM call_devices WHERE space = ?1 AND device = ?2").bind(space, body.device).run();
      return json({ ok: true });
    }
    if (!str(body.fcm, 400) || body.fcm.length < 20) return json({ error: "fcm inválido" }, 400);
    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM call_devices WHERE space = ?1 AND device <> ?2").bind(space, body.device).first();
    if (n >= CALL.devicesPerSpace) await db.prepare("DELETE FROM call_devices WHERE space = ?1 AND device = (SELECT device FROM call_devices WHERE space = ?1 ORDER BY updated_at LIMIT 1)").bind(space).run();
    await db.prepare("INSERT INTO call_devices (space, device, fcm, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(space, device) DO UPDATE SET fcm = ?3, updated_at = ?4").bind(space, body.device, body.fcm, now).run();
    return json({ ok: true });
  }

  if (pathname === "/call/new") {
    const { id, dir, invite } = body;
    if (!ID_RE.test(id || "")) return json({ error: "id inválido" }, 400);
    if (dir !== "out" && dir !== "in") return json({ error: "dir inválida" }, 400);
    if (!str(invite, CALL.inviteChars)) return json({ error: "invite inválido" }, 400);
    if (await db.prepare("SELECT 1 AS x FROM calls WHERE id = ?1").bind(id).first()) return json({ error: "id repetido" }, 409);
    if (dir === "in") {
      await db.prepare("INSERT INTO calls (id, space, dir, state, urgent, invite, created_at, updated_at) VALUES (?1, ?2, 'in', 'active', 0, ?3, ?4, ?4)").bind(id, space, invite, now).run();
      return json({ id, state: "active" });
    }
    if (!env.FCM_SERVICE_ACCOUNT) return json({ error: "llamadas_no_configuradas" }, 503);
    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM call_devices WHERE space = ?1").bind(space).first();
    if (!n) return json({ error: "sin_celular" }, 409);
    if (!(await useQuota(db, space, "call", now))) return json({ error: "limite_diario" }, 429);
    await db.prepare("INSERT INTO calls (id, space, dir, state, urgent, invite, created_at, updated_at) VALUES (?1, ?2, 'out', 'invited', ?3, ?4, ?5, ?5)").bind(id, space, body.urgent ? 1 : 0, invite, now).run();
    const push = await fcmSend(env, space, { t: "call", id, urgent: body.urgent ? "1" : "0" }, "40s");
    if (!push.sent) { // no se pudo despertar ningún celular: queda como perdida con su mensaje
      await db.prepare("UPDATE calls SET created_at = ?2 WHERE id = ?1").bind(id, now - CALL.ringMs - 1).run();
      await expireCalls(env, now);
      return json({ id, state: "missed", devices: push.devices, sent: 0 });
    }
    return json({ id, state: "invited", devices: push.devices, sent: push.sent });
  }

  if (pathname === "/call/get" || pathname === "/call/update") {
    if (!ID_RE.test(body.id || "")) return json({ error: "id inválido" }, 400);
    await expireCalls(env, now);
    const c = await db.prepare("SELECT * FROM calls WHERE id = ?1 AND space = ?2").bind(body.id, space).first();
    if (!c) return json({ error: "no encontrada" }, 404);
    if (pathname === "/call/get") return json(callOut(c));
    const { state, result } = body;
    if (!(NEXT_STATES[c.state] || []).includes(state)) return json({ error: "cambio de estado inválido", state: c.state }, 409);
    if (result !== undefined && !str(result, CALL.resultChars)) return json({ error: "result inválido" }, 400);
    await db.prepare("UPDATE calls SET state = ?2, result = COALESCE(?3, result), updated_at = ?4 WHERE id = ?1").bind(c.id, state, result === undefined ? null : result, now).run();
    return json(callOut(await db.prepare("SELECT * FROM calls WHERE id = ?1").bind(c.id).first()));
  }

  if (pathname === "/voice/token") { // token temporal de Gemini Live para UNA conversación
    if (!env.GEMINI_API_KEY) return json({ error: "voz_no_configurada" }, 503);
    if (!ID_RE.test(body.id || "")) return json({ error: "id inválido" }, 400);
    const c = await db.prepare("SELECT state FROM calls WHERE id = ?1 AND space = ?2").bind(body.id, space).first();
    if (!c || !["invited", "ringing", "active"].includes(c.state)) return json({ error: "la llamada no está abierta" }, 409);
    if (!(await useQuota(db, space, "voice", now))) return json({ error: "limite_diario" }, 429);
    const res = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ uses: 1, expireTime: new Date(now + 30 * 60000).toISOString(), newSessionExpireTime: new Date(now + 2 * 60000).toISOString() }),
    });
    if (!res.ok) return json({ error: "voz_no_disponible", status: res.status }, 502);
    const t = await res.json();
    if (!t || typeof t.name !== "string") return json({ error: "voz_no_disponible" }, 502);
    return json({ token: t.name, url: CALL.liveUrl, model: env.GEMINI_LIVE_MODEL || CALL.liveModel, voice: env.GEMINI_VOICE || CALL.voice });
  }

  if (pathname === "/msg/send") {
    const { id, sender, kind, data } = body;
    if (!ID_RE.test(id || "")) return json({ error: "id inválido" }, 400);
    if (sender !== "claude" && sender !== "yo") return json({ error: "sender inválido" }, 400);
    if (kind !== "msg" && kind !== "encargo") return json({ error: "kind inválido" }, 400);
    if (!str(data, CALL.msgChars) || !data) return json({ error: "data inválida" }, 400);
    if (!(await useQuota(db, space, "msg", now))) return json({ error: "limite_diario" }, 429);
    await db.prepare(`INSERT INTO messages (space, id, seq, sender, kind, data, created_at) VALUES (?1, ?2, ${MSG_SEQ_NEXT}, ?3, ?4, ?5, ?6) ON CONFLICT(space, id) DO NOTHING`).bind(space, id, sender, kind, data, now).run();
    let push = { devices: 0, sent: 0 };
    if (sender === "claude") try { push = await fcmSend(env, space, { t: "msg", id }, "86400s"); } catch { /* el mensaje queda guardado igual */ }
    let fired = "no_aplica";
    if (sender === "yo" && kind === "encargo") try { fired = await fireRoutine(env, ctx, space, now); } catch { fired = "error"; }
    return json({ ok: true, ...push, fired });
  }

  if (pathname === "/msg/list") {
    const after = body.after === undefined ? 0 : body.after;
    if (!Number.isInteger(after) || after < 0) return json({ error: "after inválido" }, 400);
    await expireCalls(env, now);
    const { results } = await db.prepare("SELECT id, seq, sender, kind, ref, data, done, created_at FROM messages WHERE space = ?1 AND seq > ?2 ORDER BY seq LIMIT 201").bind(space, after).all();
    const more = results.length > 200, page = more ? results.slice(0, 200) : results;
    return json({
      messages: page.map((m) => ({ id: m.id, seq: m.seq, sender: m.sender, kind: m.kind, ref: m.ref, data: m.data, done: m.done, createdAt: m.created_at })),
      seq: page.length ? page[page.length - 1].seq : after,
      more,
    });
  }

  if (pathname === "/msg/done") { // marcar un encargo como atendido (o volver a abrirlo)
    if (!ID_RE.test(body.id || "")) return json({ error: "id inválido" }, 400);
    if (body.done !== 0 && body.done !== 1) return json({ error: "done inválido" }, 400);
    await db.prepare(`UPDATE messages SET done = ?3, seq = ${MSG_SEQ_NEXT} WHERE space = ?1 AND id = ?2`).bind(space, body.id, body.done).run();
    return json({ ok: true });
  }

  return json({ error: "no encontrado" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    if (pathname !== "/" && tooMany("ip:" + ip, LIMITS.ipPerMinute)) return json({ error: "demasiadas peticiones" }, 429);
    try {
      await ensureSchema(env.DB);
      if (pathname === "/vapid" && request.method === "GET") return json({ publicKey: (await getKeys(env.DB)).publicB64 });
      if (pathname === "/sync" && request.method === "PUT") return await handleSync(request, env);
      if (pathname === "/space/sync" && request.method === "POST") return await handleSpaceSync(request, env);
      if (pathname === "/space/delete" && request.method === "POST") return await handleSpaceDelete(request, env);
      if ((pathname.startsWith("/call/") || pathname.startsWith("/msg/") || pathname === "/voice/token") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !/^[0-9a-f]{64}$/.test(body.space || "")) return json({ error: "space inválido" }, 400);
        if (tooMany("space:" + body.space, LIMITS.spacePerMinute)) return json({ error: "demasiadas peticiones" }, 429);
        return await handleCalls(pathname, body, env, ctx);
      }
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
  _test: { encryptPayload, vapidHeader, getKeys, deliver, expireCalls, b64u, LIMITS, CALL, resetRate: () => hits.clear(), resetFcm: () => { fcmAuth = null; } },
};
