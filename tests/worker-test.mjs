import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import worker from '../worker/index.js';
const { webcrypto } = await import('node:crypto');
const crypto_ = webcrypto;
const b64u = worker._test.b64u;

// --- D1 simulado sobre SQLite
function mockD1() {
  const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db };
}
const env = { DB: mockD1(), ALLOW_ANY_PUSH_HOST: '1', VAPID_SUBJECT: 'mailto:test@example.com' };

// --- dispositivo "navegador": clave ECDH del usuario + secreto de autenticación
const ua = await crypto_.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPublic = new Uint8Array(await crypto_.subtle.exportKey('raw', ua.publicKey));
const auth = crypto_.getRandomValues(new Uint8Array(16));
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: b64u.enc(uaPublic), auth: b64u.enc(auth) } };

// --- receptor independiente (RFC 8291 §3.4): descifra lo que envía el Worker
async function decrypt(body, vapidPublic) {
  const salt = body.slice(0, 16), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  assert.strictEqual(new DataView(body.buffer, body.byteOffset).getUint32(16), 4096);
  const asKey = await crypto_.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto_.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const hk = async (s, ikm, info, n) => new Uint8Array(await crypto_.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto_.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const te = new TextEncoder();
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  const ikm = await hk(auth, ecdh, cat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await crypto_.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto_.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  assert.strictEqual(plain[plain.length - 1], 2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

// --- Petición a la API
const call = (method, path, body) => worker.fetch(new Request('https://w.test' + path, { method, body: body && JSON.stringify(body) }), env);

let res = await call('GET', '/'); assert.strictEqual(res.status, 200);
res = await call('GET', '/vapid'); const { publicKey } = await res.json();
assert.strictEqual(b64u.dec(publicKey).length, 65); assert.strictEqual(b64u.dec(publicKey)[0], 4);
assert.strictEqual((await (await call('GET', '/vapid')).json()).publicKey, publicKey); // estable

const now = Date.now(), device = 'dispositivo-de-prueba-123';
const items = [
  { id: 'r1:1', fireAt: now - 1000, title: 'Entregar informe', body: 'Vence Hoy', tag: 'r-r1-1' },     // ya toca
  { id: 'r2:2', fireAt: now - 2000, title: 'Otra tarea', body: 'Recordatorio', tag: 'r-r2-2' },         // ya toca
  { id: 'r3:3', fireAt: now + 3600000, title: 'Futuro', body: 'Recordatorio', tag: 'r-r3-3' },          // dentro de 1 h
];
res = await call('PUT', '/sync', { device, subscription, items }); assert.strictEqual(res.status, 200);
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 3);

// validaciones
assert.strictEqual((await call('PUT', '/sync', { device: 'x', subscription, items })).status, 400);
assert.strictEqual((await call('PUT', '/sync', { device, subscription: { ...subscription, endpoint: 'http://x.com' }, items })).status, 400);
assert.strictEqual((await call('PUT', '/sync', { device, subscription, items: [{ ...items[0], fireAt: now + 99 * 86400000 }] })).status, 400);
const strict = { DB: env.DB }; // sin ALLOW_ANY: solo servicios push conocidos
assert.strictEqual((await worker.fetch(new Request('https://w.test/sync', { method: 'PUT', body: JSON.stringify({ device, subscription: { ...subscription, endpoint: 'https://evil.example.com/x' }, items }) }), strict)).status, 400);
assert.strictEqual((await worker.fetch(new Request('https://w.test/sync', { method: 'PUT', body: JSON.stringify({ device, subscription, items }) }), strict)).status, 200);
console.log('OK API y validaciones');

// re-sync reemplaza (cancelar/editar funciona)
await call('PUT', '/sync', { device, subscription, items });
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 3);

// --- cron: intercepta fetch hacia el servicio push
const sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: 201 }); };
const n = await worker._test.deliver(env);
assert.strictEqual(n, 2); assert.strictEqual(sent.length, 2);
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 1); // queda solo el futuro
const h = sent[0].init.headers;
assert.strictEqual(sent[0].url, subscription.endpoint); assert.strictEqual(h['Content-Encoding'], 'aes128gcm');
const texts = [];
for (const s of sent) texts.push(JSON.parse(await decrypt(new Uint8Array(s.init.body), publicKey)));
assert.deepStrictEqual(texts.map(t => t.title).sort(), ['Entregar informe', 'Otra tarea']);
assert.strictEqual(texts.find(t => t.title === 'Entregar informe').tag, 'r-r1-1'); assert.strictEqual(texts[0].body.length > 0, true);
console.log('OK cifrado: el navegador descifra', JSON.stringify(texts[0]));

