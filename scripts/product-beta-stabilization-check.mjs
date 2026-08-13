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
  ['v43 cache active',sw.includes("josh-fm-v43-rebrand-ready")&&apiVersion.includes("josh-fm-v43-rebrand-ready")],
  ['all Product Beta runtime cached',['radio-core-health-v1.js','dj-quality-v2.js','music-intelligence-v3.js','personal-learning-v4.js','product-model-v6.js','product-ux-v5.js','beta-status.js','brand-config.js','brand-runtime-v9.js'].every(x=>sw.includes(`./${x}`))],
  ['network requests have timeout',sw.includes('AbortController')&&sw.includes('fetchTimed')],
  ['transient server errors can fall back to cache',sw.includes('response.status<500')&&sw.includes('cache.match(request,{ignoreSearch:true})')],
  ['PWA update checks recover on foreground',pwa.includes("visibilitychange")&&pwa.includes('checkForUpdate')&&pwa.includes('pageshow')],
  ['single MediaSession owner remains',pwa.includes("setActionHandler('play'")||pwa.includes("bind('play'")],
  ['long-session health detects stalls',health.includes('playback-stall')&&health.includes('stalls++')&&health.includes('deviceFlaps')],
  ['beta readiness observes runtime health',beta.includes('JFMBetaStatus')&&beta.includes('failures<5')&&beta.includes('stalls<2')],
  ['beta readiness loaded at runtime',boot.includes("load('./beta-status.js','jfm-beta-status-v8')")],
  ['branding is centralized',brand.includes('JFMBrand')&&brand.includes("productName:'Josh FM'")&&brandRuntime.includes('JFMBrand')],
  ['visible brand remains Josh FM',brand.includes("stationName:'Josh FM'")&&brand.includes("shortName:'Josh FM'")]
];

let failures=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures++}
if(failures)process.exit(1);
console.log(`Product Beta stabilization: ${checks.length} PASS / 0 FAIL`);
