// C-3: de verplichte eindpoort voor Time Machine.
// Productregel: bij jaar Y mogen alleen tracks uit Y, Y-1 en Y-2 worden geprogrammeerd.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const YEAR = 2012;
const results = [];
const check = (name, fn) => results.push([name, fn]);

class Events {
  constructor(){ this.listeners = new Map() }
  addEventListener(name, fn){ const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list) }
  dispatchEvent(event){ for (const fn of this.listeners.get(event.type) || []) fn(event); return true }
}
class FakeCustomEvent { constructor(type, options = {}){ this.type = type; this.detail = options.detail } }
function storage(initial = {}){
  const values = new Map(Object.entries(initial));
  return { getItem: k => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), has: k => values.has(k) };
}
const track = (id, year, extra = {}) => ({ id, uri: 'spotify:track:' + String(id).padStart(22, '0'), name: 'Track ' + id, artists: ['Artist ' + id], release: year ? `${year}-06-01` : '', ...extra });

/* ---------------- harness 1: MAIRModeManager + JFMQueue in één context ---------------- */

function gateHarness({ mode = 'time-machine', year = YEAR } = {}) {
  const bus = new Events(), elements = { queueInfo: { textContent: '', style: {} } }, apiCalls = [];
  const modeState = mode === 'normal'
    ? { mode: 'normal', options: {}, startedAt: 0, activeMs: 0, endsAfterMs: 0, sessionId: '' }
    : { mode, options: { year }, startedAt: 1, activeMs: 0, endsAfterMs: 0, sessionId: 'gate' };
  const localStorage = storage({ mair_mode_state_v1: JSON.stringify(modeState), jfm_music_channel_v1: 'mix', jfm_spotify_device_id: 'device-1' });
  const context = {
    window: null,
    document: { readyState: 'complete', body: { dataset: {} }, getElementById: id => elements[id] || null, addEventListener(){}, querySelectorAll: () => [] },
    localStorage, sessionStorage: storage(), CustomEvent: FakeCustomEvent,
    queue: [], playback: null,
    api: async (path, opt = {}) => { apiCalls.push({ path, opt }); if (path === '/me/player') return { item: { id: 'live', uri: 'spotify:track:' + '9'.repeat(22) }, is_playing: true, progress_ms: 1000, device: { id: 'device-1' } }; if (path === '/me/player/queue') return { queue: [] }; return null },
    setTimeout: () => 1, clearTimeout(){}, setInterval: () => 1, clearInterval(){},
    Promise, Date, Math, JSON, console,
  };
  Object.assign(context, { addEventListener: (...a) => bus.addEventListener(...a), dispatchEvent: (...a) => bus.dispatchEvent(...a) });
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('mair-modes.js'), context, { filename: 'mair-modes.js' });
  vm.runInContext(read('queue-core.js'), context, { filename: 'queue-core.js' });
  return { context, apiCalls };
}

check('a. 2012 accepteert 2010, 2011 en 2012', () => {
  const { context } = gateHarness();
  const committed = context.JFMQueue.commit([track(1, 2010), track(2, 2011), track(3, 2012)], { source: 'test', reason: 'in-range' });
  assert.deepEqual(Array.from(committed, t => t.id), [1, 2, 3], 'elk toegestaan jaar moet de eindpoort passeren');
  assert.equal(context.JFMQueue.state().modeGate.range, '2010-2012');
});

check('b. 2009 en 2013 worden geweigerd door de eindpoort', () => {
  const { context } = gateHarness();
  const committed = context.JFMQueue.commit([track(1, 2009), track(2, 2011), track(3, 2013), track(4, 2012)], { source: 'test', reason: 'mixed' });
  assert.deepEqual(Array.from(committed, t => t.id), [2, 4], 'alleen Y-2 tot en met Y mag overblijven');
  const gate = context.JFMQueue.log().find(x => x.stage === 'mode-gate');
  assert.equal(gate?.removed, 2, 'de poort moet zichtbaar traceren wat is verwijderd');
});

