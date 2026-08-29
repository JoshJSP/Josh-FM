// MAIR iOS/PWA background playback guard — music always wins when the PWA is hidden.
(()=>{
  'use strict';
  if(window.MAIRBackgroundGuard)return;
  let hiddenAt=0,wasPlaying=false,trackId='',recovering=false,lastReason='boot',backgroundSkipArmed=false,cancelling=false,nativeDeviceId='',nativeHandoff=false;
  const state=()=>window.JFMPlaybackState?.get?.()||{};
  const remote=async()=>{try{return await api('/me/player')}catch{return null}};
  const isHidden=()=>document.visibilityState==='hidden'||document.body?.getAttribute('data-mair-background')==='1';
  const sdkDeviceId=()=>String(window.JFMSpotifySDK?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();
  function snapshot(reason='snapshot'){
    const s=state();
    wasPlaying=!!s.isPlaying||!!s.expectedLive;
    trackId=String(s.trackId||trackId||'');
    lastReason=reason;
    return s;
  }
  function emit(reason,extra={}){try{window.dispatchEvent(new CustomEvent('mair:background-state',{detail:{reason,hiddenAt,wasPlaying,trackId,recovering,backgroundSkipArmed,nativeDeviceId,nativeHandoff,...extra}}))}catch{}}
  async function findNativeSpotifyDevice(){
    try{
      const data=await api('/me/player/devices');
      const devices=Array.isArray(data?.devices)?data.devices:[];
      const webId=sdkDeviceId();
      const candidates=devices.filter(d=>d?.id&&d.id!==webId&&!d.is_restricted);
      const preferred=candidates.find(d=>String(d.type||'').toLowerCase()==='smartphone')||candidates.find(d=>/iphone|phone|spotify/i.test(String(d.name||'')))||null;
      nativeDeviceId=String(preferred?.id||'');
      return preferred;
    }catch(e){emit('native-device-error',{error:String(e?.message||e)});return null}
  }
  async function handoffToNative(reason='background-hidden'){
    if(!isHidden()||!wasPlaying)return false;
    const device=await findNativeSpotifyDevice();
    if(!device?.id){emit('native-device-missing',{reason});return false}
    try{
      await api('/me/player',{method:'PUT',body:{device_ids:[device.id],play:true}});
      nativeHandoff=true;nativeDeviceId=String(device.id);
      try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-native-spotify')}catch{}
      emit('native-handoff-ok',{reason,deviceName:String(device.name||''),deviceType:String(device.type||'')});
      return true;
    }catch(e){nativeHandoff=false;emit('native-handoff-error',{reason,error:String(e?.message||e)});return false}
  }
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
      const live=await remote();
      if(live?.is_playing){try{window.JFMPlaybackState?.ingest?.(live,'background-fail-open-playing')}catch{};return true}
      if(!isHidden()&&typeof window.JFMPlayback?.djResume==='function'){
        const ok=await window.JFMPlayback.djResume(uri).catch(()=>false);
        if(ok){emit('background-dj-resumed',{reason,route:'djResume'});return true}
      }
      if(!isHidden()&&typeof window.JFMPlayback?.resume==='function'){
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
      if(!cancelUnsafeHandoff('visibility-hidden'))armBackgroundDjSkip('visibility-hidden');
      Promise.resolve().then(()=>handoffToNative('visibility-hidden')).catch(()=>{});
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
        try{window.JFMPlaybackState?.ingest?.(live,nativeHandoff?'background-return-native':'background-return-playing')}catch{}
        try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-return-playing')}catch{}
        emit(nativeHandoff?'visible-native-still-playing':'visible-still-playing',{awayMs});
        nativeHandoff=false;
        return;
      }
      const ok=await window.JFMPlayback?.recover?.('foreground-return');
      emit(ok?'visible-recovered':'visible-recovery-failed',{awayMs});
      nativeHandoff=false;
    }catch(e){emit('visible-recovery-error',{awayMs,error:String(e?.message||e)})}
    finally{recovering=false}
  }

  // While hidden, never let playback-primary turn a natural track end into a new
  // Web API play command. Native Spotify (preferred) or Spotify's preloaded context
  // owns the transition, because iOS may suspend browser JavaScript at this point.
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
  window.addEventListener('mair:track-transition',()=>{
    if(!isHidden())return;
    setTimeout(()=>armBackgroundDjSkip('hidden-track-transition'),0);
  });
  window.addEventListener('mair:dj-v2-state',()=>{
    if(isHidden())cancelUnsafeHandoff('hidden-dj-state');
  });
  window.MAIRBackgroundGuard={version:'mair-background-guard-v4-native-spotify-handoff',snapshot,armBackgroundDjSkip,cancelUnsafeHandoff,handoffToNative,get status(){return{hiddenAt,wasPlaying,trackId,recovering,lastReason,backgroundSkipArmed,cancelling,nativeDeviceId,nativeHandoff}}};
})();