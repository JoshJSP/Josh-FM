import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const discovery=read('discovery.js');
const channels=read('channel-click-fix.js');
const bootstrap=read('dj-now-queue.js');
const dj=read('dj-authoritative-v226.js');
const progress=read('progress-clock-v226.js');
const apiDj=read('api/dj.js');
const checks=[
 ['discovery-v5',/playback-first-discovery-v5/.test(discovery)],
 ['discovery-retry',/awaitCooldown/.test(discovery)&&/setTimeout\(\(\)=>buildSet\(\)/.test(discovery)],
 ['max-five-searches',/MAX_SEARCHES=5/.test(discovery)],
 ['authoritative-categories',/authoritative-popular-pools/.test(channels)],
 ['popular-category-pools',/buildPool/.test(channels)&&/popularity/.test(channels)],
 ['dutch-filter',/nlArtists/.test(channels)&&/nlOk/.test(channels)],
 ['v226-bootstrap',bootstrap.includes('progress-clock-v226.js')&&bootstrap.includes('dj-authoritative-v226.js')],
 ['dj-pauses-before-speech',dj.indexOf('pauseExpected(expectedUri)')<dj.indexOf('speak(pack,manual)')],
 ['dj-rewind-resume',dj.includes('rewindExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')],
 ['dj-auto-scheduler',dj.includes('tracksSinceTalk>=nextTalkAt')&&dj.includes('runBreak(ended,false)')],
 ['dj-manual-next',dj.includes('consumeArmedIfChanged')&&dj.includes('runBreak(null,true)')],
 ['progress-local-clock',progress.includes('performance.now()')&&progress.includes('setInterval(tick,250)')&&progress.includes("$('elapsed')")],
 ['radio-copy',/music-radio presenter/.test(apiDj)&&/REAL RADIO STRUCTURE/.test(apiDj)&&/live radio link/.test(apiDj)]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Hotfix release checks: ${checks.length} PASS / 0 FAIL`);
