// Keeps the DJ countdown in sync even when Spotify advances outside the primary natural-next event path.
(()=>{
'use strict';
if(window.__mairDJScheduleSync)return;window.__mairDJScheduleSync=true;
let lastTrack='',pending=null,lastNaturalPair='',lastSyntheticPair='';
const idOf=d=>String(d?.newTrackId||d?.trackId||d?.id||'');
const prevOf=d=>String(d?.endedTrackId||d?.previousTrackId||d?.prevTrackId||'');
function clearPending(){if(pending?.timer)clearTimeout(pending.timer);pending=null}
function pair(a,b){return a&&b?`${a}>${b}`:''}
function currentId(){try{return String(window.JFMPlaybackState?.get?.()?.trackId||'')}catch{return''}}
function onNatural(e){const d=e.detail||{},p=pair(prevOf(d),idOf(d));if(p){lastNaturalPair=p;if(p===pending?.pair)clearPending();setTimeout(()=>{if(lastNaturalPair===p)lastNaturalPair=''},2800)}}
function onTrack(e){const d=e.detail||{},next=idOf(d)||currentId();if(!next)return;const previous=prevOf(d)||lastTrack;if(next===lastTrack&&!previous)return;lastTrack=next;if(!previous||previous===next)return;const p=pair(previous,next);clearPending();const record={pair:p,next,previous,timer:0};record.timer=setTimeout(()=>{if(pending!==record)return;pending=null;if(lastNaturalPair===p||lastSyntheticPair===p)return;const dj=window.MAIRDJ;if(!dj||dj.busy)return;lastSyntheticPair=p;try{window.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:previous,newTrackId:next,auto:true,synthetic:true,source:'dj-schedule-sync'}}))}catch{}setTimeout(()=>{if(lastSyntheticPair===p)lastSyntheticPair=''},2800)},650);pending=record}
function boot(){lastTrack=currentId()||lastTrack}
window.addEventListener('jfm:natural-next-ready',onNatural);
window.addEventListener('jfm:trackchange',onTrack);
window.addEventListener('mair:station-selected',()=>{clearPending();setTimeout(boot,250)});
window.addEventListener('pageshow',()=>setTimeout(boot,200));
boot();
window.MAIRDJScheduleSync={version:'mair-dj-schedule-sync-v1',state:()=>({lastTrack,lastNaturalPair,lastSyntheticPair,pending:pending?.pair||''})};
})();
