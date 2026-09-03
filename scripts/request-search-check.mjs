// De verzoek-zoekflow, en de scheiding tussen Spotify-sessie en afspeelapparaat.
//
// Josh' bevinding: verzoek-blad openen, iets intypen, op zoeken drukken - er gebeurt niets.
// Gemeten oorzaak: #searchBtn stond op disabled, dus de klik bereikte searchSpotify() nooit
// en er ging geen enkele Spotify-aanroep uit. De knop wordt uitgezet door enable(false) in
// het foutpad van reconcile() in stability-core.js, dat een mislukte spelerinitialisatie
// behandelde alsof de hele Spotify-sessie weg was.
//
// Deze poort dekt twee dingen af:
//   A. de flow zelf: tekst intypen -> zoeken -> resultaten in de DOM
//   B. de scheiding: faalt alleen de speler, dan blijven zoeken en radioset bouwen bruikbaar
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const results = [];
const check = (naam, fn) => results.push([naam, fn]);

class Events {
  constructor() { this.listeners = new Map() }
  addEventListener(naam, fn) { const l = this.listeners.get(naam) || []; l.push(fn); this.listeners.set(naam, l) }
  removeEventListener() {}
  dispatchEvent(e) { for (const fn of this.listeners.get(e.type) || []) fn(e); return true }
}
class FakeCustomEvent { constructor(t, o = {}) { this.type = t; this.detail = o.detail } }
class FakeEvent { constructor(t) { this.type = t } }

function storage(initial = {}) {
  const v = new Map(Object.entries(initial));
  return {
    getItem: k => (v.has(k) ? v.get(k) : null),
    setItem: (k, x) => v.set(String(k), String(x)),
    removeItem: k => v.delete(k),
    clear: () => v.clear(),
  };
}

// Eén generieke fake node, zodat geen enkele getElementById null teruggeeft. app.js hangt
// zijn handlers op tientallen ids en zou anders al bij het laden struikelen.
function maakElement(id = '') {
  const el = {
    id, value: '', textContent: '', innerHTML: '', checked: false, disabled: false,
    dataset: {}, style: {}, children: [],
    classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)) }, remove(...c) { c.forEach(x => this._s.delete(x)) }, toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)) }, contains(c) { return this._s.has(c) } },
    appendChild(k) { el.children.push(k); return k },
    insertBefore(k) { el.children.push(k); return k },
    insertAdjacentElement(_, k) { el.children.push(k); return k },
    insertAdjacentHTML() {}, remove() {}, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    focus() {}, blur() {}, click() { if (typeof el.onclick === 'function') el.onclick(new FakeEvent('click')) },
    cloneNode() { const k = maakElement(el.id); k.disabled = el.disabled; return k },
    replaceWith() {},
  };
  return el;
}

/* ---------------- A. de zoekflow in app.js ---------------- */

function appHarness({ zoekAntwoord } = {}) {
  const bus = new Events();
  const els = {};
  const apiCalls = [];
  const document = {
    readyState: 'complete', hidden: false, visibilityState: 'visible',
    body: maakElement('body'), head: maakElement('head'),
    getElementById: id => (els[id] || (els[id] = maakElement(id))),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => maakElement(), addEventListener() {}, removeEventListener() {},
  };
  const context = {
    window: null, document,
    localStorage: storage({ jfm_client_id: 'testclient' }), sessionStorage: storage(),
    location: { origin: 'https://example.test', pathname: '/', search: '', href: 'https://example.test/' },
    history: { replaceState() {} },
    navigator: { onLine: true, serviceWorker: undefined },
    crypto: { getRandomValues: a => a },
    URLSearchParams, CustomEvent: FakeCustomEvent, Event: FakeEvent,
    fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 1)),
    clearTimeout: id => clearTimeout(id), setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, console, encodeURIComponent, decodeURIComponent,
  };
  Object.assign(context, {
    addEventListener: (...a) => bus.addEventListener(...a),
    dispatchEvent: (...a) => bus.dispatchEvent(...a),
  });
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('app.js'), context, { filename: 'app.js' });
  // api() is in app.js gedeclareerd en dus een eigenschap van de context; vervangen kan pas
  // hierna. searchSpotify() gebruikt de globale binding en pakt deze stub dus op.
  context.api = async path => { apiCalls.push(path); return zoekAntwoord ? zoekAntwoord(path) : null };
  return { context, els, apiCalls };
}

