// MAIR DJ break owed guard — self-heals a due break if the primary DJ runtime loses it after a handoff race.
(()=>{
'use strict';
if(window.MAIRDJBreakOwedGuard)return;
const RECOVERY_DELAY=260,PREPARE_BACKOFF=9000;
let lastState=null,lastRecoveredMissAt=0,lastPrepareAt=0,recoveryTimer=0,recoveries=0,prepareRecoveries=0,lastReason='';
const now=()=>Date.now();
const currentTrackId=()=>String(window.JFMPlaybackState?.get?.()?.trackId||'');
function status(){return{version:'mair-dj-break-owed-guard-v1',recoveries,prepareRecoveries,lastRecoveredMissAt,lastPrepareAt,lastReason,lastState:lastState?{phase:lastState.phase,pendingAir:!!lastState.pendingAir,prepared:!!lastState.prepared,lastMissReason:lastState.lastMissReason||'',lastMissAt:Number(lastState.lastMissAt||0)}:null}}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:dj-break-owed-guard',{detail:status()}))}catch{}}
function schedule(fn,delay=RECOVERY_DELAY){clearTimeout(recoveryTimer);recoveryTimer=setTimeout(fn,delay)}
function recoverMissedBreak(d){const missAt=Number(d?.lastMissAt||0);if(!missAt||missAt===lastRecoveredMissAt||d?.lastMissReason!=='break-missed')return false;lastRecoveredMissAt=missAt;lastReason='air-failure-safely-skipped';emit();return false}
function recoverDuePreparation(d){if(!d?.pendingAir||d?.prepared||d?.busy||document.visibilityState==='hidden')return false;if(now()-lastPrepareAt<PREPARE_BACKOFF)return false;const id=currentTrackId();if(!id||typeof window.MAIRDJ?.prepare!=='function')return false;lastPrepareAt=now();lastReason='due-without-prepared-audio';schedule(()=>{if(document.visibilityState==='hidden'||window.MAIRDJ?.busy)return;const live=currentTrackId();if(!live)return;Promise.resolve(window.MAIRDJ.prepare({manual:!!window.MAIRDJ.state?.()?.manualArmed,originTrackId:live})).then(pack=>{if(pack)prepareRecoveries++;emit()}).catch(()=>emit())},RECOVERY_DELAY);return true}
function inspect(d){if(!d||typeof d!=='object')return;const previous=lastState;lastState=d;if(recoverMissedBreak(d))return;if(d?.lastMissReason==='natural-transition-error'&&previous?.pendingAir&&!d.pendingAir){lastReason='natural-transition-error-rearmed';schedule(()=>{if(document.visibilityState==='hidden'||window.MAIRDJ?.busy)return;if(window.MAIRDJ?.armManual?.()){recoveries++;emit()}},RECOVERY_DELAY);return}recoverDuePreparation(d)}
function refresh(){try{inspect(window.MAIRDJ?.state?.())}catch{}}
window.addEventListener('mair:dj-v2-state',e=>inspect(e.detail||null));
window.addEventListener('pageshow',()=>setTimeout(refresh,400));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,400)});
setInterval(refresh,5000);
window.MAIRDJBreakOwedGuard={version:'mair-dj-break-owed-guard-v1',status,refresh};
setTimeout(refresh,800);
})();
