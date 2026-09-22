// MAIR iOS/PWA background playback guard — music always wins when the PWA is hidden.
(()=>{
  'use strict';
  if(window.MAIRBackgroundGuard)return;
  let hiddenAt=0,wasPlaying=false,trackId='',recovering=false,lastReason='boot',backgroundSkipArmed=false,cancelling=false;
  const state=()=>window.JFMPlaybackState?.get?.()||{};
  const remote=async()=>{try{return await api('/me/player')}catch{return null}};
  const isHidden=()=>document.visibilityState==='hidden'||document.body?.getAttribute('data-mair-background')==='1';
  // Dezelfde voorwaarde als ensureVoiceReady() in mair-dj-v2.js: alleen in de
  // native shell met een lopende keep-alive weten we dat de pagina blijft leven.
  // Is dat zo, dan hoeft deze wacht een DJ-break niet meer af te breken zodra het
  // scherm uitgaat - dat was juist wat de DJ deed zwijgen. Overal anders blijft
  // het oude gedrag staan: muziek wint.
  const backgroundVoiceAllowed=()=>{try{const a=window.JFMDJAudio?.status;return !!a?.nativeShell&&!!a?.keepAlive?.running}catch{return false}};
  function snapshot(reason='snapshot'){
    const s=state();
    wasPlaying=!!s.isPlaying||!!s.expectedLive;
    trackId=String(s.trackId||trackId||'');
    lastReason=reason;
    return s;
  }
  // extra stond hier achteraan, dus een aanroeper die zelf een reason meegaf
  // overschreef de naam van het event. emit('dj-skip-armed',{reason}) kwam in de
  // tijdlijn terecht als 'visibility-hidden' - de diagnostiek loog dus over wat er
  // gebeurd was. De naam van het event wint nu altijd; de aanleiding heet cause.
  function emit(reason,extra={}){try{window.dispatchEvent(new CustomEvent('mair:background-state',{detail:{...extra,reason,hiddenAt,wasPlaying,trackId,recovering,backgroundSkipArmed}}))}catch{}}
  function armBackgroundDjSkip(reason='background'){
    if(!isHidden())return false;
    try{
      if(window.MAIRDJ?.busy)return cancelUnsafeHandoff(reason),true;
      if(typeof window.MAIRDJ?.skipNext==='function'){
        const ok=!!window.MAIRDJ.skipNext();
        if(ok){backgroundSkipArmed=true;emit('dj-skip-armed',{cause:reason})}
        return ok;
      }
    }catch(e){emit('dj-skip-error',{cause:reason,error:String(e?.message||e)})}
    return false;
  }
  async function resumeFailOpen(reason='background-dj-cancel'){
    const s=state(),expected=!!s.expectedLive||wasPlaying,uri=String(s.uri||'');
    if(!expected)return false;
    try{
      if(typeof window.JFMPlayback?.djResume==='function'){
        const ok=await window.JFMPlayback.djResume(uri).catch(()=>false);
        if(ok){emit('background-dj-resumed',{cause:reason,route:'djResume'});return true}
      }
      const live=await remote();
      if(live?.is_playing){try{window.JFMPlaybackState?.ingest?.(live,'background-fail-open-playing')}catch{};return true}
      if(typeof window.JFMPlayback?.resume==='function'){
        const ok=await window.JFMPlayback.resume().catch(()=>false);
        if(ok){emit('background-dj-resumed',{cause:reason,route:'resume'});return true}
      }
    }catch(e){emit('background-dj-resume-error',{cause:reason,error:String(e?.message||e)})}
    return false;
  }
  function cancelUnsafeHandoff(reason='background-hidden'){
    if(!isHidden()||cancelling)return false;
    const dj=window.MAIRDJ,diag=dj?.diagnostics?.()||dj?.state?.()||{},phase=String(diag?.phase||'');
    const unsafe=!!dj?.busy||/HANDOFF|SPEAKING|RESTORING/.test(phase);
    if(!unsafe)return false;
    cancelling=true;
    emit('background-dj-cancel',{cause:reason,phase});
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
      if(backgroundVoiceAllowed())emit('hidden-dj-allowed',{cause:'native-keep-alive'});
      else if(!cancelUnsafeHandoff('visibility-hidden'))armBackgroundDjSkip('visibility-hidden');
    }
    emit('hidden',{isPlaying:!!s.isPlaying,expectedLive:!!s.expectedLive});
    // Tegenhanger van mair:wake. Vandaag leest alleen de diagnostiek mee; het punt
    // is dat er een plek is waar "het scherm gaat uit" één keer wordt gezegd, in
    // plaats van vierentwintig modules die het los van elkaar ontdekken.
    try{window.dispatchEvent(new CustomEvent('mair:sleep',{detail:{at:hiddenAt,isPlaying:!!s.isPlaying,expectedLive:!!s.expectedLive}}))}
    catch(e){emit('sleep-dispatch-error',{error:String(e?.message||e)})}
  }
  // Wake-protocol. Deze module is de enige die visibilitychange bindt; de zes
  // modules die dat eerder zelf deden, wachten nu op mair:wake met hun fase.
  // Elke module koos vroeger zijn eigen vertraging (director tekende op 0 ms met
  // verouderde gegevens, playback-primary vroeg Spotify pas op 450 ms wat er
  // speelde), en dat verschil is precies de sprong die je bij terugkomst zag.
  // Eerst weten, dan tonen: reconcile, daarna refresh, daarna pas paint.
  // Een luisteraar die werk heeft, duwt zijn promise in detail.tasks; de fase is
  // klaar als die allemaal rond zijn. Een fase die faalt houdt de volgende niet
  // tegen - fail-open, net als resumeFailOpen().
  async function wake(phase,extra={}){
    // Het scherm kan tijdens de reeks alweer uitgaan. Gemeten: een echte
    // visibilitychange naar visible, en 250 ms later ging het scherm weer uit
    // terwijl onVisible nog liep. Dan heeft tekenen geen zin en zou de
    // voortgangsklok op een onzichtbaar scherm opnieuw anchoren.
    if(isHidden())return[];
    const tasks=[];
    try{window.dispatchEvent(new CustomEvent('mair:wake',{detail:{phase,tasks,...extra}}))}
    catch(e){emit('wake-dispatch-error',{phase,error:String(e?.message||e)});return[]}
    if(!tasks.length)return[];
    const settled=await Promise.allSettled(tasks.map(t=>Promise.resolve(t)));
    const failed=settled.filter(x=>x.status==='rejected');
    if(failed.length)emit('wake-phase-failed',{phase,failed:failed.length,total:settled.length,error:String(failed[0].reason?.message||failed[0].reason||'onbekend')});
    return settled;
  }
  async function onVisible(){
    document.body?.removeAttribute('data-mair-background');
    const awayMs=hiddenAt?Date.now()-hiddenAt:0;
    hiddenAt=0;backgroundSkipArmed=false;
    try{window.JFMPWA?.reassertMediaSession?.(false)}catch{}
    if(recovering||!wasPlaying){
      emit('visible-no-recovery',{awayMs});
      // Niets te herstellen, maar het scherm moet wel kloppen.
      await wake('reconcile',{awayMs,reconciled:true});
      await wake('refresh',{awayMs});
      await wake('paint',{awayMs});
      return;
    }
    recovering=true;let reconciled=false;
    try{
      await new Promise(r=>setTimeout(r,180));
      const live=await remote();
      // is_playing alleen is geen bewijs dat er geluid is. Een vastgelopen speler
      // meldt is_playing true met de positie geparkeerd op de duur; gemeten op
      // 23-09-2026 kwam deze wacht zo drie keer achter elkaar terug met
      // visible-still-playing terwijl de muziek al minuten stil stond. Sta dat
      // alleen toe zolang de track nog niet aan zijn eind geparkeerd staat.
      const parkedAtEnd=Number(live?.item?.duration_ms||0)>0&&Number(live?.progress_ms||0)>=Number(live.item.duration_ms);
      if(live?.is_playing&&!parkedAtEnd){
        try{window.JFMPlaybackState?.ingest?.(live,'background-return-playing')}catch{}
        try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-return-playing')}catch{}
        emit('visible-still-playing',{awayMs});
        reconciled=true;
        return;
      }
      if(parkedAtEnd)emit('visible-parked-at-end',{awayMs,trackId:String(live?.item?.id||'')});
      // Foreground recovery is emergency-only. Normal hidden track-to-track playback
      // should be owned by Spotify's already-loaded context, not by this guard.
      const ok=await window.JFMPlayback?.recover?.('foreground-return');
      reconciled=!!ok;
      emit(ok?'visible-recovered':'visible-recovery-failed',{awayMs});
    }catch(e){emit('visible-recovery-error',{awayMs,error:String(e?.message||e)})}
    finally{
      recovering=false;
      // Fase 1 is hierboven al gedaan: deze wacht heeft zelf met Spotify gepraat.
      // playback-primary hoeft dan niet nog een keer te vragen; deed hij dat toch,
      // dan waren dat twee aanroepen naar hetzelfde eindpunt binnen een seconde.
      await wake('reconcile',{awayMs,reconciled});
      await wake('refresh',{awayMs});
      await wake('paint',{awayMs});
    }
  }

  // Observe hidden natural ends, but never consume them. playback-primary is the
  // single transition owner and first accepts Spotify's already-advanced context;
  // only when that did not advance does it use the prepared station fallback.
  window.addEventListener('jfm:natural-track-end',event=>{
    if(!isHidden())return;
    const detail=event?.detail||{},s=snapshot('hidden-natural-end');
    if(s.isPlaying||s.expectedLive||wasPlaying){
      try{window.JFMPlaybackState?.setExpectedLive?.(true,'background-natural-passive')}catch{}
      try{navigator.mediaSession.playbackState='playing'}catch{}
    }
    emit('hidden-natural-observed',{endedTrackId:String(detail.trackId||detail.endedTrackId||'')});
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')onHidden();else onVisible().catch(()=>{});
  });
  window.addEventListener('pagehide',onHidden);
  window.addEventListener('pageshow',()=>{if(document.visibilityState==='visible')onVisible().catch(()=>{})});
  // The skip flag is consumed by a natural transition. Re-arm it after every hidden
  // transition so a long background session can pass multiple tracks without DJ pauses.
  window.addEventListener('mair:track-transition',()=>{
    if(!isHidden()||backgroundVoiceAllowed())return;
    setTimeout(()=>armBackgroundDjSkip('hidden-track-transition'),0);
  });
  // Last line of defence: if another module starts a handoff while hidden, abort it.
  window.addEventListener('mair:dj-v2-state',()=>{
    if(isHidden()&&!backgroundVoiceAllowed())cancelUnsafeHandoff('hidden-dj-state');
  });
  window.MAIRBackgroundGuard={version:'mair-background-guard-v5-wake-owner',snapshot,armBackgroundDjSkip,cancelUnsafeHandoff,wake,phases:['reconcile','refresh','paint'],get status(){return{hiddenAt,wasPlaying,trackId,recovering,lastReason,backgroundSkipArmed,cancelling}}};
})();
