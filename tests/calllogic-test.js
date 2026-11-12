// Lógica pura de llamadas y mensajes (calllogic.js): hilo, Gemini Live, transcripción y audio.
const assert = require('node:assert');
const C = require('../calllogic.js');
const ok = (m) => console.log('OK', m);

// ---- hilo
let th = C.mergeThread([], [
  { id: 'm2', seq: 2, sender: 'yo', kind: 'encargo', done: 0, at: 2000, text: 'Busca ofertas' },
  { id: 'm1', seq: 1, sender: 'claude', kind: 'msg', done: 0, at: 1000, text: 'Hola' },
]);
assert.deepStrictEqual(th.map((m) => m.id), ['m1', 'm2']);
th = C.mergeThread(th, [{ id: 'm2', seq: 5, done: 1 }, { id: 'm3', seq: 6, sender: 'claude', kind: 'missed', done: 0, at: 3000, text: 'Llamada perdida: x' }]);
assert.strictEqual(th.length, 3); assert.strictEqual(th[1].done, 1); assert.strictEqual(th[1].text, 'Busca ofertas'); // el estado nuevo no borra el texto
assert.strictEqual(C.unread(th, 0), 2); assert.strictEqual(C.unread(th, 1), 1); assert.strictEqual(C.openErrands(th).length, 0);
assert.strictEqual(C.messageText('missed', { reason: '¿Despliego?' }), 'Llamada perdida: ¿Despliego?');
assert.strictEqual(C.messageText('msg', { text: 'Listo' }), 'Listo'); assert.strictEqual(C.messageText('msg', null), '');
assert(/^y[A-Za-z0-9_-]{16}$/.test(C.newId('y')));
assert.deepStrictEqual(C.AAD, { invite: C.AAD.invite, result: C.AAD.result, msg: C.AAD.msg });
assert.strictEqual(C.AAD.invite('c1') + C.AAD.result('c1') + C.AAD.msg('m1'), 'inv|c1res|c1msg|m1');
ok('hilo: orden, último estado por id, no leídos y encargos abiertos; mismos datos autenticados que la herramienta y el widget');

// ---- Gemini Live: setup, turnos, herramientas
const setup = C.setupMessage('gemini-3.8-live', 'Charon', 'instr', C.tools(false)).setup;
assert.strictEqual(setup.model, 'models/gemini-3.8-live'); assert.deepStrictEqual(setup.generationConfig.responseModalities, ['AUDIO']);
assert.strictEqual(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
assert.deepStrictEqual(setup.inputAudioTranscription, {}); assert.deepStrictEqual(setup.outputAudioTranscription, {});
assert.deepStrictEqual(setup.tools[0].functionDeclarations.map((d) => d.name), ['colgar', 'dejar_encargo', 'ver_pendientes']);
assert.deepStrictEqual(C.tools(true)[0].functionDeclarations.map((d) => d.name), ['colgar', 'dejar_encargo']);
assert.strictEqual(C.setupMessage('models/x', 'v', 'i', []).setup.model, 'models/x');
const ins = C.instructions(true, { reason: '¿Apruebo el despliegue?', context: 'Pruebas en verde' }, 'jueves 12');
assert(ins.includes('«¿Apruebo el despliegue?»') && ins.includes('Pruebas en verde') && ins.includes('jueves 12') && ins.includes('español'));
assert(C.instructions(false, {}, 'hoy').includes('ver_pendientes'));
assert.strictEqual(C.firstTurn(true).clientContent.turnComplete, true);
assert.deepStrictEqual(C.toolResponse('f1', 'colgar', 'ok'), { toolResponse: { functionResponses: [{ id: 'f1', name: 'colgar', response: { result: 'ok' } }] } });
assert.deepStrictEqual(C.toolResponse(undefined, 'colgar', 'ok').toolResponse.functionResponses[0], { name: 'colgar', response: { result: 'ok' } });
assert.strictEqual(C.audioMessage('AAAA').realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
ok('Gemini Live: mensaje setup, herramientas según quién llama, instrucciones en español con motivo y contexto');

// ---- mensajes del servidor de Gemini
const evs = [
  { setupComplete: {} },
  { serverContent: { outputTranscription: { text: 'Hola,' } } },
  { serverContent: { outputTranscription: { text: ' ¿cómo vas?' }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAE=' } }] } } },
  { serverContent: { inputTranscription: { text: 'Bien' }, turnComplete: true } },
  { toolCall: { functionCalls: [{ id: 'f9', name: 'dejar_encargo', args: { texto: 'Llamar a Ana' } }] } },
  { serverContent: { interrupted: true } },
  { goAway: { timeLeft: '10s' } },
].flatMap((m) => C.parse(m));
assert.deepStrictEqual(evs.map((e) => e.kind), ['ready', 'transcript', 'audio', 'transcript', 'transcript', 'turn', 'tool', 'interrupted', 'turn', 'goaway']);
assert.deepStrictEqual(evs[6], { kind: 'tool', id: 'f9', name: 'dejar_encargo', args: { texto: 'Llamar a Ana' } });
assert.deepStrictEqual(C.parse('nada'), []); assert.deepStrictEqual(C.parse({ error: { message: 'x' } }), [{ kind: 'error', text: 'x' }]);
const turns = [];
for (const e of evs) if (e.kind === 'transcript') C.addTranscript(turns, e.who, e.text);
assert.deepStrictEqual(turns, [{ who: 'ia', text: 'Hola, ¿cómo vas?' }, { who: 'yo', text: 'Bien' }]);
assert.deepStrictEqual(C.resultBody([...turns, { who: 'ia', text: '   ' }], 61), { turns: [{ who: 'ia', text: 'Hola, ¿cómo vas?' }, { who: 'yo', text: 'Bien' }], seconds: 61 });
ok('mensajes de Gemini: listo, audio, transcripción, herramientas, interrupción; la transcripción se une por turnos');

// ---- audio PCM 16 bits ↔ Float32
const f = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
const back = C.b64ToFloat(C.floatToB64(f));
assert.strictEqual(back.length, 6);
[0, 0.5, -0.5, 1, -1, 1].forEach((v, i) => assert(Math.abs(back[i] - v) < 0.001, `muestra ${i}`));
assert.strictEqual(Buffer.from(C.floatToB64(new Float32Array([1])), 'base64').readInt16LE(0), 32767);
assert.strictEqual(C.b64ToFloat('AAE=')[0], 256 / 32768);
ok('audio: Float32 ↔ PCM 16 bits little-endian en base64 (con recorte)');

// ---- pendientes para la voz
const tasks = [{ text: 'Pagar luz', due: '2026-11-10', priority: 'high', done: false }, { text: 'Leer', due: '', done: false }, { text: 'Hecha', done: true }, { text: 'Informe', due: '2026-11-20', done: false }];
assert.strictEqual(C.tasksForVoice(tasks, '2026-11-12'), 'Tareas pendientes (3):\n- Pagar luz (prioridad alta) — vencida, 2026-11-10\n- Informe — 2026-11-20\n- Leer');
assert.strictEqual(C.tasksForVoice([], '2026-11-12'), 'No tiene tareas pendientes.');
ok('pendientes para la voz: vencidas primero, sin las completadas');
console.log('todas las pruebas de calllogic.js pasan');
