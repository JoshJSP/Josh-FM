// MAIR iOS/PWA background playback guard — music always wins when the PWA is hidden.
(()=>{
  'use strict';
  if(window.MAIRBackgroundGuard)return;
  let hiddenAt=0,wasPlaying=false,trackId='',recovering=false,lastReason='boot',backgroundSkipArmed=false,cancelling=false;
  const state=()=>window.JFMPlaybackState?.get?.()||{};
  const remote=async()=>{try{return await api('/me/player')}catch{return null}};
  const isHidden=()=>document.visibilityState==='hidden'||document.body?.getAttribute('data-mair-background')==='1';
  function snapshot(reason='snapshot'){
    const s=state();
    wasPlaying=!!s.isPlaying||!!s.expectedLive;
    trackId=String(s.trackId||trackId||'');
    lastReason=reason;
    return s;
  }
  function emit(reason,extra={}){try{window.dispatchEvent(new CustomEvent('mair:background-state',{detail:{reason,hiddenAt,wasPlaying,trackId,recovering,backgroundSkipArmed,...extra}}))}catch{}}
  function armBackgroundDjSkip(reason='background'){
    if(!isHidden())return false;
    try{
      if(window.MAIRDJ?.busy)return cancelUnsafeHandoff(reason),true;
      if(typeof window.MAIRDJ?.skipNext==='function'){
        const ok=!!window.MAIRDJ.skipNext();
        if(ok){backgroundSkipArmed=true;emit('dj-skip-armed',{reason})}
        return ok;
      }
    }catch(e){emit('dj-skip-error',{reason,error:String(e?.message||e)})}
    return false;
  }
  async function resumeFailOpen(reason='background-dj-cancel'){
    const s=state(),expected=!!s.expectedLive||wasPlaying,uri=String(s.uri||'');
    if(!expected)return false;
    try{
      if(typeof window.JFMPlayback?.djResume==='function'){
        const ok=await window.JFMPlayback.djResume(uri).catch(()=>false);
        if(ok){emit('background-dj-resumed',{reason,route:'djResume'});return true}
      }
      const live=await remote();
      if(live?.is_playing){try{window.JFMPlaybackState?.ingest?.(live,'background-fail-open-playing')}catch{};return true}
      if(typeof window.JFMPlayback?.resume==='function'){
        const ok=await window.JFMPlayback.resume().catch(()=>false);
        if(ok){emit('background-dj-resumed',{reason,route:'resume'});return true}
      }
    }catch(e){emit('background-dj-resume-error',{reason,error:String(e?.message||e)})}
    return false;
  }
  function cancelUnsafeHandoff(reason='background-hidden'){
    if(!isHidden()||cancelling)return false;
    const dj=window.MAIRDJ,diag=dj?.diagnostics?.()||dj?.state?.()||{},phase=String(diag?.phase||'');
    const unsafe=!!dj?.busy||/HANDOFF|SPEAKING|RESTORING/.test(phase);
    if(!unsafe)return false;
    cancelling=true;
    emit('background-dj-cancel',{reason,phase});
    Promise.resolve().then(async()=>{
      try{await dj?.cancelActive?.('background-hidden')}catch{}
      try{await resumeFailOpen(reason)}catch{}
    }).finally(()=>{cancelling=false});
    return true;
  }
  function onHidden(){
    hiddenAt=Date.now();
    const s=snapshot('hidden');
    document.body?.setAttribute('data-mair-background','1');
    if(s.isPlaying||s.expectedLive){
      try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-preserve')}catch{}
      try{navigator.mediaSession.playbackState='playing'}catch{}
      try{window.JFMPWA?.reassertMediaSession?.(false)}catch{}
      // Never let a browser-owned DJ handoff pause Spotify while iOS can suspend JS.
      // If a handoff is already in progress, cancel it and fail open to music.
      if(!cancelUnsafeHandoff('visibility-hidden'))armBackgroundDjSkip('visibility-hidden');
    }
    emit('hidden',{isPlaying:!!s.isPlaying,expectedLive:!!s.expectedLive});
  }
  async function onVisible(){
    document.body?.removeAttribute('data-mair-background');
    const awayMs=hiddenAt?Date.now()-hiddenAt:0;
    hiddenAt=0;backgroundSkipArmed=false;
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
      // Foreground recovery is emergency-only. Normal hidden track-to-track playback
      // should be owned by Spotify's already-loaded context, not by this guard.
      const ok=await window.JFMPlayback?.recover?.('foreground-return');
      emit(ok?'visible-recovered':'visible-recovery-failed',{awayMs});
    }catch(e){emit('visible-recovery-error',{awayMs,error:String(e?.message||e)})}
    finally{recovering=false}
  }

  // Critical iOS rule: while hidden, never let playback-primary turn a natural
  // track end into a new Web API play command. The station context is already
  // preloaded in Spotify; forcing play without a user gesture can be blocked by
  // mobile autoplay rules and leave the PWA silent at the track boundary.
  window.addEventListener('jfm:natural-track-end',event=>{
    if(!isHidden())return;
    const detail=event?.detail||{},s=snapshot('hidden-natural-end');
    if(s.isPlaying||s.expectedLive||wasPlaying){
      try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-natural-passive')}catch{}
      try{navigator.mediaSession.playbackState='playing'}catch{}
    }
    emit('hidden-natural-passive',{endedTrackId:String(detail.trackId||detail.endedTrackId||'')});
    event.stopImmediatePropagation();
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')onHidden();else onVisible().catch(()=>{});
  });
  window.addEventListener('pagehide',onHidden);
  window.addEventListener('pageshow',()=>{if(document.visibilityState==='visible')onVisible().catch(()=>{})});
  // The skip flag is consumed by a natural transition. Re-arm it after every hidden
  // transition so a long background session can pass multiple tracks without DJ pauses.
  window.addEventListener('mair:track-transition',()=>{
    if(!isHidden())return;
    setTimeout(()=>armBackgroundDjSkip('hidden-track-transition'),0);
  });
  // Last line of defence: if another module starts a handoff while hidden, abort it.
  window.addEventListener('mair:dj-v2-state',()=>{
    if(isHidden())cancelUnsafeHandoff('hidden-dj-state');
  });
  window.MAIRBackgroundGuard={version:'mair-background-guard-v3-passive-natural-end',snapshot,armBackgroundDjSkip,cancelUnsafeHandoff,get status(){return{hiddenAt,wasPlaying,trackId,recovering,lastReason,backgroundSkipArmed,cancelling}}};
})();