check('b2. zonder actieve Time Machine laat de poort alles door', () => {
  const { context } = gateHarness({ mode: 'normal' });
  const committed = context.JFMQueue.commit([track(1, 1998), track(2, 2024)], { source: 'test', reason: 'normal' });
  assert.equal(committed.length, 2, 'de poort mag buiten een actieve modus niets filteren');
  assert.equal(context.JFMQueue.state().modeGate, null);
});

check('e. compilatie, remaster en Various Artists tellen niet als origineel jaar', () => {
  const { context } = gateHarness();
  const modes = context.MAIRModeManager;
  const compilation = track(10, 2011, { albumType: 'compilation', album: 'Zomerhits 2011' });
  const various = track(11, 2011, { albumArtists: ['Various Artists'], album: 'Top 100' });
  const named = track(12, 2011, { album: 'The Best Of Artist 12' });
  const remaster = track(13, 2011, { name: 'Track 13 - 2011 Remaster', album: 'Debut' });
  const genuine = track(14, 2011, { albumType: 'album', album: 'Debut' });
  for (const t of [compilation, various, named, remaster]) {
    assert.equal(modes.originalYear(t), 0, `onbetrouwbare release moet 0 opleveren: ${t.album}`);
    assert.equal(modes.timeMachineAllows(t, YEAR), false, 'een onbetrouwbaar jaar mag Time Machine nooit passeren');
  }
  assert.equal(modes.originalYear(genuine), 2011, 'een gewoon studioalbum houdt zijn jaar');
  const committed = context.JFMQueue.commit([compilation, various, named, remaster, genuine], { source: 'test', reason: 'metadata' });
  assert.deepEqual(Array.from(committed, t => t.id), [14], 'alleen de betrouwbare 2011-track mag worden geprogrammeerd');
});

check('f. lege pool geeft een gecontroleerde fout in plaats van verkeerde jaren', () => {
  const { context } = gateHarness();
  const before = context.JFMQueue.current().length;
  assert.throws(
    () => context.JFMQueue.commit([track(1, 1999), track(2, 2024)], { source: 'test', reason: 'all-out-of-range' }),
    error => {
      assert.equal(error.code, 'MODE_POOL_EMPTY', 'de fout moet herkenbaar zijn voor aanroepers');
      assert.equal(error.year, YEAR);
      assert.match(error.message, /2010-2012/, 'de melding moet het toegestane bereik noemen');
      return true;
    },
  );
  assert.equal(context.JFMQueue.current().length, before, 'een geweigerde commit mag de bestaande wachtrij niet aantasten');
});

check('g. verzoeken volgen dezelfde jaarregel en falen zichtbaar', async () => {
  const { context, apiCalls } = gateHarness();
  await assert.rejects(
    () => context.JFMQueue.programNext(track(20, 2015), 'request-arm'),
    error => {
      assert.equal(error.code, 'MODE_TRACK_BLOCKED', 'een geweigerd verzoek moet een expliciete code hebben');
      assert.match(error.message, /alleen muziek uit 2010-2012/);
      return true;
    },
  );
  assert.equal(apiCalls.length, 0, 'een geblokkeerd verzoek mag geen enkele Spotify-aanroep kosten');
  await context.JFMQueue.commit([track(21, 2011)], { source: 'test', reason: 'seed' });
  await context.JFMQueue.programNext(track(21, 2011), 'request-arm').catch(() => {});
  assert.ok(apiCalls.some(c => c.path === '/me/player'), 'een verzoek binnen het bereik moet de poort wel passeren');
});

/* ---------------- harness 2: director fallback ---------------- */