const spotifyZoekAntwoord = () => ({
  tracks: {
    items: [
      { id: 't1', uri: 'spotify:track:' + '1'.repeat(22), name: 'Levels', artists: [{ name: 'Avicii' }], album: { images: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] } },
      { id: 't2', uri: 'spotify:track:' + '2'.repeat(22), name: 'Say "Hello"', artists: [{ name: 'Artiest Een' }, { name: 'Artiest Twee' }], album: { images: [] } },
    ],
  },
});

check('A1. tekst intypen en op zoeken drukken levert een Spotify-zoekopdracht op', async () => {
  const { context, els, apiCalls } = appHarness({ zoekAntwoord: spotifyZoekAntwoord });
  els.searchInput.value = '  avicii levels  ';
  assert.equal(typeof els.searchBtn.onclick, 'function', 'de zoekknop moet een klikafhandeling hebben');
  els.searchBtn.click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(apiCalls.length, 1, 'de klik moet precies een Spotify-aanroep opleveren');
  assert.ok(apiCalls[0].startsWith('/search?type=track'), `verwacht een /search-aanroep, kreeg ${apiCalls[0]}`);
  assert.ok(apiCalls[0].includes(encodeURIComponent('avicii levels')), 'de ingetypte tekst moet getrimd worden meegestuurd');
});

check('A2. de zoekresultaten komen als aanklikbare regels in de DOM', async () => {
  const { els } = appHarness({ zoekAntwoord: spotifyZoekAntwoord });
  els.searchInput.value = 'avicii';
  els.searchBtn.click();
  await new Promise(r => setTimeout(r, 20));
  const html = els.searchResults.innerHTML;
  assert.ok(html.includes('class="result"'), 'elk resultaat moet een aanklikbare .result-regel zijn');
  assert.ok(html.includes('Levels') && html.includes('Avicii'), 'titel en artiest moeten zichtbaar zijn');
  assert.ok(html.includes('data-uri="spotify:track:' + '1'.repeat(22) + '"'), 'de track-uri moet in het data-attribuut staan');
  assert.equal((html.match(/class="result"/g) || []).length, 2, 'beide gevonden tracks horen getoond te worden');
});

check('A3. een titel met een aanhalingsteken wordt correct ge-escaped', async () => {
  // Bewaakt de entity-fix: &quot zonder puntkomma toonde letterlijk &quot in de titel.
  const { els } = appHarness({ zoekAntwoord: spotifyZoekAntwoord });
  els.searchInput.value = 'hello';
  els.searchBtn.click();
  await new Promise(r => setTimeout(r, 20));
  const html = els.searchResults.innerHTML;
  assert.ok(html.includes('Say &quot;Hello&quot;'), 'het aanhalingsteken moet als &quot; met puntkomma worden geschreven');
  assert.ok(!/&quot[^;]/.test(html), 'er mag geen enkele &quot zonder puntkomma in de uitvoer staan');
});

check('A4. een lege zoekopdracht doet niets, en geen resultaten meldt dat netjes', async () => {
  const leeg = appHarness({ zoekAntwoord: () => ({ tracks: { items: [] } }) });
  leeg.els.searchInput.value = '   ';
  leeg.els.searchBtn.click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(leeg.apiCalls.length, 0, 'een lege zoekopdracht mag geen Spotify-aanroep kosten');

  const geen = appHarness({ zoekAntwoord: () => ({ tracks: { items: [] } }) });
  geen.els.searchInput.value = 'bestaatniet';
  geen.els.searchBtn.click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(geen.apiCalls.length, 1, 'een echte zoekopdracht moet wel worden verstuurd');
  assert.ok(geen.els.searchResults.innerHTML.includes('Geen resultaten'), 'zonder treffers hoort er een melding te staan');
});

/* ---------------- B. sessie versus afspeelapparaat ---------------- */

