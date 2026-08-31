// C-4: elke actieve bootasset staat in de service-worker CORE-cache, de installatie is
// tolerant voor niet-kritieke assets, en de Car Mode-boot overleeft een ontbrekende module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { RELEASE_CACHE, RELEASE_CACHE_DECLARATION } from './release-cache.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const exists = name => fs.existsSync(new URL(`../${name}`, import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, fn) => results.push([name, fn]);

const sw = read('sw.js');
const integration = read('mair-car-sleep-integration.js');
const rel = p => String(p || '').replace(/^\.\//, '').split('?')[0];
const CORE = new Set([...sw.matchAll(/'(\.\/[^']+)'/g)].map(m => rel(m[1])));
const CRITICAL = [...(/const CRITICAL=\[([\s\S]*?)\];/.exec(sw)?.[1] || '').matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);

// De RUNTIME_ASSETS-tabel is sinds C-4 de enige plek waar Car Mode/Sleep/Passenger hun
// bijgeladen assets declareren, dus die tabel is de bron voor deze controle.
const runtimeAssets = [...(/const RUNTIME_ASSETS=\[([\s\S]*?)\n\];/.exec(integration)?.[1] || '')
  .matchAll(/\['(?:style|script)','([^']+)','[^']+'\]/g)].map(m => m[1]);

check('a. elke Car Mode/Sleep/Passenger-asset uit RUNTIME_ASSETS staat in CORE', () => {
  assert.equal(runtimeAssets.length, 14, 'de tabel moet alle veertien bijgeladen assets bevatten');
  for (const asset of runtimeAssets) {
    assert.ok(exists(asset), `gedeclareerde asset bestaat niet op schijf: ${asset}`);
    assert.ok(CORE.has(asset), `RUNTIME_ASSETS-asset ontbreekt in de service-worker CORE-cache: ${asset}`);
  }
});

check('a2. de volledige bootgraaf van index.html staat in CORE', () => {
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/g,
    /<link[^>]+href=["']([^"']+\.css[^"']*)["']/g,
    /loadScript\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g,
    /loadScript\(\s*['"]([^'"]+\.js[^'"]*)['"]\s*,\s*['"][^'"]*['"]/g,
    /loadStyle\(\s*['"]([^'"]+)['"]/g,
    /addSyncScript\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g,
    /addStyle\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g,
    /load\(\s*['"]([^'"]+\.js[^'"]*)['"]\s*,\s*['"][^'"]*['"]/g,
    /load\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+\.js[^'"]*)['"]/g,
    /\.src\s*=\s*['"]([^'"]+\.js[^'"]*)['"]/g,
    /\.href\s*=\s*['"]([^'"]+\.css[^'"]*)['"]/g,
  ];
  const seen = new Set(['index.html']);
  const queue = ['index.html'];
  const missing = [];
  while (queue.length) {
    const file = queue.shift();
    let source;
    try { source = read(file) } catch { continue }
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const raw = String(match[1] || '');
        if (/^https?:/i.test(raw) || raw.startsWith('data:')) continue;
        const asset = rel(raw);
        if (!/\.(js|css)$/.test(asset) || !exists(asset)) continue;
        if (!CORE.has(asset)) missing.push(`${asset} (geladen door ${file})`);
        if (asset.endsWith('.js') && !seen.has(asset)) { seen.add(asset); queue.push(asset) }
      }
    }
  }
  assert.deepEqual(missing, [], 'elke asset die de boot daadwerkelijk laadt hoort in CORE te staan');
  assert.ok(seen.size > 80, `de bootgraaf moet realistisch groot zijn, nu ${seen.size} bestanden`);
});

check('a3. elk CORE-pad bestaat op schijf', () => {
  const missing = [...CORE].filter(p => p !== '' && !exists(p));
  assert.deepEqual(missing, [], 'een CORE-pad zonder bestand breekt de installatie of laat een gat vallen');
});

check('f. mair-dj-cadence-fix.js is via de cache beschikbaar', () => {
  assert.ok(exists('mair-dj-cadence-fix.js'));
  assert.ok(CORE.has('mair-dj-cadence-fix.js'), 'de DJ-cadansgarantie moet offline beschikbaar zijn');
  assert.ok(read('dj-now-queue.js').includes('mair-dj-cadence-fix.js'), 'de cadansfix hoort door de DJ-bootstrap geladen te worden');
});

check('g. de cacheversie loopt via de centrale C-1-bron en blijft consistent', () => {
  assert.ok(sw.includes(RELEASE_CACHE_DECLARATION), 'sw.js moet de centrale cacheversie declareren');
  assert.ok(read('api/version.js').includes(`cache:'${RELEASE_CACHE}'`), 'api/version.js moet dezelfde cacheversie melden');
  const stale = ['mair-v133-car-mode-nav-20260830', 'mair-v134-white-screen-recovery-20260830'].filter(v => sw.includes(v) || read('api/version.js').includes(v));
  assert.deepEqual(stale, [], 'er mag geen verouderde cacheversie achterblijven');
});

/* ---------------- service-worker installatie ---------------- */

function swHarness({ unavailable = [] } = {}) {
  const put = [], fetched = [];
  const cache = { put: async (p) => { put.push(rel(String(p))) }, match: async () => null, delete: async () => true, keys: async () => [] };
  const self = { addEventListener(){}, skipWaiting(){}, clients: { claim: async () => true } };
  const context = {
    self, caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (p) => { const path = rel(String(p)); fetched.push(path); const ok = !unavailable.includes(path); return { ok, status: ok ? 200 : 404, clone(){ return this } } },
    Promise, Error, URL, setTimeout, clearTimeout, AbortController, console,
  };
  context.self = self; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(sw, context, { filename: 'sw.js' });
  return { context, put, fetched };
}

check('b. een ontbrekende niet-kritieke Car Mode-module laat de installatie niet falen', async () => {
  const { context, put } = swHarness({ unavailable: ['mair-car-70-30.js', 'mair-passenger-mode.js'] });
  await context.cacheCore();
  assert.ok(!put.includes('mair-car-70-30.js'), 'een 404 mag niet in de cache belanden');
  assert.ok(put.includes('mair-car-autofit.js'), 'de overige Car Mode-assets moeten wel gecached worden');
  assert.ok(put.includes('index.html') && put.includes('playback-primary.js'), 'de kern moet onaangetast gecached zijn');
  assert.ok(put.length > 100, `de installatie moet vrijwel alles cachen, nu ${put.length}`);
});

check('c. een ontbrekende echte kernasset laat de installatie wel falen', async () => {
  for (const critical of ['index.html', 'app.js', 'playback-primary.js', 'styles.css']) {
    const { context } = swHarness({ unavailable: [critical] });
    await assert.rejects(() => context.cacheCore(), error => {
      assert.match(error.message, /^critical-cache-failed:/, 'de fout moet herkenbaar zijn');
      assert.match(error.message, new RegExp(critical.replace('.', '\\.')), 'de fout moet het ontbrekende bestand noemen');
      return true;
    }, `${critical} hoort de installatie te laten falen`);
  }
});

check('c2. CRITICAL blijft beperkt tot de minimale app-kern', () => {
  assert.deepEqual(CRITICAL, ['./', './index.html', './styles.css', './version.js', './app.js', './spotify-test-config.js', './stability-core.js', './playback-state.js', './playback-primary.js'],
    'CRITICAL mag alleen bevatten wat nodig is om te booten en muziek te kunnen starten');
  for (const optional of ['./mair-test-lab.js', './mair-test-simulator.js', './mair-observability.js', './mair-car-sleep-integration.js', './prototypes/mair-car-mode-wave.js', './mair-dj-v2.js', './mair-ux-v1.css'])
    assert.ok(!CRITICAL.includes(optional), `${optional} mag de installatie niet kunnen laten mislukken`);
});

/* ---------------- Car Mode boot ---------------- */

// Wacht tot boot() zijn API heeft geregistreerd in plaats van op een vaste tijd te gokken.
async function waitForBoot(harness, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (harness.context.MAIRCarSleepIntegration) return true; await sleep(10) }
  return false;
}

function bootHarness({ unavailable = [] } = {}) {
  const loaded = [], appended = [], listeners = new Map();
  const elements = {};
  const makeElement = (tag) => {
    const el = {
      tag, id: '', className: '', innerHTML: '', textContent: '', style: {}, attributes: {}, dataset: {},
      setAttribute(k, v){ this.attributes[k] = String(v); if (k === 'id') this.id = String(v) },
      getAttribute(k){ return this.attributes[k] ?? null },
      removeAttribute(k){ delete this.attributes[k] },
      addEventListener(){}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
      appendChild(child){ appended.push(child); if (child?.id) elements[child.id] = child; return child },
      insertAdjacentElement(_pos, child){ appended.push(child); if (child?.id) elements[child.id] = child; return child },
      insertAdjacentHTML(){}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, remove(){}, contains: () => false,
      onload: null, onerror: null,
    };
    return el;
  };
  const head = {
    appendChild(el){
      const src = rel(el.attributes?.src || el.attributes?.href || '');
      setTimeout(() => { if (unavailable.includes(src)) el.onerror?.(new Error('load failed')); else { loaded.push(src); el.onload?.() } }, 0);
      return el;
    },
  };
  elements['tab-radio'] = makeElement('section');
  const context = {
    window: null,
    document: { readyState: 'complete', head, body: makeElement('body'), getElementById: id => elements[id] || null, createElement: makeElement, querySelector: () => null, querySelectorAll: () => [], addEventListener(){} },
    navigator: { geolocation: { getCurrentPosition(){}, watchPosition(){}, clearWatch(){} } },
    screen: { orientation: { lock: async () => true } },
    MutationObserver: class { constructor(fn){ this.fn = fn } observe(){} disconnect(){} },
    CustomEvent: class { constructor(type, options = {}){ this.type = type; this.detail = options.detail } },
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval(){}, queueMicrotask,
    Promise, Object, Error, Date, String, Number, Array, JSON, console,
  };
  context.addEventListener = (name, fn) => { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list) };
  context.dispatchEvent = (event) => { for (const fn of listeners.get(event.type) || []) fn(event); return true };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(integration, context, { filename: 'mair-car-sleep-integration.js' });
  return { context, loaded, elements };
}