check('c. director fallback laat geen verkeerde jaren door', () => {
  const bus = new Events();
  const allows = t => { const y = Number(String(t?.release || '').slice(0, 4)) || 0; return y >= YEAR - 2 && y <= YEAR };
  const context = {
    window: null,
    document: { readyState: 'complete', getElementById: () => null, querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style: {}, setAttribute(){}, appendChild(){}, insertAdjacentElement(){}, addEventListener(){}, querySelector: () => null }), head: { appendChild(){} }, body: { appendChild(){}, style: {} } },
    localStorage: storage({ jfm_music_channel_v1: 'mix' }), sessionStorage: storage(), CustomEvent: FakeCustomEvent,
    queue: [], playback: null, buildSet: async () => [], trackObj: t => t, skipMap: () => ({}), esc: s => String(s), api: async () => ({}),
    setTimeout: () => 1, clearTimeout(){}, setInterval: () => 1, clearInterval(){}, Promise, Date, Math, JSON, console,
  };
  Object.assign(context, { addEventListener: (...a) => bus.addEventListener(...a), dispatchEvent: (...a) => bus.dispatchEvent(...a) });
  // plan() geeft bewust te weinig terug, precies de situatie die naar de fallback schakelt
  context.JFMRotation = { plan: pool => pool.filter(allows).slice(0, 2), eligible: allows, isHardBlocked: () => false, annotate: t => t, score: () => 0, reason: () => '', category: () => 'Familiar', state: () => ({ mode: 'mair' }) };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('director.js'), context, { filename: 'director.js' });

  const mixed = [track(1, 2011), track(2, 1998), track(3, 2012), track(4, 2020), track(5, 2010)];
  const planned = context.JFMProgramDirector.directWithContext(mixed, []);
  assert.ok(planned.length > 0, 'de fallback moet nog steeds een geldige volgorde opleveren');
  assert.ok(planned.every(allows), 'de director fallback mag geen enkel jaar buiten Y-2..Y doorlaten');
  assert.deepEqual(Array.from(planned, t => t.id).sort(), [1, 3, 5], 'precies de drie toegestane tracks blijven over');

  const onlyInvalid = context.JFMProgramDirector.directWithContext([track(6, 1999), track(7, 2024)], []);
  assert.equal(onlyInvalid.length, 0, 'zonder geldige jaren levert de fallback een lege lijst in plaats van verkeerde tracks');
});

/* ---------------- harness 3: continuïteitsrotatie ---------------- */

function rotationHarness(generated, { modeManager = null, year = YEAR } = {}) {
  const bus = new Events(), elements = { queueInfo: { textContent: '', style: {} } }, commits = [];
  const allows = t => { const y = Number(String(t?.release || '').slice(0, 4)) || 0; return y >= year - 2 && y <= year };
  const authored = [1, 2, 3, 4, 5, 6, 7, 8].map((id, i) => track(id, year - (i % 3)));
  const context = {
    window: null,
    document: { getElementById: id => elements[id] || null },
    localStorage: storage({ jfm_music_channel_v1: 'mix', jfm_spotify_device_id: 'device-1' }), sessionStorage: storage(), CustomEvent: FakeCustomEvent,
    queue: authored, playback: { item: { id: 1 } },
    api: async () => ({ queue: [] }),
    setTimeout: (fn, ms = 0) => { if (Number(ms) <= 200) queueMicrotask(fn); return 1 }, clearTimeout(){}, setInterval: () => 1, clearInterval(){},
    Promise, Date, Math, JSON, console,
  };
  Object.assign(context, {
    addEventListener: (...a) => bus.addEventListener(...a), dispatchEvent: (...a) => bus.dispatchEvent(...a),
    JFMQueue: { current: () => context.queue, buildActive: async () => generated, commit: (list) => { commits.push(list); return list } },
    JFMRotation: { eligible: allows },
    JFMPlaybackState: { get: () => ({ trackId: 1 }) },
  });
  if (modeManager) context.MAIRModeManager = modeManager;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('station-queue.js'), context, { filename: 'station-queue.js' });
  return { context, commits, allows };
}

check('d. prepareNextRotation committeert geen tracks buiten het bereik', async () => {
  const { context, commits, allows } = rotationHarness([track(20, 2011), track(21, 1997), track(22, 2012), track(23, 2023), track(24, 2010)]);
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'een rotatie met geldige kandidaten moet slagen');
  assert.equal(commits.length, 1, 'de rotatie commit precies één keer');
  assert.ok(commits[0].every(allows), 'geen enkele gecommitte track mag buiten Y-2..Y vallen');
  assert.ok(commits[0].some(t => t.id === 20) && commits[0].some(t => t.id === 24), 'de geldige nieuwe tracks moeten wel worden toegevoegd');
  assert.ok(!commits[0].some(t => [21, 23].includes(t.id)), 'de ongeldige jaren mogen nergens in de commit staan');
});