function sdkHarness({ hasRefreshToken = true, spelerFaalt = true } = {}) {
  const bus = new Events();
  const els = {};
  const berichten = [];
  const document = {
    readyState: 'complete', hidden: false, visibilityState: 'visible',
    body: maakElement('body'), head: maakElement('head'),
    getElementById: id => (els[id] || (els[id] = maakElement(id))),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => maakElement(), addEventListener() {}, removeEventListener() {},
  };
  class Player {
    constructor() {}
    addListener() {}
    async connect() { if (spelerFaalt) throw Error('Spotify Web Player kon niet verbinden.'); return true }
    disconnect() {}
  }
  const context = {
    window: null, document,
    localStorage: storage({ jfm_client_id: 'testclient' }), sessionStorage: storage(),
    location: { search: '', pathname: '/', origin: 'https://example.test' },
    history: { replaceState() {} },
    navigator: { onLine: true },
    URLSearchParams, CustomEvent: FakeCustomEvent,
    spotifyClientId: 'testclient', token: 'token', refreshToken: 'refresh',
    ensure: async () => 'token',
    timedFetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    api: async () => ({ devices: [] }),
    setConnected() { for (const id of ['start', 'play', 'prev', 'next', 'djNow', 'skipTalk', 'searchBtn', 'rebuild']) document.getElementById(id).disabled = false },
    renderPlayback() {}, playback: null, saveToken() {},
    // Zonder Spotify-SDK zou initPlayer 20 seconden op een script wachten; met een Player die
    // meteen gooit doorloopt de ladder zijn vier pogingen en komt reconcile in zijn foutpad.
    Spotify: { Player },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 1)),
    clearTimeout: id => clearTimeout(id), setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, console,
  };
  Object.assign(context, {
    addEventListener: (...a) => bus.addEventListener(...a),
    dispatchEvent: (...a) => bus.dispatchEvent(...a),
    JFMPlaybackState: { patch() {}, ingest() {}, get: () => null, reset() {} },
    JFMAuth: { state: { hasAccessToken: hasRefreshToken, hasRefreshToken, expiresAt: Date.now() + 3600000 } },
  });
  context.window = context;
  // message() schrijft naar #jfmMessage of console; vang het op voor de assertie.
  vm.createContext(context);
  vm.runInContext(read('stability-core.js'), context, { filename: 'stability-core.js' });
  return { context, els, berichten };
}

check('B1. faalt alleen de speler, dan blijven zoeken en radioset bouwen bruikbaar', async () => {
  const { context, els } = sdkHarness({ hasRefreshToken: true, spelerFaalt: true });
  // reconcile() draait zelf op de bootroute. De harness versnelt alle timers, dus na een
  // paar ticks is de ladder doorlopen en heeft het foutpad gedraaid.
  await new Promise(r => setTimeout(r, 120));
  assert.equal(context.JFMSpotifySDK.deviceId, '', 'zonder werkende speler hoort er geen device te zijn');
  assert.ok(context.JFMSpotifySDK.health.bootAttempts >= 1, 'de spelerinitialisatie moet echt zijn geprobeerd');
  assert.equal(els.searchBtn.disabled, false, 'de zoekknop mag niet uitgaan omdat alleen de speler faalt');
  assert.equal(els.rebuild.disabled, false, 'een nieuwe radioset bouwen mag ook blijven werken');
});

check('B1b. zonder sessie blijft de zoekknop wel uit', async () => {
  const { context, els } = sdkHarness({ hasRefreshToken: false, spelerFaalt: true });
  await new Promise(r => setTimeout(r, 120));
  assert.equal(context.JFMSpotifySDK.deviceId, '', 'geen device');
  assert.equal(els.searchBtn.disabled, true, 'zonder geldige sessie hoort zoeken wel uit te staan');
});

check('B2. zonder geldige sessie gaat alles wel uit', async () => {
  const bron = read('stability-core.js');
  assert.ok(bron.includes('function sessionAlive()'), 'de sessiecontrole moet bestaan');
  assert.ok(bron.includes('if(sessionAlive())enableSessionControls(true)'),
    'het foutpad van reconcile moet de sessie-controls alleen terugzetten als de sessie leeft');
  assert.ok(bron.includes("const SESSION_CONTROLS=['searchBtn','rebuild']"),
    'alleen zoeken en radioset bouwen zijn sessie-controls; playback-knoppen blijven device-afhankelijk');
  assert.ok(bron.includes("hasRefreshToken"),
    'de sessiewaarheid moet uit JFMAuth komen, niet uit de CSS-klasse van de statuspil');
});

/* ---------------- C. de SDK-scripttag na een mislukte download ---------------- */

