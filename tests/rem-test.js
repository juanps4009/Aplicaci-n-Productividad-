const ROOT = require('path').join(__dirname, '..');
const R = require(ROOT + '/reminders.js'); const assert = require('assert');
process.env.TZ = process.env.TZ || 'America/Bogota';
const L = (s) => R.localMs(s);
const t = (o) => ({ done:false, due:'', reminders:[], ...o });
// once
assert.deepStrictEqual(R.occurrences({kind:'once',at:'2026-10-07T15:00'},t(),L('2026-10-07T00:00'),L('2026-10-08T00:00')),[L('2026-10-07T15:00')]);
assert.deepStrictEqual(R.occurrences({kind:'once',at:'2026-10-07T15:00'},t(),L('2026-10-07T15:00'),L('2026-10-08T00:00')),[]); // (from, to] exclusivo
// before: vence 9 oct, 2 días antes a las 15:00 => 7 oct 15:00
assert.deepStrictEqual(R.occurrences({kind:'before',days:2,time:'15:00'},t({due:'2026-10-09'}),L('2026-10-01T00:00'),L('2026-10-20T00:00')),[L('2026-10-07T15:00')]);
assert.deepStrictEqual(R.occurrences({kind:'before',days:2,time:'15:00'},t({due:''}),0,1e15),[]);
// before cruzando mes
assert.deepStrictEqual(R.occurrences({kind:'before',days:3,time:'08:30'},t({due:'2026-11-02'}),L('2026-10-01T00:00'),L('2026-11-05T00:00')),[L('2026-10-30T08:30')]);
// daily: 3 días
const d = R.occurrences({kind:'daily',time:'09:00'},t(),L('2026-10-07T10:00'),L('2026-10-10T12:00'));
assert.deepStrictEqual(d,[L('2026-10-08T09:00'),L('2026-10-09T09:00'),L('2026-10-10T09:00')]);
// weekly: lunes (1); 2026-10-05 es lunes
const w = R.occurrences({kind:'weekly',weekday:1,time:'18:00'},t(),L('2026-10-01T00:00'),L('2026-10-20T00:00'));
assert.deepStrictEqual(w,[L('2026-10-05T18:00'),L('2026-10-12T18:00'),L('2026-10-19T18:00')]);
// every 4h 08:00–20:00 => 8,12,16,20
const e = R.occurrences({kind:'every',everyHours:4,winFrom:'08:00',winTo:'20:00'},t(),L('2026-10-07T00:00'),L('2026-10-07T23:59'));
assert.deepStrictEqual(e,['08:00','12:00','16:00','20:00'].map(h=>L('2026-10-07T'+h)));
// every desde media ventana
const e2 = R.occurrences({kind:'every',everyHours:4,winFrom:'08:00',winTo:'20:00'},t(),L('2026-10-07T13:00'),L('2026-10-08T09:00'));
assert.deepStrictEqual(e2,[L('2026-10-07T16:00'),L('2026-10-07T20:00'),L('2026-10-08T08:00')]);
// nextFires ordena varios y respeta done
const task=t({due:'2026-10-09',reminders:[{id:'a',kind:'once',at:'2026-10-07T15:00'},{id:'b',kind:'daily',time:'09:00'}]});
const nf=R.nextFires(task,L('2026-10-06T00:00'),3);
assert.strictEqual(nf[0].remId,'b'); assert(nf.some(x=>x.remId==='a'));
assert(nf.every((x,i)=>i===0||nf[i-1].ms<=x.ms));
assert.deepStrictEqual(R.nextFires({...task,done:true},0,3),[]);
// dueFires: no dispara lo anterior a created; agrupa atrasados
const rem={id:'r',kind:'daily',time:'09:00',created:L('2026-10-07T10:00')};
assert.strictEqual(R.dueFires(t({reminders:[rem]}),L('2026-10-08T08:59'),{}).length,0);
const df=R.dueFires(t({reminders:[rem]}),L('2026-10-10T12:00'),{});
assert.strictEqual(df.length,1); assert.strictEqual(df[0].count,3); assert.strictEqual(df[0].ms,L('2026-10-10T09:00'));
const st={r:{lastFired:df[0].ms}}; assert.strictEqual(R.dueFires(t({reminders:[rem]}),L('2026-10-10T12:00'),st).length,0);
// onlyDevice
const sn={id:'s',kind:'once',atMs:5000,created:0,onlyDevice:'A'}; assert.strictEqual(R.dueFires(t({reminders:[sn]}),6000,{},'A').length,1); assert.strictEqual(R.dueFires(t({reminders:[sn]}),6000,{},'B').length,0); assert.strictEqual(R.nextFires(t({reminders:[sn]}),0,1,0,'B').length,0); assert.strictEqual(R.nextFires(t({reminders:[sn]}),0,1,0,'A').length,1);
// snooze (atMs)
assert.strictEqual(R.occurrences({kind:'once',atMs:5000},t(),1000,6000)[0],5000);
console.log('describe:',R.describe({kind:'weekly',weekday:1,time:'15:00'}),'|',R.describe({kind:'before',days:2,time:'15:00'}),'|',R.describe({kind:'every',everyHours:2,winFrom:'08:00',winTo:'20:00'}));
console.log('todas las pruebas de recordatorios pasan');