check('f2. rotatie zonder geldige jaren commit niets in plaats van verkeerde jaren', async () => {
  const { context, commits } = rotationHarness([track(30, 1995), track(31, 2024)]);
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), false, 'zonder geldige kandidaten mislukt de rotatie gecontroleerd');
  assert.equal(commits.length, 0, 'er mag dan niets worden gecommit');
  const log = context.JFMStationQueueLog || [];
  assert.ok(log.some(x => x.stage === 'rotation-build-empty'), 'de lege rotatie moet zichtbaar zijn in de trace');
});

// De aanvulling tijdens een actieve modus. Het jaarfilter is waterdicht, maar de gewone
// persoonlijke bron kent het jaarvenster niet: daar overleeft vrijwel niets het filter, elke
// rotatie levert dan nul kandidaten en de queue groeit niet meer. Zodra de Spotify-context
// leeg is kiest Spotify zelf verder, buiten het venster. Daarom moet de rotatie tijdens een
// modus uit de pool van die modus putten.
const timeMachineManager = (pool, { onPoolFor } = {}) => ({
  state: () => ({ mode: 'time-machine', options: { year: YEAR } }),
  poolFor: async (mode, options) => { onPoolFor?.(mode, options); if (pool instanceof Error) throw pool; return pool },
});

check('h. tijdens Time Machine vult de rotatie aan uit de modus-pool', async () => {
  let gevraagd = null;
  const persoonlijk = [track(40, 2019), track(41, 2021), track(42, 2023)]; // volledig buiten het venster
  const modusPool = [track(50, 2012), track(51, 2011), track(52, 2010)];
  const { context, commits } = rotationHarness(persoonlijk, {
    modeManager: timeMachineManager(modusPool, { onPoolFor: (mode, options) => { gevraagd = { mode, options } } }),
  });
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'met een gevulde modus-pool moet de rotatie slagen');
  assert.deepEqual(gevraagd, { mode: 'time-machine', options: { year: YEAR } }, 'poolFor wordt met de actieve modus en opties aangeroepen');
  assert.equal(commits.length, 1, 'de rotatie commit precies één keer');
  assert.ok(commits[0].some(t => [50, 51, 52].includes(t.id)), 'de nieuwe tracks moeten uit de modus-pool komen');
  assert.ok(!commits[0].some(t => [40, 41, 42].includes(t.id)), 'geen enkele track uit de persoonlijke bron mag erin staan');
  const log = context.JFMStationQueueLog || [];
  assert.ok(log.some(x => x.stage === 'mode-pool-used'), 'het gebruik van de modus-pool moet traceerbaar zijn');
});

check('i. zonder actieve modus blijft de persoonlijke bron de bron', async () => {
  let aangeroepen = false;
  const { context, commits } = rotationHarness([track(60, 2011), track(61, 2012)], {
    modeManager: { state: () => ({ mode: 'normal', options: {} }), poolFor: async () => { aangeroepen = true; return [track(70, 2012)] } },
  });
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'een gewone rotatie moet blijven werken');
  assert.equal(aangeroepen, false, 'poolFor mag buiten een modus niet worden aangeroepen');
  assert.ok(commits[0].some(t => [60, 61].includes(t.id)), 'de persoonlijke bron blijft de bron in normale modus');
});

check('j. een falende modus-pool valt terug op het oude gedrag in plaats van te breken', async () => {
  const { context, commits } = rotationHarness([track(80, 2011), track(81, 2012)], {
    modeManager: timeMachineManager(new Error('Spotify-zoekopdracht mislukt')),
  });
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'een mislukte modus-pool mag de rotatie niet stukmaken');
  assert.ok(commits[0].some(t => [80, 81].includes(t.id)), 'de rotatie valt terug op de persoonlijke bron');
  const log = context.JFMStationQueueLog || [];
  assert.ok(log.some(x => x.stage === 'mode-pool-failed'), 'de mislukking moet zichtbaar zijn in de trace');
});

