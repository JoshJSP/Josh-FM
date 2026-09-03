// Wat er over is van de modes-laag na het verwijderen van Time Machine, Chaos Mode en
// Afterparty (3 september 2026). Roadtrip was al eerder met pensioen gestuurd door de
// journey director van Car Mode, dus het kopje "MAIR Modes" had daarna geen enkele
// werkende modus meer over en is in zijn geheel verdwenen.
//
// mair-modes.js blijft wél bestaan: die levert de recap- en analytics-laag waar
// "Your Week on MAIR" op draait. Deze poort bewaakt precies dat deel, plus de belofte dat
// de verwijderde modi niet stilletjes terugkomen.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const src = read('mair-modes.js'), profile = read('mair-profile.js'), rotation = read('rotation-engine.js');
const builder = read('dj-context-builder.js'), writer = read('api/dj-writer.js');
const version = read('version.js'), sw = read('sw.js'), queue = read('queue-core.js');
const stationQueue = read('station-queue.js'), director = read('director.js');

function runtime(initial = {}, analytics = { events: [], sessions: [] }) {
  const store = new Map([
    ['mair_mode_state_v1', JSON.stringify(initial)],
    ['mair_mode_analytics_v1', JSON.stringify(analytics)],
  ]);
  const listeners = {};
  const localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const document = { body: { dataset: {} }, addEventListener: (n, f) => (listeners[n] ??= []).push(f), readyState: 'complete', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const context = {
    window: null, document, localStorage, sessionStorage: localStorage,
    CustomEvent: class { constructor(t, o = {}) { this.type = t; this.detail = o.detail } },
    addEventListener: (n, f) => (listeners[n] ??= []).push(f), dispatchEvent: () => true,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, console,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(src, context, { filename: 'mair-modes.js' });
  return { api: context.MAIRModeManager, window: context, store };
}

/* ---------------- recap: de motor onder Your Week on MAIR ---------------- */

const now = Date.now();
const recapRuntime = runtime({}, {
  events: [
    { at: now - 1000, type: 'track', track: 'Levels', artist: 'Avicii', year: 2011, station: 'mix', mode: 'normal' },
    { at: now - 900, type: 'track', track: 'Levels', artist: 'Avicii', year: 2011, station: 'mix', mode: 'normal' },
    { at: now - 800, type: 'skip', mode: 'normal' },
    { at: now - 700, type: 'request', mode: 'normal' },
    { at: now - 600, type: 'listen_minute', mode: 'normal' },
  ],
  sessions: [],
});
const week = recapRuntime.api.recap('weekly', now);
assert.equal(week.tracks, 2, 'de weekrecap telt gespeelde tracks');
assert.equal(week.topArtist, 'Avicii');
assert.equal(week.topTrack, 'Levels');
assert.equal(week.skips, 1);
assert.equal(week.requests, 1);
assert.equal(week.minutes, 1);

let recapArmed = 0;
recapRuntime.window.MAIRDJ = { armManual: () => { recapArmed++; return true } };
assert.equal(recapRuntime.api.requestRecap('weekly').ok, true, 'een recap kan worden aangevraagd');
assert.equal(recapArmed, 1);
assert.equal(recapRuntime.api.djContext().recap.topArtist, 'Avicii');

assert.equal(runtime().api.recap('weekly', now).tracks, 0, 'lege historie blijft eerlijk leeg');
const clearRuntime = runtime({}, { events: [{ at: now, type: 'track', track: 'Test', artist: 'MAIR' }], sessions: [] });
clearRuntime.api.clear();
assert.equal(clearRuntime.store.has('mair_mode_analytics_v1'), false, 'Wis lokale historie wist ook de mode-analytics');
assert.ok(src.lastIndexOf("record('listen_minute'") < src.lastIndexOf("if(state.mode==='normal')return"),
  'normale MAIR-playback telt mee voor Weekly');

/* ---------------- Your Week on MAIR blijft in het profiel ---------------- */

assert.ok(profile.includes('Your Week on MAIR') && profile.includes('mair-profile-week-grid'), 'Profiel mist de weekrecap');
assert.ok(!/periodButton|data-profile-period|monthly|yearly/.test(profile), 'Maand- en jaarrecap mogen niet terugkomen');

/* ---------------- de drie verwijderde modi komen niet terug ---------------- */

const verwijderd = ['time-machine', 'chaos', 'afterparty'];
for (const bestand of [['mair-modes.js', src], ['rotation-engine.js', rotation], ['queue-core.js', queue], ['station-queue.js', stationQueue], ['director.js', director], ['api/dj-writer.js', writer]]) {
  for (const modus of verwijderd) {
    assert.ok(!bestand[1].includes(modus), `${bestand[0]} verwijst nog naar ${modus}`);
  }
}
assert.ok(!fs.existsSync(new URL('../mair-modes-ui.js', import.meta.url)), 'de modes-UI hoort verwijderd te zijn');
assert.ok(!fs.existsSync(new URL('../mair-modes.css', import.meta.url)), 'de modes-styling hoort verwijderd te zijn');
assert.ok(!version.includes('mair-modes-ui.js') && !version.includes('mair-modes.css'), 'version.js laadt de modes-UI niet meer');
assert.ok(!sw.includes('mair-modes-ui.js') && !sw.includes('mair-modes.css'), 'de service worker cachet de modes-UI niet meer');
assert.ok(!queue.includes('modePolicy') && !queue.includes('MODE_TRACK_BLOCKED'), 'de jaar-eindpoort in queue-core is weg');

/* ---------------- wat blijft: mair-modes.js zelf en zijn koppelingen ---------------- */

assert.ok(version.includes('mair-modes.js') && sw.includes('./mair-modes.js'),
  'mair-modes.js blijft geladen en gecached voor de recap-laag');
assert.ok(rotation.includes('MAIRModeManager?.rotationScore'), 'de rotatie blijft de mode-score bevragen');
assert.ok(builder.includes('MAIRModeManager?.djContext'), 'de DJ-context blijft de mode-context bevragen');
assert.ok(writer.includes('MODE_INSTRUCTIONS'), 'de writer houdt zijn mode-instructies');

console.log('MAIR Modes: PASS — recap en Your Week intact, Time Machine, Chaos en Afterparty volledig verwijderd');
