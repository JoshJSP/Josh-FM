// DJ schedule observability bridge. Classification belongs exclusively to transition-controller.js.
(()=>{
'use strict';
if(window.__mairDJScheduleSync)return;window.__mairDJScheduleSync=true;
let lastTransition=null,naturalSignals=0,ignoredSignals=0;
function onTransition(e){const d=e.detail||{};lastTransition={id:String(d.id||''),pair:`${d.fromTrackId||''}>${d.toTrackId||''}`,cause:String(d.cause||'UNKNOWN'),at:Number(d.at||Date.now())};if(d.cause==='NATURAL_END')naturalSignals++;else ignoredSignals++}
window.addEventListener('mair:track-transition',onTransition);
window.MAIRDJScheduleSync={version:'mair-dj-schedule-sync-v2-canonical-only',state:()=>({lastTransition:lastTransition?{...lastTransition}:null,naturalSignals,ignoredSignals,syntheticSignals:0,pending:'',canonical:true})};
window.MAIRRuntime?.register?.('mair-dj-schedule-sync',{version:'v2-canonical-only',owner:'schedule-observer'});
})();