// Diepere gevallen rond de aanvulling: andere jaartallen, dubbels, en een modus-pool
// die zelf iets buiten het venster aanlevert.
check('k. de aanvulling werkt voor elk gekozen jaar, niet alleen 2012', async () => {
  for (const jaar of [1995, 2005, 2024]) {
    const buiten = [track(200, jaar + 5), track(201, jaar - 9)];
    const pool = [track(210, jaar), track(211, jaar - 1), track(212, jaar - 2)];
    const { context, commits } = rotationHarness(buiten, {
      year: jaar,
      modeManager: { state: () => ({ mode: 'time-machine', options: { year: jaar } }), poolFor: async () => pool },
    });
    assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, `rotatie moet slagen voor ${jaar}`);
    assert.equal(commits.length, 1, `precies een commit voor ${jaar}`);
    const jaren = commits[0].map(t => Number(String(t.release).slice(0, 4)));
    assert.ok(jaren.every(y => y >= jaar - 2 && y <= jaar), `alle tracks moeten binnen ${jaar - 2}-${jaar} vallen`);
    assert.ok(commits[0].some(t => [210, 211, 212].includes(t.id)), `de modus-pool moet ${jaar} aanvullen`);
  }
});

check('l. tracks die al in de wachtrij staan komen er niet nog een keer bij', async () => {
  // De harness heeft tracks 1..8 als bestaande set; de pool biedt 2 en 5 opnieuw aan.
  const pool = [track(2, YEAR), track(5, YEAR), track(90, YEAR - 1)];
  const { context, commits } = rotationHarness([], {
    modeManager: { state: () => ({ mode: 'time-machine', options: { year: YEAR } }), poolFor: async () => pool },
  });
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'de rotatie moet slagen op de enige nieuwe track');
  const ids = commits[0].map(t => t.id);
  // Let op: deze arrays komen uit de vm-context en hebben dus het Array.prototype van een
  // ander realm. assert.deepEqual vergelijkt prototypes en faalt daarop, ook op twee lege
  // arrays. Vergelijk hier dus op lengte, niet op vorm.
  const dubbel = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.equal(dubbel.length, 0, `geen enkele track mag dubbel in de wachtrij staan (dubbel: ${dubbel.join(',')})`);
  assert.ok(ids.includes(90), 'de nieuwe track uit de modus-pool moet er wel bij');
});

check('m. een modus-pool met vervuiling wordt alsnog op jaar gefilterd', async () => {
  // poolFor hoort al te filteren, maar als daar ooit iets doorheen glipt mag de rotatie
  // dat niet klakkeloos committen.
  const vervuild = [track(300, YEAR), track(301, 1980), track(302, YEAR - 2), track(303, 2030)];
  const { context, commits } = rotationHarness([], {
    modeManager: { state: () => ({ mode: 'time-machine', options: { year: YEAR } }), poolFor: async () => vervuild },
  });
  assert.equal(await context.JFMStationQueue.prepareNextRotation('test'), true, 'de geldige tracks moeten wel doorkomen');
  const ids = commits[0].map(t => t.id);
  assert.ok(ids.includes(300) && ids.includes(302), 'de tracks binnen het venster moeten worden toegevoegd');
  assert.ok(!ids.includes(301) && !ids.includes(303), 'de tracks buiten het venster mogen nergens in de commit staan');
});

/* ---------------- runner ---------------- */

let passed = 0;
for (const [name, fn] of results) {
  try { await fn(); passed++; console.log('PASS', name) }
  catch (error) { console.error('FAIL', name, '—', error?.stack || error); process.exitCode = 1 }
}
if (process.exitCode) process.exit(1);
console.log(`Time Machine gate: ${passed}/${results.length} PASS — eindpoort, director fallback, rotatie, metadata en requests`);
