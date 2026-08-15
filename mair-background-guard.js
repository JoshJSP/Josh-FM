// MAIR iOS/PWA background playback guard — preserve expected live state and recover only on foreground.
(()=>{
  'use strict';
  if(window.MAIRBackgroundGuard)return;
  let hiddenAt=0,wasPlaying=false,trackId='',recovering=false,lastReason='boot';
  const state=()=>window.JFMPlaybackState?.get?.()||{};
  const remote=async()=>{try{return await api('/me/player')}catch{return null}};
  function snapshot(reason='snapshot'){
    const s=state();
    wasPlaying=!!s.isPlaying||!!s.expectedLive;
    trackId=String(s.trackId||trackId||'');
    lastReason=reason;
    return s;
  }
  function emit(reason,extra={}){try{window.dispatchEvent(new CustomEvent('mair:background-state',{detail:{reason,hiddenAt,wasPlaying,trackId,recovering,...extra}}))}catch{}}
  function onHidden(){
    hiddenAt=Date.now();
    const s=snapshot('hidden');
    if(s.isPlaying||s.expectedLive){
      try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-preserve')}catch{}
      try{navigator.mediaSession.playbackState='playing'}catch{}
      try{window.JFMPWA?.reassertMediaSession?.(false)}catch{}
    }
    document.body?.setAttribute('data-mair-background','1');
    emit('hidden',{isPlaying:!!s.isPlaying,expectedLive:!!s.expectedLive});
  }
  async function onVisible(){
    document.body?.removeAttribute('data-mair-background');
    const awayMs=hiddenAt?Date.now()-hiddenAt:0;
    hiddenAt=0;
    try{window.JFMPWA?.reassertMediaSession?.(false)}catch{}
    if(recovering||!wasPlaying){emit('visible-no-recovery',{awayMs});return}
    recovering=true;
    try{
      await new Promise(r=>setTimeout(r,180));
      const live=await remote();
      if(live?.is_playing){
        try{window.JFMPlaybackState?.ingest?.(live,'background-return-playing')}catch{}
        try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-return-playing')}catch{}
        emit('visible-still-playing',{awayMs});
        return;
      }
      // Do not attempt autoplay while still hidden; only recover after the user returns to MAIR.
      const ok=await window.JFMPlayback?.recover?.('foreground-return');
      emit(ok?'visible-recovered':'visible-recovery-failed',{awayMs});
    }catch(e){emit('visible-recovery-error',{awayMs,error:String(e?.message||e)})}
    finally{recovering=false}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')onHidden();else onVisible().catch(()=>{});
  });
  window.addEventListener('pagehide',onHidden);
  window.addEventListener('pageshow',()=>{if(document.visibilityState==='visible')onVisible().catch(()=>{})});
  window.MAIRBackgroundGuard={version:'mair-background-guard-v1',snapshot,get status(){return{hiddenAt,wasPlaying,trackId,recovering,lastReason}}};
})();
