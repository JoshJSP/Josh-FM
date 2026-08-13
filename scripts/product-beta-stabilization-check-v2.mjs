import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const sw=read('sw.js'),pwa=read('pwa-platform.js'),health=read('radio-core-health-v1.js'),beta=read('beta-status.js'),boot=read('dj-now-queue.js'),brand=read('brand-config.js'),brandRuntime=read('brand-runtime-v9.js'),apiVersion=read('api/version.js');
const assets=['radio-core-health-v1.js','dj-quality-v2.js','music-intelligence-v3.js','personal-learning-v4.js','product-model-v6.js','product-ux-v5.js','beta-status.js','brand-config.js','brand-runtime-v9.js'];
const checks=[
['v43 cache active',sw.includes('josh-fm-v43-rebrand-ready')&&apiVersion.includes('josh-fm-v43-rebrand-ready')],
['all Product Beta runtime cached',assets.every(x=>sw.includes(`./${x}`))],
['network timeout fallback',sw.includes('AbortController')&&sw.includes('fetchTimed')],
['foreground update recovery',pwa.includes('visibilitychange')&&pwa.includes('checkForUpdate')&&pwa.includes('pageshow')],
['MediaSession owner present',pwa.includes("bind('play'")],
['long-session stall monitoring',health.includes('playback-stall')&&health.includes('stalls++')&&health.includes('deviceFlaps')],
['beta health thresholds',beta.includes('JFMBetaStatus')&&beta.includes('failures<5')&&beta.includes('stalls<2')],
['beta status runtime wired',boot.includes("load('./beta-status.js','jfm-beta-status-v8')")],
['central branding runtime',brand.includes('JFMBrand')&&brandRuntime.includes('JFMBrand')],
['Josh FM remains current brand',brand.includes("productName:'Josh FM'")&&brand.includes("stationName:'Josh FM'")]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Product Beta stabilization: ${checks.length} PASS / 0 FAIL`);
