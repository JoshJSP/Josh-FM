import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const discovery=read('discovery.js');
const channels=read('channel-click-fix.js');
const policy=read('mair-station-policy.js');
const classifier=read('api/category-filter.js');
const bootstrap=read('dj-now-queue.js');
const dj=read('mair-dj-v2.js');
const writer=read('api/dj-writer.js');
const legacy=read('dj-handoff-v34.js');
const progress=read('progress-clock-v226.js');
const checks=[
 ['discovery-v5',/playback-first-discovery-v5/.test(discovery)],
 ['discovery-retry',/awaitCooldown/.test(discovery)&&/setTimeout\(\(\)=>buildSet\(\)/.test(discovery)],
 ['max-five-searches',/MAX_SEARCHES=5/.test(discovery)],
 ['authoritative-categories',/MAIRStationController/.test(channels)&&/mair-station-controller-v3/.test(channels)&&/MAIRStationPolicy/.test(channels)],
 ['popular-category-pools',/buildPool/.test(channels)&&/popularity/.test(channels)],
 ['dutch-filter',/strictSemanticFilter/.test(channels)&&/\/api\/category-filter/.test(channels)&&/minConfidence:.95/.test(policy)&&/hoofdzakelijk Nederlands/.test(classifier)&&!/nlArtists/.test(channels)],
 ['dj-v2-bootstrap',bootstrap.includes('progress-clock-v226.js')&&bootstrap.includes('mair-dj-v2.js')&&!bootstrap.includes('dj-authoritative-v226.js')],
 ['dj-groq-writer',writer.includes('GROQ_API_KEY')&&writer.includes('llama-3.3-70b-versatile')&&writer.includes('Nederlandse muziek-radio-DJ')],
 ['dj-prebuffers-before-pause',dj.indexOf("fetch('/api/tts'")<dj.indexOf('await pause(uri)')&&dj.includes("setPhase('READY'")],
 ['dj-rewind-resume',dj.includes('await seekStart(uri)')&&dj.includes('await resume(uri)')],
 ['dj-auto-scheduler',dj.includes('count++')&&dj.includes('remaining()')&&dj.includes('pendingAir=true')],
 ['dj-manual-next',dj.includes('manualFrom')&&dj.includes('armManual')&&dj.includes("dataset.mairDjOwner='v2'")],
 ['dj-real-audio-completion',dj.includes('audio.onended')&&dj.includes("speaking:true")&&dj.includes("speaking:false")],
 ['legacy-handoff-retired',legacy.includes('legacy-shim-to-mair-dj-v2')&&!legacy.includes('/me/player/pause')],
 ['progress-local-clock',progress.includes('performance.now()')&&progress.includes('setInterval(tick,250)')&&progress.includes("$('elapsed')")]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Hotfix release checks: ${checks.length} PASS / 0 FAIL`);
