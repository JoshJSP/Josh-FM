(()=>{
'use strict';
if(window.__mairAudioUnlockV1)return;window.__mairAudioUnlockV1=true;
let lastAttempt=0,lastOk=false,lastError='';
function snapshot(){const fish=window.JFMDJAudio?.status||null,dj=window.MAIRDJ?.diagnostics?.()||null;return{version:'mair-audio-unlock-v1',unlocked:!!(fish?.audioUnlocked||dj?.audioUnlocked||lastOk),fishUnlocked:!!fish?.audioUnlocked,djUnlocked:!!dj?.audioUnlocked,lastAttempt,lastError}}
function prime(){lastAttempt=Date.now();lastError='';const jobs=[];try{const p=window.MAIRDJ?.unlock?.();if(p)jobs.push(Promise.resolve(p))}catch(e){lastError=String(e?.message||e)}try{const p=window.JFMDJAudio?.unlock?.();if(p)jobs.push(Promise.resolve(p))}catch(e){lastError=String(e?.message||e)}if(!jobs.length)return Promise.resolve(false);return Promise.allSettled(jobs).then(results=>{lastOk=results.some(x=>x.status==='fulfilled'&&x.value!==false)||snapshot().fishUnlocked||snapshot().djUnlocked;if(!lastOk&&!lastError){const bad=results.find(x=>x.status==='rejected');if(bad)lastError=String(bad.reason?.message||bad.reason||'audio unlock mislukt')}try{window.dispatchEvent(new CustomEvent('mair:audio-unlock',{detail:snapshot()}))}catch{}return lastOk})}
for(const ev of ['pointerdown','touchstart','touchend','mousedown','keydown','click'])document.addEventListener(ev,()=>{prime().catch(()=>{})},{capture:true,passive:true});
window.addEventListener('pageshow',()=>{if(navigator.userActivation?.hasBeenActive)prime().catch(()=>{})});
window.MAIRAudioUnlock={version:'mair-audio-unlock-v1',prime,status:snapshot};
})();