// --- firma VAPID verificable con la clave pública
const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization); assert(m); assert.strictEqual(m[2], publicKey);
const [hd, cl, sg] = m[1].split('.');
const claims = JSON.parse(new TextDecoder().decode(b64u.dec(cl)));
assert.strictEqual(claims.aud, 'https://fcm.googleapis.com'); assert(claims.exp > Date.now() / 1000); assert.strictEqual(claims.sub, 'mailto:test@example.com');
const pub = await crypto_.subtle.importKey('raw', b64u.dec(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
assert(await crypto_.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.dec(sg), new TextEncoder().encode(`${hd}.${cl}`)));
console.log('OK firma VAPID válida');

// --- 410 elimina el dispositivo; fallos reintentan y se descartan
await call('PUT', '/sync', { device, subscription, items: [{ id: 'z:1', fireAt: Date.now() - 500, title: 'x', body: 'y', tag: 't' }] });
globalThis.fetch = async () => new Response(null, { status: 410 });
await worker._test.deliver(env);
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM devices').get().c, 0); assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 0);
await call('PUT', '/sync', { device, subscription, items: [{ id: 'z:2', fireAt: Date.now() - 500, title: 'x', body: 'y', tag: 't' }] });
globalThis.fetch = async () => new Response(null, { status: 500 });
for (let i = 0; i < 5; i++) await worker._test.deliver(env);
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 0);
console.log('OK 410 elimina dispositivo · errores se reintentan 5 veces y se descartan');

// --- unsync
await call('PUT', '/sync', { device, subscription, items });
await call('POST', '/unsync', { device });
assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) c FROM reminders').get().c, 0);
console.log('OK unsync. Todas las pruebas del servidor pasan');