// Josh: de koppeling werkt alleen direct na opnieuw verbinden, en soms pas na een herlaad.
// loadSDK() maakte het tag #spotify-sdk-stable een keer aan en ruimde het nergens op. Faalde
// de download, dan vond elke volgende poging datzelfde dode tag en wachtte er 20 seconden op
// in plaats van opnieuw te downloaden. Alleen een verse pagina hielp dan nog.
function sdkTagHarness() {
  const bus = new Events();
  const els = {};
  const gemaakt = [];            // elk <script> dat is aangemaakt
  const inHead = new Map();      // wat er daadwerkelijk in de head hangt, op id
  const maakScript = () => {
    const node = maakElement('');
    node.dataset = {};
    node.remove = () => { inHead.delete(node.id) };
    gemaakt.push(node);
    return node;
  };
  const document = {
    readyState: 'complete', hidden: false, visibilityState: 'visible',
    body: maakElement('body'),
    head: { appendChild(node) { inHead.set(node.id, node); return node } },
    // Het SDK-tag bestaat alleen als het echt in de head hangt; anders null, net als in de
    // browser. Een generieke fallback zou loadSDK laten denken dat het tag al bestaat.
    getElementById: id => (inHead.has(id) ? inHead.get(id) : (id === 'spotify-sdk-stable' ? null : (els[id] || (els[id] = maakElement(id))))),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: tag => (tag === 'script' ? maakScript() : maakElement()),
    addEventListener() {}, removeEventListener() {},
  };
  const context = {
    window: null, document,
    localStorage: storage({ jfm_client_id: 'testclient' }), sessionStorage: storage(),
    location: { search: '', pathname: '/', origin: 'https://example.test' },
    history: { replaceState() {} }, navigator: { onLine: true },
    URLSearchParams, CustomEvent: FakeCustomEvent,
    spotifyClientId: 'testclient', token: 'token', refreshToken: 'refresh',
    ensure: async () => 'token', timedFetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    api: async () => ({ devices: [] }), setConnected() {}, renderPlayback() {}, playback: null, saveToken() {},
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 1)),
    clearTimeout: id => clearTimeout(id), setInterval: (fn, ms) => setInterval(fn, Math.max(Number(ms) || 1, 1)),
    clearInterval: id => clearInterval(id),
    Promise, Date, Math, JSON, console,
  };
  Object.assign(context, {
    addEventListener: (...a) => bus.addEventListener(...a), dispatchEvent: (...a) => bus.dispatchEvent(...a),
    JFMPlaybackState: { patch() {}, ingest() {}, get: () => null, reset() {} },
    JFMAuth: { state: { hasAccessToken: true, hasRefreshToken: true, expiresAt: Date.now() + 3600000 } },
  });
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('stability-core.js'), context, { filename: 'stability-core.js' });
  return { context, gemaakt, inHead };
}

check('C1. een mislukte SDK-download wordt bij een herpoging opnieuw gedownload', async () => {
  const { context, gemaakt, inHead } = sdkTagHarness();
  const poging = () => context.JFMSpotifySDK.init().catch(e => String(e && e.message || e));

  const eerste = poging();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(gemaakt.length, 1, 'de eerste poging moet het SDK-script aanmaken');
  assert.ok(inHead.has('spotify-sdk-stable'), 'het script hoort in de head te hangen');
  gemaakt[0].onerror();                                   // download mislukt
  assert.equal(await eerste, 'Spotify-speler kon niet laden.', 'de eerste poging hoort te falen');

  const tweede = poging();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(gemaakt.length, 2, 'een herpoging moet een NIEUW script aanmaken in plaats van op het dode te wachten');
  gemaakt[1].onerror();
  await tweede;
});

check('C2. een script dat nog laadt wordt niet weggegooid', async () => {
  // Alleen een tag die echt gefaald is mag vervangen worden; een trage download houden we.
  const { context, gemaakt } = sdkTagHarness();
  const eerste = context.JFMSpotifySDK.init().catch(() => 'mislukt');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(gemaakt.length, 1, 'eerste poging maakt het script aan');
  // Geen onerror: de download loopt nog. Een tweede poging hoort te wachten, niet te vervangen.
  const tweede = context.JFMSpotifySDK.init().catch(() => 'mislukt');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(gemaakt.length, 1, 'een nog lopende download mag niet worden afgebroken en vervangen');
  gemaakt[0].onerror();
  await Promise.all([eerste, tweede]);
});

check('C3. de opruiming staat expliciet in de broncode', () => {
  const bron = read('stability-core.js');
  assert.ok(bron.includes('jfmSdkFailed'), 'een gefaald SDK-script moet als zodanig gemarkeerd worden');
  assert.ok(bron.includes('markSdkFailed'), 'de markering hoort via een gedeelde helper te lopen');
  assert.ok(/if\(s&&s\.dataset&&s\.dataset\.jfmSdkFailed==='1'\)/.test(bron),
    'loadSDK moet een gefaald tag weggooien voordat het de poll-tak in gaat');
});

/* ---------------- runner ---------------- */

let geslaagd = 0;
for (const [naam, fn] of results) {
  try { await fn(); geslaagd++; console.log('PASS', naam) }
  catch (e) { console.error('FAIL', naam, '—', e?.stack || e); process.exitCode = 1 }
}
if (process.exitCode) process.exit(1);
console.log(`Verzoek-zoekflow: ${geslaagd}/${results.length} PASS — zoekopdracht, resultaten, escaping, sessie/device-scheiding en SDK-herpoging`);