check('d/e. boot gaat door na een ontbrekende module en bereikt altijd ensureLauncher', async () => {
  const healthy = bootHarness();
  assert.ok(await waitForBoot(healthy), 'de integratie-API moet bestaan na een gezonde boot');
  assert.equal(healthy.context.MAIRCarSleepIntegration.status().bootFailures.length, 0, 'een gezonde boot kent geen failures');
  assert.equal(healthy.loaded.length, 14, 'alle veertien assets moeten geladen zijn');
  assert.ok(healthy.elements.mairCarModeOpen, 'ensureLauncher moet de Car Mode-knop plaatsen');

  // een module die vroeg in de reeks faalt mag de rest niet stoppen
  const broken = bootHarness({ unavailable: ['mair-sleep.js', 'mair-car-70-30.js'] });
  assert.ok(await waitForBoot(broken), 'de integratie-API moet ook bestaan als modules ontbreken');
  const status = broken.context.MAIRCarSleepIntegration.status();
  assert.deepEqual(Array.from(status.bootFailures, x => x.stage).sort(), ['mair-car-70-30.js', 'mair-sleep.js'], 'elke fout moet per module worden gerapporteerd');
  assert.equal(broken.loaded.length, 12, 'de overige twaalf assets moeten alsnog geladen zijn');
  assert.ok(broken.loaded.includes('mair-car-menu-sticky.js'), 'modules na de fout moeten nog steeds laden');
  assert.ok(broken.loaded.includes('prototypes/mair-car-mode-wave.js'), 'de Car Mode-runtime zelf moet nog steeds laden');
  assert.ok(broken.elements.mairCarModeOpen, 'ensureLauncher moet ook na een mislukte module worden bereikt');
});

check('d2. zelfs als elke bijgeladen module faalt, blijft de launcher bereikbaar', async () => {
  const dead = bootHarness({ unavailable: runtimeAssets });
  assert.ok(await waitForBoot(dead), 'de integratie-API moet bestaan');
  const status = dead.context.MAIRCarSleepIntegration.status();
  assert.equal(status.bootFailures.length, 14, 'alle veertien fouten moeten zichtbaar zijn');
  assert.equal(dead.loaded.length, 0, 'er mag niets geladen zijn in dit scenario');
  assert.ok(dead.elements.mairCarModeOpen, 'de Car Mode-ingang mag nooit verdwijnen door ontbrekende modules');
});

/* ---------------- runner ---------------- */

let passed = 0;
for (const [name, fn] of results) {
  try { await fn(); passed++; console.log('PASS', name) }
  catch (error) { console.error('FAIL', name, '—', error?.stack || error); process.exitCode = 1 }
}
if (process.exitCode) process.exit(1);
console.log(`Car Mode cache/boot: ${passed}/${results.length} PASS — CORE-dekking, tolerante installatie, minimale CRITICAL en fouttolerante boot`);
