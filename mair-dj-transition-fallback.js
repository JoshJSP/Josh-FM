(()=>{
  'use strict';
  if(window.MAIRDJTransitionFallback?.version)return;
  const VERSION='mair-dj-transition-fallback-v1';
  let lastTrackId='',pending=null;
  const seen=new Map();
  const now=()=>Date.now();
  function cleanup(){for(const [sig,at] of seen)if(now()-at>15000)seen.delete(sig)}
  function sig(a,b){return a&&b&&a!==b?`${a}>${b}`:''}
  function currentId(){try{return String(window.JFMPlaybackState?.get?.()?.trackId||'')}catch{return''}}
  function cancel(){if(pending?.timer)clearTimeout(pending.timer);pending=null}
  function mark(detail={}){const s=sig(String(detail.endedTrackId||''),String(detail.newTrackId||''));if(!s)return;seen.set(s,now());if(pending?.sig===s)cancel();cleanup()}
  function shouldFastFallback(){try{const d=window.MAIRDJ?.diagnostics?.()||{};return !!(d.pendingAir||d.phase==='ARMED'||Number(d.remaining||99)<=1)}catch{return false}}
  function synthesize(record){if(pending!==record)return;pending=null;if(document.visibilityState==='hidden')return;if(currentId()!==record.current)return;cleanup();if(seen.has(record.sig))return;seen.set(record.sig,now());try{window.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:record.previous,newTrackId:record.current,source:'trackchange-fallback',synthetic:true,at:now()}}))}catch{}}
  function onTrackChange(detail={}){
    const current=String(detail.trackId||currentId()||''),previous=String(detail.previousTrackId||lastTrackId||'');
    if(current)lastTrackId=current;
    const s=sig(previous,current);if(!s)return;
    cancel();cleanup();if(seen.has(s))return;
    const delay=shouldFastFallback()?180:2200,record={sig:s,previous,current,timer:0};
    record.timer=setTimeout(()=>synthesize(record),delay);pending=record;
  }
  window.addEventListener('jfm:natural-next-ready',e=>mark(e.detail||{}));
  window.addEventListener('jfm:trackchange',e=>onTrackChange(e.detail||{}));
  window.addEventListener('pagehide',cancel);
  window.MAIRDJTransitionFallback={version:VERSION,state:()=>({pending:pending?{sig:pending.sig,previous:pending.previous,current:pending.current}:null,seen:[...seen.keys()].slice(-12),lastTrackId})};
})();
