// MAIR Car Mode houdt het scherm aan zolang de overlay open staat (Screen Wake Lock API).
// Alleen in Car Mode: de rest van MAIR is juist gebouwd om met het scherm uit door te spelen.
// Zonder ondersteuning of bij weigering gebeurt er niets; muziek hangt er nooit van af.
(()=>{
'use strict';
if(window.MAIRWakeLock)return;
let lock=null,wanted=false,failures=0,pending=null;
function acquire(){
  if(!wanted||lock||!navigator.wakeLock?.request||document.visibilityState==='hidden')return Promise.resolve(false);
  // Eén aanvraag tegelijk: twee snelle events lieten anders een eerste lock achter die nooit vrijgegeven werd.
  if(pending)return pending;
  pending=(async()=>{
    try{
      const l=await navigator.wakeLock.request('screen');failures=0;
      if(!wanted){try{await l.release()}catch{/* al vrijgegeven */}return false}
      lock=l;l.addEventListener?.('release',()=>{if(lock===l)lock=null});
      return true;
    }catch(e){lock=null;failures++;window.MAIRRuntime?.caught?.('wakelock.acquire',e);return false}
  })().finally(()=>{pending=null});
  return pending;
}
async function release(){const l=lock;lock=null;try{await l?.release?.()}catch(e){window.MAIRRuntime?.caught?.('wakelock.release',e)}}
function set(open){wanted=!!open;return open?acquire():release()}
window.addEventListener('mair:car-mode',e=>{set(e?.detail?.open)});
// Een wake lock vervalt als de pagina verborgen wordt; bij terugkomen opnieuw vragen.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')acquire()});
window.MAIRWakeLock={version:'mair-wakelock-v1',set,get active(){return !!lock},get wanted(){return wanted},get failures(){return failures}};
})();
