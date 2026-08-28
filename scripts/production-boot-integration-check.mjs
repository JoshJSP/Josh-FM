import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const cleanAsset = src => String(src || '').replace(/^\.\//, '').split('?')[0];

function indexScriptOrder() {
  return [...read('index.html').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => cleanAsset(match[1]));
}

function loaderOrder(sourceName, callName, assetArgument) {
  const source = read(sourceName);
  const pattern = new RegExp(`${callName}\\(([^)]*)\\)`, 'g');
  return [...source.matchAll(pattern)]
    .map(match => [...match[1].matchAll(/["']([^"']+)["']/g)][assetArgument]?.[1])
    .filter(Boolean)
    .map(cleanAsset);
}

function requireOrder(items, before, after, owner) {
  const beforeIndex = items.indexOf(before);
  const afterIndex = items.indexOf(after);
  if (beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex) {
    throw new Error(`${owner} does not load ${before} before ${after}`);
  }
}

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key))
  };
}

function browserContext() {
  const listeners = new Map();
  const timers = [];
  const addListener = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  };
  const sandbox = {
    console,
    localStorage: storage(),
    sessionStorage: storage(),
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document: {
      readyState: 'complete',
      getElementById: () => null,
      addEventListener: addListener
    },
    addEventListener: addListener,
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
      return true;
    },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return {
    window: sandbox,
    run(name) {
      vm.runInContext(read(name), sandbox, { filename: name });
    },
    drainTimers() {
      let count = 0;
      while (timers.length) {
        if (++count > 50) throw new Error('production boot scheduled too many timers');
        timers.shift()();
      }
    }
  };
}

const checks = [];
function check(name, test) {
  try {
    test();
    checks.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, pass: false, error });
    console.error(`FAIL ${name}: ${error?.message || error}`);
  }
}

check('production manifests preserve the audited DJ load order', () => {
  const page = indexScriptOrder();
  requireOrder(page, 'version.js', 'dj-now-queue.js', 'index.html');

  const early = loaderOrder('version.js', 'addSyncScript', 1);
  if (!early.includes('dj-memory.js') || early.includes('mair-dj-memory.js')) {
    throw new Error('version.js must load only the authoritative dj-memory.js owner');
  }

  const djBoot = loaderOrder('dj-now-queue.js', 'load', 0);
  requireOrder(djBoot, 'dj-memory.js', 'mair-dj-cadence-fix.js', 'dj-now-queue.js');
});

check('final MAIRDJMemory owner exposes snapshot/observeTrack/metric/commit', () => {
  const boot = browserContext();
  boot.run('mair-dj-memory.js');
  boot.run('dj-memory.js');

  const memory = boot.window.MAIRDJMemory;
  const required = ['snapshot', 'observeTrack', 'metric', 'commit'];
  const missing = required.filter(method => typeof memory?.[method] !== 'function');
  if (missing.length) {
    throw new Error(`production owner ${memory?.version || '<unknown>'} is missing ${missing.join(', ')}`);
  }
  if (memory.owner !== 'authoritative-dj-memory') {
    throw new Error(`unexpected memory owner ${memory.owner || '<unknown>'}`);
  }
});

check('duplicate production load preserves one owner and migrates legacy anti-repeat data', () => {
  const boot = browserContext();
  boot.window.localStorage.setItem('mair_dj_memory_v2', JSON.stringify([{
    at: Date.now(),
    text: 'Een bewaarde legacy DJ-link.',
    opener: 'een bewaarde legacy dj link',
    artists: ['Testartiest'],
    kind: 'SESSION_LINK'
  }]));
  boot.run('dj-memory.js');
  const owner = boot.window.MAIRDJMemory;
  boot.run('dj-memory.js');
  if (boot.window.MAIRDJMemory !== owner) throw new Error('duplicate load replaced the active memory owner');
  if (owner.snapshot().recentBreaks[0]?.text !== 'Een bewaarde legacy DJ-link.') {
    throw new Error('legacy anti-repeat data was not migrated');
  }
  if (owner.list()[0]?.text !== 'Een bewaarde legacy DJ-link.') {
    throw new Error('Station Director legacy list compatibility is missing');
  }
});

check('mair-dj-cadence-fix boots and handles null state without throwing', () => {
  const boot = browserContext();
  boot.run('mair-dj-memory.js');
  boot.run('dj-memory.js');
  boot.run('mair-dj-cadence-fix.js');
  boot.drainTimers();
  boot.window.dispatchEvent(new boot.window.CustomEvent('mair:dj-v2-state', { detail: null }));
  boot.drainTimers();
  if (!boot.window.MAIRDJCadenceFix?.version) {
    throw new Error('window.MAIRDJCadenceFix was not published');
  }
});

const failed = checks.filter(result => !result.pass);
console.log(`Production boot integration: ${checks.length - failed.length} PASS / ${failed.length} FAIL`);
if (failed.length) process.exitCode = 1;
