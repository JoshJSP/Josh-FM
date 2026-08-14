import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const discovery=read('discovery.js');
const channels=read('channel-click-fix.js');
const classifier=read('api/category-filter.js');
const bootstrap=read('dj-now-queue.js');
const dj=read('dj-authoritative-v226.js');
const progress=read('progress-clock-v226.js');
const apiDj=read('api/dj.js');
const checks=[
 ['discovery-v5',/playback-first-discovery-v5/.test(discovery)],
 ['discovery-retry',/awaitCooldown/.test(discovery)&&/setTimeout\(\(\)=>buildSet\(\)/.test(discovery)],
 ['max-five-searches',/MAX_SEARCHES=5/.test(discovery)],
 ['authoritative-categories',/authoritative-strict-categories/.test(channels)],
 ['popular-category-pools',/buildPool/.test(channels)&&/popularity/.test(channels)],
 ['dutch-filter',/strictSemanticFilter/.test(channels)&&/\/api\/category-filter/.test(channels)&&/hoofdzakelijk Nederlands/.test(classifier)&&!/nlArtists/.test(channels)],
 ['v226-bootstrap',bootstrap.includes('progress-clock-v226.js')&&bootstrap.includes('dj-authoritative-v226.js')],
 ['dj-pauses-before-speech',dj.indexOf('await pause(uri)')<dj.indexOf('window.speakText')],
 ['dj-rewind-resume',dj.includes('await rewind(uri)')&&dj.includes('await resume(uri)')],
 ['dj-auto-scheduler',dj.includes('autoCount>=nextAuto')&&dj.includes('run(false)')],
 ['dj-manual-next',dj.includes('armedFrom')&&dj.includes('run(true)')],
 ['progress-local-clock',progress.includes('performance.now()')&&progress.includes('setInterval(tick,250)')&&progress.includes("$('elapsed')")],
 ['radio-copy',/music-radio presenter/.test(apiDj)&&/REAL RADIO STRUCTURE/.test(apiDj)&&/live radio link/.test(apiDj)]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Hotfix release checks: ${checks.length} PASS / 0 FAIL`);