// ================= sincronización entre dispositivos =================
const space = 'a'.repeat(64);
const sync = async (body) => { const r = await call('POST', '/space/sync', body); return { status: r.status, ...(await r.json()) }; };
const rec = (id, t, col = 'tasks', deleted = 0) => ({ id, col, updatedAt: t, deleted, data: deleted ? '' : JSON.stringify({ id, text: 'x' + t }) });
let t0 = Date.now() - 100000;
// A sube 2 registros; B (since 0) los recibe
let a = await sync({ space, since: 0, records: [rec('t1', t0 + 1), rec('b1', t0 + 2, 'books')] });
assert.strictEqual(a.status, 200); assert.strictEqual(a.records.length, 2); assert.strictEqual(a.seq, 2); assert.strictEqual(a.more, false);
let bRes = await sync({ space, since: 0, records: [] }); assert.strictEqual(bRes.records.length, 2);
// solo lo nuevo desde seq
let a2 = await sync({ space, since: 2, records: [rec('t1', t0 + 10)] });
assert.strictEqual(a2.records.length, 1); assert.strictEqual(a2.records[0].updatedAt, t0 + 10); assert.strictEqual(a2.seq, 3);
// B (since 2) recibe la actualización; seq estricto creciente
bRes = await sync({ space, since: 2, records: [] }); assert.strictEqual(bRes.records[0].id, 't1'); assert.strictEqual(bRes.seq, 3);
// LWW en el servidor: un registro más viejo NO pisa al nuevo y no genera seq
let old = await sync({ space, since: 3, records: [rec('t1', t0 + 5)] });
assert.strictEqual(old.records.length, 0); assert.strictEqual(old.seq, 3);
assert.strictEqual(env.DB.raw.prepare("SELECT data FROM records WHERE space=? AND id='t1'").get(space).data.includes(String(t0 + 10)), true);
// tombstone
let del = await sync({ space, since: 3, records: [rec('t1', t0 + 20, 'tasks', 1)] }); assert.strictEqual(del.records[0].deleted, 1);
// espacios aislados
const other = await sync({ space: 'b'.repeat(64), since: 0, records: [] }); assert.strictEqual(other.records.length, 0);
// paginación (more)
const many = Array.from({ length: 100 }, (_, i) => rec('m' + i, t0 + 100 + i));
for (let k = 0; k < 6; k++) await sync({ space: 'c'.repeat(64), since: 0, records: many.map(r => ({ ...r, id: r.id + '-' + k })) });
let p1 = await sync({ space: 'c'.repeat(64), since: 0, records: [] }); assert.strictEqual(p1.records.length, 500); assert.strictEqual(p1.more, true);
let p2 = await sync({ space: 'c'.repeat(64), since: p1.seq, records: [] }); assert.strictEqual(p2.records.length, 100); assert.strictEqual(p2.more, false);
// validaciones
for (const bad of [
  { space: 'zz', since: 0, records: [] }, { space, since: -1, records: [] }, { space, since: 0, records: Array(101).fill(rec('x', t0)) },
  { space, since: 0, records: [{ ...rec('x', t0), col: 'settings' }] }, { space, since: 0, records: [{ ...rec('x', t0), updatedAt: Date.now() + 9 * 86400000 }] },
  { space, since: 0, records: [{ ...rec('x', t0), data: 'x'.repeat(200001) }] }, { space, since: 0, records: [{ ...rec('', t0) }] },
]) assert.strictEqual((await sync(bad)).status, 400);
// tope por espacio
const full = 'd'.repeat(64);
env.DB.raw.prepare('INSERT INTO spaces VALUES (?,?,?)').run(full, 1, 1);
env.DB.raw.exec(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<2990) INSERT INTO records SELECT '${full}', 'r'||i, 'tasks', 1, 0, '', i FROM c`);
assert.strictEqual((await sync({ space: full, since: 0, records: many.slice(0, 20) })).status, 413);
// purga de tombstones viejos por el cron
env.DB.raw.prepare("INSERT INTO records VALUES (?, 'old', 'tasks', ?, 1, '', 1)").run('e'.repeat(64), Date.now() - 61 * 86400000);
await worker._test.deliver(env);
assert.strictEqual(env.DB.raw.prepare("SELECT COUNT(*) c FROM records WHERE id='old'").get().c, 0);
console.log('OK sincronización: seq, LWW, tombstones, espacios, paginación, validaciones, tope y purga');

// ============ límites del servicio abierto ============
worker._test.resetRate();
// limitador por IP
let last; const hit = async () => (await worker.fetch(new Request('https://w.test/vapid', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), env)).status;
for (let i = 0; i < 120; i++) last = await hit(); assert.strictEqual(last, 200); assert.strictEqual(await hit(), 429);
assert.strictEqual((await worker.fetch(new Request('https://w.test/vapid', { headers: { 'CF-Connecting-IP': '8.8.8.8' } }), env)).status, 200); // otra IP no se afecta
worker._test.resetRate();
// límite por código
const sp = 'f'.repeat(64); let st = 0; for (let i = 0; i < 41; i++) st = (await sync({ space: sp, since: 0, records: [] })).status; assert.strictEqual(st, 429);
worker._test.resetRate();
// borrar mis datos
await sync({ space: 'a1'.repeat(32), since: 0, records: [rec('d1', t0 + 1)] });
assert.strictEqual((await (await call('POST', '/space/delete', { space: 'a1'.repeat(32) })).json()).ok, true);
assert.strictEqual(env.DB.raw.prepare("SELECT COUNT(*) c FROM records WHERE space=?").get('a1'.repeat(32)).c, 0);
assert.strictEqual((await call('POST', '/space/delete', { space: 'x' })).status, 400);
// tope en bytes por código
worker._test.resetRate();
const bigSp = '9'.repeat(64); const fat = (i) => ({ ...rec('f' + i, t0 + i), data: 'x'.repeat(190000) });
let ok16 = 0, code413 = 0; for (let i = 0; i < 40; i++) { const r = await sync({ space: bigSp, since: 0, records: [fat(i)] }); if (r.status === 200) ok16++; else if (r.status === 413) code413++; }
assert(ok16 >= 20 && ok16 < 40 && code413 > 0); worker._test.resetRate();
// igual updatedAt reescribe (migración a cifrado)
const mg = 'e'.repeat(64); await sync({ space: mg, since: 0, records: [{ ...rec('m1', t0 + 5), data: '{"plano":1}' }] });
await sync({ space: mg, since: 0, records: [{ ...rec('m1', t0 + 5), data: 'e1:cifrado' }] });
assert.strictEqual(env.DB.raw.prepare("SELECT data FROM records WHERE space=? AND id='m1'").get(mg).data, 'e1:cifrado');
// avisos: título cifrado largo permitido
const dv = 'dispositivo-largo-12345'; assert.strictEqual((await call('PUT', '/sync', { device: dv, subscription, items: [{ id: 'q:1', fireAt: Date.now() + 60000, title: 'e1:' + 'A'.repeat(500), body: '', tag: 'r-q-1' }] })).status, 200);
console.log('OK límites: IP, código, bytes, borrado de datos, migración y avisos cifrados');
