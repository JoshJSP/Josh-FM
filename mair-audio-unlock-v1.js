(()=>{
'use strict';
if(window.__mairAudioUnlockV1)return;window.__mairAudioUnlockV1=true;
let lastAttempt=0,lastOk=false,lastError='',inFlight=null;
function raw(){const fish=window.JFMDJAudio?.status||null,dj=window.MAIRDJ?.diagnostics?.()||null;return{fish,dj,fishUnlocked:!!fish?.audioUnlocked,djUnlocked:!!dj?.audioUnlocked}}
function complete(r=raw()){const needFish=!!window.JFMDJAudio,needDj=!!window.MAIRDJ;return(!needFish||r.fishUnlocked)&&(!needDj||r.djUnlocked)&&(needFish||needDj)}
function snapshot(){const r=raw();return{version:'mair-audio-unlock-v1.1-idempotent',unlocked:complete(r),fishUnlocked:r.fishUnlocked,djUnlocked:r.djUnlocked,lastAttempt,lastError,inFlight:!!inFlight}}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:audio-unlock',{detail:snapshot()}))}catch{}}
function prime(){if(complete())return Promise.resolve(true);if(inFlight)return inFlight;lastAttempt=Date.now();lastError='';const jobs=[];try{const p=window.MAIRDJ?.unlock?.();if(p)jobs.push(Promise.resolve(p))}catch(e){lastError=String(e?.message||e)}try{const p=window.JFMDJAudio?.unlock?.();if(p)jobs.push(Promise.resolve(p))}catch(e){lastError=String(e?.message||e)}if(!jobs.length)return Promise.resolve(false);inFlight=Promise.allSettled(jobs).then(results=>{lastOk=complete();if(!lastOk&&!lastError){const bad=results.find(x=>x.status==='rejected');if(bad)lastError=String(bad.reason?.message||bad.reason||'audio unlock mislukt')}emit();return lastOk}).finally(()=>{inFlight=null});return inFlight}
const gesture=()=>{if(!complete())prime().catch(()=>{})};
for(const ev of ['pointerdown','touchstart','touchend','mousedown','keydown','click'])document.addEventListener(ev,gesture,{capture:true,passive:true});
window.addEventListener('pageshow',()=>{if(navigator.userActivation?.hasBeenActive&&!complete())prime().catch(()=>{})});
window.MAIRAudioUnlock={version:'mair-audio-unlock-v1.1-idempotent',prime,status:snapshot};
})();
