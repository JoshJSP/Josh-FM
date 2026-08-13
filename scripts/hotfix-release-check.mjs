import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const discovery=read('discovery.js');
const channels=read('channel-click-fix.js');
const dj=read('dj-now-queue.js');
const apiDj=read('api/dj.js');
const checks=[
 ['discovery-v5',/playback-first-discovery-v5/.test(discovery)],
 ['discovery-retry',/awaitCooldown/.test(discovery)&&/setTimeout\(\(\)=>buildSet\(\)/.test(discovery)],
 ['max-five-searches',/MAX_SEARCHES=5/.test(discovery)],
 ['authoritative-categories',/authoritative-popular-pools/.test(channels)],
 ['popular-category-pools',/buildPool/.test(channels)&&/popularity/.test(channels)],
 ['dutch-filter',/nlArtists/.test(channels)&&/nlOk/.test(channels)],
 ['dj-skip-bridge',/consumeAfterSkip/.test(dj)&&/consumeArmedIfChanged/.test(dj)],
 ['radio-copy',/music-radio presenter/.test(apiDj)&&/REAL RADIO STRUCTURE/.test(apiDj)&&/live radio link/.test(apiDj)]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Hotfix release checks: ${checks.length} PASS / 0 FAIL`);
