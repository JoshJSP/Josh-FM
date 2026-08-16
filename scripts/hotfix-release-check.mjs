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
const resume=read('dj-resume.js');
const easy=read('mair-easy-use-v1.js');
const progress=read('progress-clock-v226.js');
const checks=[
 ['discovery-v5',/playback-first-discovery-v5/.test(discovery)],
 ['discovery-retry',/awaitCooldown/.test(discovery)&&/setTimeout\(\(\)=>buildSet\(\)/.test(discovery)],
 ['max-five-searches',/MAX_SEARCHES=5/.test(discovery)],
 ['authoritative-categories',/MAIRStationController/.test(channels)&&/mair-station-controller-v3/.test(channels)&&/MAIRStationPolicy/.test(channels)],
 ['popular-category-pools',/buildPool/.test(channels)&&/limit=10&q=/.test(channels)&&!/limit=25&q=/.test(channels)&&!/popularity/.test(policy)],
 ['dutch-filter',/semanticQualityFilter/.test(channels)&&/\/api\/category-filter/.test(channels)&&/policy\(\)\?\.confidence\?\.\(id\)/.test(channels)&&/minConfidence:.95/.test(policy)&&/language:'nl'/.test(policy)&&/hoofdzakelijk Nederlands/.test(classifier)&&!/nlArtists/.test(channels)],
 ['dj-v3-bootstrap',bootstrap.includes('progress-clock-v226.js')&&bootstrap.includes('mair-dj-v2.js')&&!bootstrap.includes('dj-authoritative-v226.js')],
 ['dj-groq-writer',writer.includes('GROQ_API_KEY')&&writer.includes('llama-3.3-70b-versatile')&&writer.includes('Nederlandse muziek-radio-DJ')],
 ['dj-prebuffers-before-pause',dj.indexOf('window.prepareSpeech')<dj.indexOf('await pauseMusic(uri)')&&dj.includes("setPhase('ARMED'")],
 ['dj-rewind-resume',dj.includes('rewindCurrent(uri)')&&dj.includes('await resumeMusic(uri)')],
 ['dj-auto-scheduler',dj.includes('count++')&&dj.includes('remaining()')&&dj.includes("window.addEventListener('jfm:natural-next-ready'")&&!dj.includes('schedulePendingRetry')],
 ['dj-manual-next',dj.includes('manualArmed')&&dj.includes('armManual')&&dj.includes("dataset[flag]='v3'")],
 ['dj-real-audio-completion',dj.includes('const ok=await window.speakText(pack.text,false)')&&dj.includes("setPhase('SPEAKING'")&&!dj.includes('const audio=new Audio()')],
 ['dj-single-attempt-failsafe',dj.includes('lastNaturalSig')&&dj.includes("miss('break-missed',error)")&&dj.includes('restoreMusic(uri,{rewind:false})')&&!dj.includes('retryTimer')],
 ['legacy-auto-scheduler-retired',resume.includes('__mairLegacyDJSchedulerDisabled=true')&&resume.includes('legacyAutomaticBreaks:false')],
 ['legacy-handoff-retired',legacy.includes('legacy-shim-to-mair-dj-v2')&&!legacy.includes('/me/player/pause')],
 ['dj-live-only-while-speaking',easy.includes("live=phase==='SPEAKING'")&&easy.includes("setDjLive(detail.phase==='SPEAKING'")],
 ['progress-local-clock',progress.includes('performance.now()')&&progress.includes('setInterval(tick,250)')&&progress.includes("$('elapsed')")]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Hotfix release checks: ${checks.length} PASS / 0 FAIL`);
