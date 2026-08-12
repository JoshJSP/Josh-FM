// Josh FM DJ transition engine — Fish-safe pre-generation and fail-safe Spotify handoff.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=$('djNow'),player=()=>window.jfmSpotifyPlayer||null,truth=()=>window.JFMPlaybackState||null;
  let lock=false,polling=false,armed=null,prepToken=0,transitionSeq=0,autoPrepared=null,autoPreparing=false,lastAutoPrepId='';
  const log=[],IMAGING_KEY='jfm_imaging_history_v1',TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/;
  function trace(stage,extra={}){const item={at:Date.now(),seq:transitionSeq,stage,...extra};log.unshift(item);if(log.length>100)log.length=100;window.JFMDJTransitionLog=log}
  function status(text,bad=false){const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}}
  function setArmed(on){if(!btn)return;btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  function cachedState(){try{return playback?.item?playback:null}catch{return null}}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function currentUri(){
    try{const t=truth()?.get?.();if(TRACK_URI.test(t?.uri||''))return t.uri}catch{}
    try{const s=cachedState(),uri=s?.item?.uri;if(TRACK_URI.test(uri||''))return uri}catch{}
    try{const p=player();if(typeof p?.getCurrentState==='function'){const s=await p.getCurrentState(),uri=s?.track_window?.current_track?.uri;if(TRACK_URI.test(uri||''))return uri}}catch{}
    try{const uri=(await live())?.item?.uri;return TRACK_URI.test(uri||'')?uri:''}catch{return''}
  }
  function queueContext(uri){try{const q=Array.isArray(queue)?queue:[],i=q.findIndex(t=>t?.uri===uri);if(i>=0)return[...new Set(q.slice(i,Math.min(q.length,i+30)).map(t=>t.uri).filter(x=>TRACK_URI.test(x)))];}catch{}return TRACK_URI.test(uri||'')?[uri]:[]}
  function exactNext(id){try{const q=Array.isArray(queue)?queue:[],i=q.findIndex(t=>t.id===id),uri=i>=0?q[i+1]?.uri:window.jfmUpcoming?.()?.[0]?.uri;return TRACK_URI.test(uri||'')?uri:''}catch{return''}}
  async function setVolume(v){const p=player();if(typeof p?.setVolume!=='function')return false;try{await p.setVolume(v);return true}catch{return false}}
  function fishAvailable(){const g=window.JFMDJAudioGuard;return !g||g.available?.()!==false}
  async function prepareSpeechSafe(text){if(!text)return false;if(!fishAvailable()){trace('fish-backoff-skip',{retryInMs:window.JFMDJAudioGuard?.retryIn?.()||0});return false}try{return(await window.prepareSpeech?.(text,false))!==false}catch(e){trace('speech-prepare-error',{message:String(e?.message||e)});return false}}

  // A DJ pause is NOT the same as a listener pressing pause. Do not call JFMPlayback.pause(),
  // because that clears expectedLive and tells recovery that music is intentionally stopped.
  async function silenceAndPause(rewind=false){
    trace('silence-start',{rewind});const volumeMuted=await setVolume(0);let confirmed=false;
    try{truth()?.patch?.({expectedLive:true,intent:'dj-handoff'},'dj-handoff-intent')}catch{}
    for(let i=0;i<5&&!confirmed;i++){
      try{const p=player();if(typeof p?.pause==='function')await p.pause()}catch{}
      try{const device=truth()?.get?.().deviceId||localStorage.getItem('jfm_spotify_device_id')||'';await api('/me/player/pause'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT'})}catch{}
      if(rewind){try{const p=player();if(typeof p?.seek==='function')await p.seek(0)}catch{};try{await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}}
      await wait(140+i*55);
      try{const p=player();if(typeof p?.getCurrentState==='function'){const s=await p.getCurrentState();if(s?.paused)confirmed=true}}catch{}
      if(!confirmed)try{const s=await live();if(s&&!s.is_playing)confirmed=true}catch{}
    }
    try{truth()?.patch?.({isPlaying:false,expectedLive:true,intent:'dj-handoff'},'dj-paused')}catch{}
    trace('paused',{confirmed,volumeMuted});return confirmed
  }
  async function verifyPlaying(expected=''){
    for(let i=0;i<6;i++){await wait(180+i*70);const s=await live();if(s?.is_playing&&(!expected||s.item?.uri===expected)){try{truth()?.ingest?.(s,'dj-resume')}catch{}return true}}
    return false
  }
  async function emergencyResume(preferredUri=''){
    await setVolume(1);const device=truth()?.get?.().deviceId||localStorage.getItem('jfm_spotify_device_id')||'';
    try{if(typeof window.JFMPlayback?.resume==='function'&&await window.JFMPlayback.resume()){trace('emergency-central-resume');return true}}catch{}
    try{await api('/me/player/play'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT'});if(await verifyPlaying('')){trace('emergency-api-resume');return true}}catch(e){trace('emergency-api-error',{message:String(e?.message||e)})}
    if(TRACK_URI.test(preferredUri||''))try{const list=queueContext(preferredUri);await api('/me/player/play'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT',body:{uris:list.length?list:[preferredUri],position_ms:0}});if(await verifyPlaying(preferredUri)){trace('emergency-uri-resume',{preferredUri});return true}}catch(e){trace('emergency-uri-error',{message:String(e?.message||e)})}
    return false
  }
  async function startExact(uri){
    if(!TRACK_URI.test(uri||'')){trace('resume-invalid-uri',{uri});return emergencyResume('')}
    const context=queueContext(uri),device=truth()?.get?.().deviceId||localStorage.getItem('jfm_spotify_device_id')||'';
    try{if(typeof window.JFMPlayback?.playUri==='function'){const ok=await window.JFMPlayback.playUri(uri);await setVolume(1);if(ok&&await verifyPlaying(uri)){trace('resumed-central',{uri});return true}}}catch(e){trace('resume-central-error',{message:String(e?.message||e)})}
    for(let i=0;i<3;i++){
      try{await api('/me/player/play'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT',body:{uris:context.length?context:[uri],position_ms:0}});if(await verifyPlaying(uri)){await setVolume(1);trace('resumed-api',{uri});return true}}catch(e){trace('resume-api-error',{message:String(e?.message||e),attempt:i+1})}
    }
    const recovered=await emergencyResume(uri);trace(recovered?'resume-failsafe-ok':'resume-failed',{uri});return recovered
  }
  async function makePack(track,manual,{prepareAudio=true}={}){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual),pack={text,fact,weather,speechReady:false,preparedAt:Date.now()};if(prepareAudio&&text)pack.speechReady=await prepareSpeechSafe(text);return pack}
  function imagingHistory(){try{return JSON.parse(localStorage.getItem(IMAGING_KEY)||'[]')}catch{return[]}}
  function rememberImaging(type,text){const h=imagingHistory();h.unshift({type,text,at:Date.now()});localStorage.setItem(IMAGING_KEY,JSON.stringify(h.slice(0,24)))}
  function recentImaging(type,minutes=12){const cut=Date.now()-minutes*60000;return imagingHistory().some(x=>x.type===type&&x.at>cut)}
  function freshPick(type,options){const recentText=imagingHistory().slice(0,8).map(x=>x.text),fresh=options.filter(x=>!recentText.includes(x)),pool=fresh.length?fresh:options,text=pool[Math.floor(Math.random()*pool.length)]||options[0]||'Josh FM.';rememberImaging(type,text);return text}
  function currentShow(){try{return window.JFMRadioClock?.showName?.()||'Josh FM'}catch{return'Josh FM'}}
  function currentPhase(){try{return window.JFMRadioClock?.clockPhase?.()||'open'}catch{return'open'}}
  function requestTrack(){try{return typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(playback?.item?trackObj(playback.item):null)}catch{return false}}
  function chooseImaging({manual=false}={}){if(manual)return null;const phase=currentPhase(),show=currentShow();if(phase==='top'&&!recentImaging('top',45))return{type:'top',text:freshPick('top',[`This is ${show}. Josh FM.`,`Josh FM. ${show} is on air.`,`On the hour, on Josh FM. ${show}.`])};if(requestTrack()&&!recentImaging('request',10))return{type:'request',text:freshPick('request',['Your request, on Josh FM.','You asked for it. Josh FM.'])};if((phase==='q1'||phase==='half'||phase==='q3')&&!recentImaging('show',18))return{type:'show',text:freshPick('show',[`${show}. On Josh FM.`,`You’re with ${show}, on Josh FM.`])};if(phase==='sweep'&&!recentImaging('sweep',8))return{type:'sweep',text:freshPick('sweep',['More music, less interruption. Josh FM.','Your music keeps moving. Josh FM.'])};if(!recentImaging('short',12)&&Math.random()<.22)return{type:'short',text:freshPick('short',['Josh FM.','This is Josh FM.'])};return null}
  async function renderAndSpeak(pack,{manual=false,jingle=true}={}){const text=pack?.text||'';if($('djText'))$('djText').textContent=text;$('factSource')?.classList.add('hidden');if(jingle&&$('jingles')?.checked&&!manual&&fishAvailable()){const imaging=chooseImaging({manual});if(imaging)try{trace('imaging-start',{type:imaging.type});const ok=await speakText(imaging.text,true);trace('imaging-end',{type:imaging.type,ok:ok!==false})}catch(e){trace('jingle-error',{message:String(e?.message||e)})}}trace('speak-start',{chars:text.length,prepared:!!pack?.speechReady});const ok=await speakText(text,false);trace('speak-end',{ok:ok!==false});return ok!==false}
  async function transition({track,manual=false,resumeUri='',rewindCurrent=false,prepared=null,label='DJ'}={}){
    if(lock||djBusy)return false;lock=true;djBusy=true;transitionSeq++;trace('transition-start',{manual,resumeUri,rewindCurrent,label});let uri=TRACK_URI.test(resumeUri||'')?resumeUri:'',pack=prepared,op=0,paused=false,resumed=false,opEnded=false;
    const endOp=(error='')=>{if(op&&!opEnded){try{truth()?.end?.(op,{error})}catch{}opEnded=true}};
    try{
      if(!uri)uri=await currentUri();
      if(!pack){status('DJ-break wordt voorbereid · muziek speelt door.');pack=await makePack(track,manual,{prepareAudio:true})}else if(pack.text&&!pack.speechReady)pack.speechReady=await prepareSpeechSafe(pack.text);
      if(!pack?.text||!pack.speechReady){status('DJ-break niet klaar · muziek blijft spelen.',true);trace('transition-not-ready');return false}
      op=truth()?.begin?.('dj-handoff',{expectedUri:uri,timeoutMs:45000})||0;
      paused=await silenceAndPause(!!rewindCurrent);
      if(!paused){endOp('Spotify pause not confirmed');status('DJ-break overgeslagen · Spotify kon niet veilig worden gepauzeerd.',true);trace('pause-unconfirmed');return false}
      const spoken=await renderAndSpeak(pack,{manual,jingle:true});await wait(80);resumed=await startExact(uri);endOp(resumed?'':'DJ handoff could not resume Spotify');
      status(resumed?(spoken?'DJ klaar · muziek hervat.':'DJ overgeslagen · muziek hervat.'):'DJ klaar · herstel van Spotify loopt.',!resumed);trace('transition-end',{resumed,spoken,uri});try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),500);return resumed&&spoken
    }catch(e){trace('transition-error',{message:String(e?.message||e)});if(!resumed)resumed=await emergencyResume(uri);endOp(String(e?.message||e));status(resumed?'DJ-fout · muziek veilig hervat.':'DJ-fout · Spotify kon niet automatisch herstellen.',!resumed);return false
    }finally{
      await setVolume(1);
      if(paused&&!resumed){const s=await live();if(!s?.is_playing)resumed=await emergencyResume(uri)}
      if(op&&!opEnded)endOp(resumed?'':'DJ handoff ended without confirmed resume');
      try{if(resumed)truth()?.patch?.({expectedLive:true,intent:'radio-live'},'dj-handoff-complete')}catch{}
      djBusy=false;lock=false
    }
  }
  window.JFMDJTransition={version:'unified-v7-intent-safe',transition,log:()=>[...log],imagingHistory:()=>imagingHistory(),get busy(){return lock},get prefetched(){return autoPrepared?{trackId:autoPrepared.trackId,ready:!!autoPrepared.pack?.speechReady}:null}};

  async function prepareArmed(){const a=armed;if(!a)return;const token=++prepToken;try{const pack=await makePack(a.track,true,{prepareAudio:true});if(token!==prepToken||!armed||armed.id!==a.id)return;armed.prepared=pack;trace('manual-prepared',{track:a.id,ready:!!pack.speechReady})}catch(e){trace('manual-prepare-error',{message:String(e?.message||e)})}}
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(lock||djBusy||!playback?.item?.id)return;const id=playback.item.id;if(armed?.id===id){armed=null;prepToken++;setArmed(false);trace('manual-disarmed');return}armed={id,track:trackObj(playback.item),fallbackUri:exactNext(id),prepared:null};setArmed(true);trace('manual-armed',{id});prepareArmed()},true);
  async function runArmed(){if(!armed||lock)return false;const a=armed;armed=null;setArmed(false);const liveUri=await currentUri();return transition({track:a.track,manual:true,resumeUri:liveUri||a.fallbackUri||'',prepared:a.prepared,label:'DJ Nu'})}
  // Only poll Spotify while a manual DJ break is armed. There is no permanent high-frequency API poll anymore.
  setInterval(async()=>{if(polling||lock||!armed||document.visibilityState!=='visible')return;polling=true;try{const s=await live();if(!s?.item)return;truth()?.ingest?.(s,'dj-arm-poll');if(s.item.id!==armed.id){await runArmed();return}const dur=Number(s.item.duration_ms||armed.track?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=2200)await runArmed()}finally{polling=false}},1200);

  function autoBreakDue(){try{return!skipNextTalk&&Number(tracksSinceTalk)+1>=Number(nextTalkAt)}catch{return false}}
  async function prefetchAutomatic(state){if(autoPreparing||lock||armed||!state?.item?.id||!autoBreakDue()||!fishAvailable())return;const id=state.item.id;if(lastAutoPrepId===id&&autoPrepared?.trackId===id)return;const dur=Number(state.item.duration_ms||0),left=dur-Number(state.progress_ms||0);if(!state.is_playing||dur<=0||left>30000||left<4500)return;autoPreparing=true;lastAutoPrepId=id;try{const pack=await makePack(trackObj(state.item),false,{prepareAudio:true});if(playback?.item?.id===id&&pack.speechReady){autoPrepared={trackId:id,pack,at:Date.now()};trace('auto-prefetch-ready',{id})}}catch(e){trace('auto-prefetch-error',{message:String(e?.message||e)})}finally{autoPreparing=false}}
  // Use the already-refreshed playback object instead of issuing another Spotify request every few seconds.
  setInterval(()=>{if(lock||armed||autoPreparing||document.visibilityState!=='visible')return;const s=cachedState();if(s?.item)prefetchAutomatic(s)},5000);
  window.addEventListener('jfm:playback-state',()=>{if(lock||armed||autoPreparing)return;const s=cachedState();if(s?.item)prefetchAutomatic(s)});

  window.djBreak=djBreak=async function(track=null,manual=false){if(lock||djBusy)return false;const uri=await currentUri(),target=track||(playback?.item?trackObj(playback.item):null),targetId=target?.id||'';let prepared=null;if(!manual&&autoPrepared&&autoPrepared.trackId===targetId){prepared=autoPrepared.pack;autoPrepared=null;trace('auto-prefetch-consumed',{targetId})}return transition({track:target,manual,resumeUri:uri,rewindCurrent:true,prepared,label:manual?'Manual break':'Automatic break'})};
})();
