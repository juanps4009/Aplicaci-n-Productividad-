// Llamadas y mensajes del servidor (worker/index.js) sobre una base simulada, con Firebase y Gemini simulados.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import worker from '../worker/index.js';
const { webcrypto: wc } = await import('node:crypto');
const ok = (m) => console.log('OK', m);
const { b64u, CALL } = worker._test;

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }

// --- cuenta de servicio de Firebase inventada (RSA), para comprobar la firma del token
const rsa = await wc.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await wc.subtle.exportKey('pkcs8', rsa.privateKey)).toString('base64');
const SA = { project_id: 'pendientes-test', client_email: 'fcm@pendientes-test.iam.gserviceaccount.com', token_uri: 'https://oauth2.googleapis.com/token',
  private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n` };

// --- red simulada: OAuth de Google, FCM y Gemini
const net = { oauth: 0, fcm: [], gemini: [], fire: [], fireStatus: 200, fireThrows: false, fcmStatus: () => 200, geminiStatus: 200 };
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url === SA.token_uri) {
    const assertion = new URLSearchParams(init.body).get('assertion'); const [h, c, s] = assertion.split('.');
    assert(await wc.subtle.verify('RSASSA-PKCS1-v1_5', rsa.publicKey, b64u.dec(s), new TextEncoder().encode(`${h}.${c}`)), 'firma RS256 válida');
    const claims = JSON.parse(new TextDecoder().decode(b64u.dec(c)));
    assert.strictEqual(claims.iss, SA.client_email); assert.strictEqual(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging'); assert.strictEqual(claims.aud, SA.token_uri);
    net.oauth++; return new Response(JSON.stringify({ access_token: 'ya29.prueba', expires_in: 3600 }));
  }
  if (url === `https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`) {
    assert.strictEqual(init.headers.Authorization, 'Bearer ya29.prueba');
    const m = JSON.parse(init.body).message; net.fcm.push(m);
    const st = net.fcmStatus(m.token);
    return new Response(st === 404 ? '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}' : '{}', { status: st });
  }
  if (url === 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens') {
    assert.strictEqual(init.headers['x-goog-api-key'], 'clave-gemini'); const b = JSON.parse(init.body); net.gemini.push(b);
    assert.strictEqual(b.uses, 1); assert(Date.parse(b.expireTime) > Date.now() && Date.parse(b.newSessionExpireTime) > Date.now());
    return new Response(JSON.stringify({ name: 'auth_tokens/efimero123' }), { status: net.geminiStatus });
  }
  if (/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[\w-]+\/fire$/.test(url)) {
    net.fire.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (net.fireThrows) throw new Error('sin red');
    return new Response('{"session_id":"s1"}', { status: net.fireStatus });
  }
  throw new Error('red no simulada: ' + url);
};

const env = { DB: mockD1(), FCM_SERVICE_ACCOUNT: JSON.stringify(SA), GEMINI_API_KEY: 'clave-gemini' };
const api = async (path, body, e = env) => { worker._test.resetRate(); const r = await worker.fetch(new Request('https://w.test' + path, { method: 'POST', body: JSON.stringify(body) }), e); return { status: r.status, body: await r.json() }; };
const space = 'a'.repeat(64), other = 'b'.repeat(64);
const rows = (sql) => env.DB.raw.prepare(sql).all().map((x) => ({ ...x }));

// ---- sin configurar: lo dice claro
let r = await api('/call/status', { space }, { DB: env.DB }); assert.deepStrictEqual(r.body, { devices: 0, push: false, voice: false, instant: false });
r = await api('/call/new', { space, id: 'llamada0001', dir: 'out', invite: 'e1:x' }, { DB: env.DB }); assert.strictEqual(r.status, 503); assert.strictEqual(r.body.error, 'llamadas_no_configuradas');
r = await api('/voice/token', { space, id: 'llamada0001' }, { DB: env.DB }); assert.strictEqual(r.body.error, 'voz_no_configurada');
assert.strictEqual((await api('/call/status', { space: 'xyz' })).status, 400);
ok('sin secretos de Firebase/Gemini responde «no configurado»; valida el espacio');

// ---- registrar el celular y llamar
r = await api('/call/new', { space, id: 'llamada0001', dir: 'out', invite: 'e1:x' }); assert.strictEqual(r.status, 409); assert.strictEqual(r.body.error, 'sin_celular');
assert.strictEqual((await api('/call/device', { space, device: 'cel-juan-01', fcm: 'corto' })).status, 400);
r = await api('/call/device', { space, device: 'cel-juan-01', fcm: 'fcm-token-del-celular-0001' }); assert(r.body.ok);
await api('/call/device', { space, device: 'cel-juan-01', fcm: 'fcm-token-del-celular-0002' }); // actualizar no duplica
assert.strictEqual(rows('SELECT * FROM call_devices').length, 1); assert.strictEqual(rows('SELECT fcm FROM call_devices')[0].fcm, 'fcm-token-del-celular-0002');
assert.deepStrictEqual((await api('/call/status', { space })).body, { devices: 1, push: true, voice: true, instant: false });

r = await api('/call/new', { space, id: 'llamada0001', dir: 'out', invite: 'e1:motivo-cifrado', urgent: true });
assert.strictEqual(r.status, 200); assert.strictEqual(r.body.state, 'invited'); assert.strictEqual(r.body.sent, 1);
assert.strictEqual(net.oauth, 1); assert.strictEqual(net.fcm.length, 1);
assert.deepStrictEqual(net.fcm[0], { token: 'fcm-token-del-celular-0002', data: { t: 'call', id: 'llamada0001', urgent: '1' }, android: { priority: 'HIGH', ttl: '40s' } });
assert(!JSON.stringify(net.fcm[0]).includes('motivo')); // el aviso solo lleva el id
assert.strictEqual((await api('/call/new', { space, id: 'llamada0001', dir: 'out', invite: 'e1:x' })).status, 409); // id repetido
ok('el celular registra su token; llamar envía un aviso FCM de alta prioridad con solo el id (token OAuth RS256 verificado)');

// ---- ciclo de la llamada
r = await api('/call/get', { space, id: 'llamada0001' }); assert.strictEqual(r.body.invite, 'e1:motivo-cifrado'); assert.strictEqual(r.body.urgent, 1);
assert.strictEqual((await api('/call/get', { space: other, id: 'llamada0001' })).status, 404); // otro código no la ve
assert.strictEqual((await api('/call/update', { space, id: 'llamada0001', state: 'ringing' })).body.state, 'ringing');
r = await api('/voice/token', { space, id: 'llamada0001' });
assert.deepStrictEqual(r.body, { token: 'auth_tokens/efimero123', url: CALL.liveUrl, model: 'gemini-3.8-live', voice: 'Charon' });
assert.strictEqual((await api('/call/update', { space, id: 'llamada0001', state: 'active' })).body.state, 'active');
assert.strictEqual((await api('/call/update', { space, id: 'llamada0001', state: 'ringing' })).status, 409); // no vuelve atrás
assert.strictEqual((await api('/call/update', { space, id: 'llamada0001', state: 'active', result: 'e1:parcial' })).body.result, 'e1:parcial');
r = await api('/call/update', { space, id: 'llamada0001', state: 'ended', result: 'e1:transcripcion' }); assert.strictEqual(r.body.state, 'ended'); assert.strictEqual(r.body.result, 'e1:transcripcion');
assert.strictEqual((await api('/call/update', { space, id: 'llamada0001', state: 'active' })).status, 409);
assert.strictEqual((await api('/voice/token', { space, id: 'llamada0001' })).status, 409); // terminada: sin voz
ok('estados invited → ringing → active → ended, transcripción guardada, token de Gemini Live solo con la llamada abierta');

// ---- sin contestar → perdida, y queda como mensaje con el motivo
await api('/call/new', { space, id: 'llamada0002', dir: 'out', invite: 'e1:otro-motivo' });
env.DB.raw.prepare('UPDATE calls SET created_at = created_at - ?1 WHERE id = ?2').run(CALL.ringMs + 1000, 'llamada0002');
r = await api('/call/get', { space, id: 'llamada0002' }); assert.strictEqual(r.body.state, 'missed');
r = await api('/msg/list', { space }); assert.strictEqual(r.body.messages.length, 1);
assert.deepStrictEqual({ ...r.body.messages[0], createdAt: 0 }, { id: 'xllamada0002', seq: 1, sender: 'claude', kind: 'missed', ref: 'llamada0002', data: 'e1:otro-motivo', done: 0, createdAt: 0 });
// rechazada
await api('/call/new', { space, id: 'llamada0003', dir: 'out', invite: 'e1:y' }); assert.strictEqual((await api('/call/update', { space, id: 'llamada0003', state: 'declined' })).body.state, 'declined');
// el cron también las cierra, y una abierta demasiado tiempo termina sola
await api('/call/new', { space, id: 'llamada0004', dir: 'out', invite: 'e1:z' });
await api('/call/new', { space, id: 'entrante001', dir: 'in', invite: 'e1:entrante' });
env.DB.raw.prepare('UPDATE calls SET created_at = created_at - 50000 WHERE id = ?1').run('llamada0004');
env.DB.raw.prepare('UPDATE calls SET updated_at = updated_at - ?1 WHERE id = ?2').run(CALL.maxMs + 1000, 'entrante001');
await worker._test.expireCalls(env, Date.now());
assert.deepStrictEqual(rows("SELECT id, state FROM calls WHERE id IN ('llamada0004','entrante001') ORDER BY id"), [{ id: 'entrante001', state: 'ended' }, { id: 'llamada0004', state: 'missed' }].map((x) => ({ ...x })));
ok('sin contestar en 40 s → perdida con mensaje; rechazar; el cron cierra llamadas viejas');

// ---- si ningún celular recibe el aviso: perdida de inmediato, y un token muerto se borra
net.fcmStatus = () => 404;
r = await api('/call/new', { space, id: 'llamada0005', dir: 'out', invite: 'e1:w' }); assert.strictEqual(r.body.state, 'missed'); assert.strictEqual(r.body.sent, 0);
assert.strictEqual(rows('SELECT * FROM call_devices').length, 0); net.fcmStatus = () => 200;
ok('si el aviso no llega a ningún celular la llamada queda perdida y el token inválido se borra');

// ---- llamada desde el celular (entrante) y encargos
r = await api('/call/new', { space, id: 'entrante002', dir: 'in', invite: 'e1:yo-llamo' }); assert.strictEqual(r.body.state, 'active');
assert.strictEqual((await api('/voice/token', { space, id: 'entrante002' })).status, 200);
await api('/call/update', { space, id: 'entrante002', state: 'ended', result: 'e1:lo-que-hablamos' });
r = await api('/msg/send', { space, id: 'encargo0001', sender: 'yo', kind: 'encargo', data: 'e1:busca-ofertas' }); assert(r.body.ok); assert.strictEqual(r.body.sent, 0); // lo que mando yo no hace sonar mi celular
assert.strictEqual((await api('/msg/send', { space, id: 'encargo0002', sender: 'otro', kind: 'msg', data: 'e1:a' })).status, 400);
assert.strictEqual((await api('/msg/send', { space, id: 'encargo0002', sender: 'yo', kind: 'raro', data: 'e1:a' })).status, 400);
assert.strictEqual((await api('/msg/send', { space, id: 'encargo0002', sender: 'yo', kind: 'msg', data: '' })).status, 400);
ok('desde el celular: llamada entrante con voz y transcripción, y encargos para Claude');

// ---- mensajes de Claude: avisan al celular; lista incremental; marcar encargo atendido
await api('/call/device', { space, device: 'cel-juan-01', fcm: 'fcm-token-del-celular-0003' }); net.fcm = [];
r = await api('/msg/send', { space, id: 'mensaje0001', sender: 'claude', kind: 'msg', data: 'e1:hola' }); assert.strictEqual(r.body.sent, 1);
assert.deepStrictEqual(net.fcm[0].data, { t: 'msg', id: 'mensaje0001' }); assert.strictEqual(net.fcm[0].android.ttl, '86400s');
await api('/msg/send', { space, id: 'mensaje0001', sender: 'claude', kind: 'msg', data: 'e1:repetido' }); // mismo id: no se duplica
const all = (await api('/msg/list', { space })).body; assert.deepStrictEqual(all.messages.map((m) => m.id), ['xllamada0002', 'xllamada0004', 'xllamada0005', 'encargo0001', 'mensaje0001']);
assert.strictEqual(all.messages.at(-1).data, 'e1:hola');
assert.deepStrictEqual((await api('/msg/list', { space, after: all.seq })).body.messages, []);
await api('/msg/done', { space, id: 'encargo0001', done: 1 });
r = (await api('/msg/list', { space, after: all.seq })).body; assert.strictEqual(r.messages.length, 1); assert.strictEqual(r.messages[0].done, 1); // vuelve a llegar con su nuevo estado
assert.deepStrictEqual((await api('/msg/list', { space: other })).body.messages, []);
ok('mensajes de Claude avisan al celular; lista incremental por seq; encargos atendidos; otro código no ve nada');

// ---- configuración pública de Firebase para el widget (desde google-services.json)
assert.strictEqual((await api('/call/config', { space })).status, 503);
const gs = { project_info: { project_number: '123456789', project_id: 'pendientes-test' }, client: [
  { client_info: { mobilesdk_app_id: '1:123:android:otra', android_client_info: { package_name: 'otra.app' } }, api_key: [{ current_key: 'AIzaOtra' }] },
  { client_info: { mobilesdk_app_id: '1:123456789:android:abc', android_client_info: { package_name: 'app.productividad.widget' } }, api_key: [{ current_key: 'AIzaWidget' }] }] };
r = await api('/call/config', { space }, { ...env, FCM_GOOGLE_SERVICES: JSON.stringify(gs) });
assert.deepStrictEqual(r.body, { projectId: 'pendientes-test', senderId: '123456789', appId: '1:123456789:android:abc', apiKey: 'AIzaWidget' });
assert.strictEqual((await api('/call/config', { space }, { ...env, FCM_GOOGLE_SERVICES: '{"client":[]}' })).status, 503);
ok('el widget recibe la configuración pública de Firebase de su paquete (app.productividad.widget)');

// ---- disparo instantáneo: un encargo del dueño despierta la rutina de Claude (con límites)
const FIRE = 'https://api.anthropic.com/v1/claude_code/routines/trig_abc123/fire';
const fenv = { ...env, ROUTINE_FIRE_URL: FIRE, ROUTINE_FIRE_TOKEN: 'sk-ant-oat01-prueba' };
const errand = async (id, e = fenv, who = 'yo', kind = 'encargo') => (await api('/msg/send', { space, id, sender: who, kind, data: 'e1:secreto-cifrado' }, e)).body;
const clearFire = () => env.DB.raw.prepare("DELETE FROM kv WHERE k LIKE 'lastfire:%'").run();
assert.strictEqual((await api('/call/status', { space }, fenv)).body.instant, true);
assert.strictEqual((await api('/call/status', { space }, { ...env, ROUTINE_FIRE_URL: 'https://malo.example/x', ROUTINE_FIRE_TOKEN: 't' })).body.instant, false); // solo la URL de la API de Anthropic
assert.strictEqual((await errand('fuego000001', env)).fired, 'apagado'); assert.strictEqual(net.fire.length, 0);             // sin secretos: no hace nada
let b = await errand('fuego000002'); assert.strictEqual(b.fired, 'enviado'); assert.strictEqual(net.fire.length, 1);
assert.strictEqual(net.fire[0].url, FIRE); assert.strictEqual(net.fire[0].headers.Authorization, 'Bearer sk-ant-oat01-prueba');
assert.strictEqual(net.fire[0].headers['anthropic-version'], '2023-06-01'); assert.strictEqual(net.fire[0].headers['anthropic-beta'], 'experimental-cc-routine-2026-04-01');
assert.deepStrictEqual(Object.keys(net.fire[0].body), ['text']); assert(!JSON.stringify(net.fire[0]).includes('secreto')); assert(!JSON.stringify(net.fire[0]).includes(space)); // texto fijo: nada del contenido ni del código
assert.strictEqual((await errand('fuego000003')).fired, 'espera'); assert.strictEqual(net.fire.length, 1);                      // enfriamiento de 3 min
env.DB.raw.prepare("UPDATE kv SET v = ? WHERE k LIKE 'lastfire:%'").run(String(Date.now() - CALL.fireCooldownMs - 1000));
assert.strictEqual((await errand('fuego000004')).fired, 'enviado'); assert.strictEqual(net.fire.length, 2);
clearFire(); assert.strictEqual((await errand('fuego000005', fenv, 'claude', 'msg')).fired, 'no_aplica'); assert.strictEqual((await errand('fuego000006', fenv, 'yo', 'msg')).fired, 'no_aplica'); assert.strictEqual(net.fire.length, 2); // solo encargos del dueño
net.fireStatus = 401; b = await errand('fuego000007'); assert.strictEqual(b.ok, true); assert.strictEqual(b.fired, 'rechazado');       // si Anthropic rechaza, el encargo igual queda guardado
assert(env.DB.raw.prepare("SELECT 1 x FROM messages WHERE id = 'fuego000007'").get()); net.fireStatus = 200;
clearFire(); net.fireThrows = true; b = await errand('fuego000008'); assert.strictEqual(b.ok, true); assert.strictEqual(b.fired, 'sin_red'); net.fireThrows = false; // sin red: tampoco se pierde
let waited = []; worker._test.resetRate(); clearFire();                                                                         // en Cloudflare responde sin esperar (waitUntil)
r = await worker.fetch(new Request('https://w.test/msg/send', { method: 'POST', body: JSON.stringify({ space, id: 'fuego000009', sender: 'yo', kind: 'encargo', data: 'e1:x' }) }), fenv, { waitUntil: (p) => waited.push(p) });
assert.strictEqual((await r.json()).fired, 'enviado'); assert.strictEqual(waited.length, 1); await Promise.all(waited);
env.DB.raw.prepare("INSERT OR REPLACE INTO quota (space, day, kind, n) VALUES (?1, ?2, 'fire', ?3)").run(space, new Date().toISOString().slice(0, 10), CALL.perDay.fire); clearFire();
assert.strictEqual((await errand('fuego000010')).fired, 'limite');                                                              // tope diario
env.DB.raw.prepare("DELETE FROM quota WHERE kind = 'fire'").run();
ok('encargo del dueño → dispara la rutina de Claude (URL y encabezados correctos, texto fijo sin contenido); enfriamiento, tope diario, solo encargos del dueño; si falla el encargo se guarda igual');

// ---- límites diarios y fallo de Gemini
env.DB.raw.prepare("INSERT OR REPLACE INTO quota (space, day, kind, n) VALUES (?1, ?2, 'call', ?3)").run(space, new Date().toISOString().slice(0, 10), CALL.perDay.call);
r = await api('/call/new', { space, id: 'llamada0099', dir: 'out', invite: 'e1:q' }); assert.strictEqual(r.status, 429); assert.strictEqual(r.body.error, 'limite_diario');
net.geminiStatus = 400; await api('/call/new', { space, id: 'entrante003', dir: 'in', invite: 'e1:q' });
r = await api('/voice/token', { space, id: 'entrante003' }); assert.strictEqual(r.status, 502); assert.strictEqual(r.body.error, 'voz_no_disponible'); net.geminiStatus = 200;
assert.strictEqual(net.oauth, 1); // el token OAuth de Firebase se reutiliza
ok('límites diarios por código; si Gemini falla se dice «voz no disponible»; el token de Firebase se reutiliza');

// ---- borrar mis datos del servidor también borra llamadas, mensajes y celulares
await worker.fetch(new Request('https://w.test/space/delete', { method: 'POST', body: JSON.stringify({ space }) }), env);
for (const t of ['calls', 'messages', 'call_devices', 'quota']) assert.strictEqual(env.DB.raw.prepare(`SELECT COUNT(*) n FROM ${t} WHERE space = ?`).get(space).n, 0, t);
ok('«borrar mis datos del servidor» incluye llamadas, mensajes y celulares');
console.log('todas las pruebas de llamadas del servidor pasan');
