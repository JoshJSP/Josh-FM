import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const sw=read('sw.js');
const pwa=read('pwa-platform.js');
const health=read('radio-core-health-v1.js');
const beta=read('beta-status.js');
const boot=read('dj-now-queue.js');
const brand=read('brand-config.js');
const brandRuntime=read('brand-runtime-v9.js');
const apiVersion=read('api/version.js');

const checks=[
  ['MAIR DJ v2 cache active',sw.includes("mair-v50-dj-v2-voice-check-20260815")&&apiVersion.includes("mair-v50-dj-v2-voice-check-20260815")],
  ['all Product Beta runtime cached',['radio-core-health-v1.js','dj-quality-v2.js','music-intelligence-v3.js','personal-learning-v4.js','product-model-v6.js','product-ux-v5.js','beta-status.js','brand-config.js','brand-runtime-v9.js','channel-start-guard-v2b01.js','dj-handoff-bootstrap-v2b02.js','ios-transport-v2b02.js','mair-category-search.js','mair-category-purity.js','mair-ui-hardening.js','mair-playback-category-guard.js','mair-build-orchestrator.js','mair-dj-v2.js','mair-voice-check.js'].every(x=>sw.includes(`./${x}`))],
  ['network requests have timeout',sw.includes('AbortController')&&sw.includes('fetchTimed')],
  ['PWA update checks recover on foreground',pwa.includes("visibilitychange")&&pwa.includes('checkForUpdate')&&pwa.includes('pageshow')],
  ['single MediaSession owner remains',pwa.includes("setActionHandler('play'")||pwa.includes("bind('play'")],
  ['long-session health detects stalls',health.includes('playback-stall')&&health.includes('stalls++')&&health.includes('deviceFlaps')],
  ['beta readiness observes runtime health',beta.includes('JFMBetaStatus')&&beta.includes('failures<5')&&beta.includes('stalls<2')],
  ['beta readiness loaded at runtime',boot.includes("load('./beta-status.js','jfm-beta-status-v8')")],
  ['DJ v2 loaded at runtime',boot.includes("load('./mair-dj-v2.js','mair-dj-v2')")&&boot.includes("load('./mair-voice-check.js','mair-voice-check-v1')")],
  ['branding is centralized',brand.includes('JFMBrand')&&brand.includes("productName:'MAIR'")&&brandRuntime.includes('JFMBrand')],
  ['visible brand is MAIR',brand.includes("stationName:'MAIR'")&&brand.includes("shortName:'MAIR'")&&brand.includes("logo:'mair-logo.svg'")]
];

let failures=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures++}
if(failures)process.exit(1);
console.log(`Product Beta stabilization: ${checks.length} PASS / 0 FAIL`);
