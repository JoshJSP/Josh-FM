// Josh FM DJ transition engine — Fish-safe pre-generation and one owner for pause/speak/resume.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=$('djNow'),player=()=>window.jfmSpotifyPlayer||null,truth=()=>window.JFMPlaybackState||null;
  let lock=false,polling=false,armed=null,prepToken=0,transitionSeq=0,autoPrepared=null,autoPreparing=false,lastAutoPrepId='';
  const log=[];
  const IMAGING_KEY='jfm_imaging_history_v1';
  function trace(stage,extra={}){const item={at:Date.now(),seq:transitionSeq,stage,...extra};log.unshift(item);if(log.length>80)log.length=80;window.JFMDJTransitionLog=log}
  function status(text,bad=false){const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}}
  function setArmed(on){if(!btn)return;btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function currentUri(){try{const t=truth()?.get?.();if(t?.uri)return t.uri}catch{}try{const p=player();if(typeof p?.getCurrentState==='function'){const s=await p.getCurrentState();const uri=s?.track_window?.current_track?.uri;if(uri)return uri}}catch{}try{return(await live())?.item?.uri||''}catch{return''}}
  function queueContext(uri){try{const q=Array.isArray(queue)?queue:[],i=q.findIndex(t=>t?.uri===uri);if(i>=0)return q.slice(i,Math.min(q.length,i+30)).map(t=>t.uri).filter(Boolean)}catch{}return uri?[uri]:[]}
  function exactNext(id){try{const q=Array.isArray(queue)?queue:[],i=q.findIndex(t=>t.id===id);if(i>=0&&q[i+1]?.uri)return q[i+1].uri;return window.jfmUpcoming?.()?.[0]?.uri||''}catch{return''}}
  async function setVolume(v){const p=player();if(typeof p?.setVolume!=='function')return false;try{await p.setVolume(v);return true}catch{return false}}
  function fishAvailable(){const g=window.JFMDJAudioGuard;return !g||g.available?.()!==false}
  async function prepareSpeechSafe(text){if(!text)return false;if(!fishAvailable()){trace('fish-backoff-skip',{retryInMs:window.JFMDJAudioGuard?.retryIn?.()||0});return false}try{return (await window.prepareSpeech?.(text,false))!==false}catch(e){trace('speech-prepare-error',{message:String(e?.message||e)});return false}}
  async function silenceAndPause(rewind=false){
    trace('silence-start',{rewind});const volumeMuted=await setVolume(0);
    let confirmed=false;
    for(let i=0;i<6&&!confirmed;i++){
      try{const p=player();if(typeof p?.pause==='function')await p.pause()}catch{}
      try{await api('/me/player/pause',{method:'PUT'})}catch{}
      if(rewind){try{const p=player();if(typeof p?.seek==='function')await p.seek(0)}catch{};try{await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}}
      await wait(90+i*35);
      try{const p=player();if(typeof p?.getCurrentState==='function'){const s=await p.getCurrentState();if(s?.paused)confirmed=true}}catch{}
      if(!confirmed)try{const s=await live();if(s&&!s.is_playing)confirmed=true}catch{}
    }
    try{truth()?.patch?.({isPlaying:false},'dj-paused')}catch{}
    trace('paused',{confirmed,volumeMuted});return confirmed
  }
  async function startExact(uri){
    if(!uri){await setVolume(1);trace('resume-missing-uri');return false}
    const context=queueContext(uri),device=truth()?.get?.().deviceId||localStorage.getItem('jfm_spotify_device_id')||'';
    try{
      if(typeof window.JFMPlayback?.playUri==='function'){
        const ok=await window.JFMPlayback.playUri(uri);await setVolume(1);trace(ok?'resumed-central':'resume-central-failed',{uri,context:context.length});if(ok)return true
      }
    }catch(e){trace('resume-central-error',{message:String(e?.message||e)})}
    for(let i=0;i<5;i++){
      try{await api('/me/player/play'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT',body:{uris:context.length?context:[uri],position_ms:0}})}catch{}
      await wait(180+i*90);
      try{const s=await live();if(s?.item?.uri===uri&&s.is_playing){truth()?.ingest?.(s,'dj-resume');await setVolume(1);trace('resumed-api',{uri});return true}}catch{}
    }
    await setVolume(1);trace('resume-failed',{uri});return false
  }
  async function makePack(track,manual,{prepareAudio=true}={}){
    const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);
    const pack={text,fact,weather,speechReady:false,preparedAt:Date.now()};
    if(prepareAudio&&text)pack.speechReady=await prepareSpeechSafe(text);
    return pack
  }

  function imagingHistory(){try{return JSON.parse(localStorage.getItem(IMAGING_KEY)||'[]')}catch{return[]}}
  function rememberImaging(type,text){const h=imagingHistory();h.unshift({type,text,at:Date.now()});localStorage.setItem(IMAGING_KEY,JSON.stringify(h.slice(0,24)))}
  function recentImaging(type,minutes=12){const cut=Date.now()-minutes*60000;return imagingHistory().some(x=>x.type===type&&x.at>cut)}
  function freshPick(type,options){const recentText=imagingHistory().slice(0,8).map(x=>x.text);const fresh=options.filter(x=>!recentText.includes(x));const pool=fresh.length?fresh:options;const text=pool[Math.floor(Math.random()*pool.length)]||options[0]||'Josh FM.';rememberImaging(type,text);return text}
  function currentShow(){try{return window.JFMRadioClock?.showName?.()||'Josh FM'}catch{return'Josh FM'}}
  function currentPhase(){try{return window.JFMRadioClock?.clockPhase?.()||'open'}catch{return'open'}}
  function requestTrack(){try{return typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(playback?.item?trackObj(playback.item):null)}catch{return false}}
  function chooseImaging({manual=false}={}){
    if(manual)return null;const phase=currentPhase(),show=currentShow();
    if(phase==='top'&&!recentImaging('top',45))return{type:'top',text:freshPick('top',[`This is ${show}. Josh FM.`,`Josh FM. ${show} is on air.`,`On the hour, on Josh FM. ${show}.`])};
    if(requestTrack()&&!recentImaging('request',10))return{type:'request',text:freshPick('request',['Your request, on Josh FM.','You asked for it. Josh FM.','Request line to the radio. This is Josh FM.'])};
    if((phase==='q1'||phase==='half'||phase==='q3')&&!recentImaging('show',18))return{type:'show',text:freshPick('show',[`${show}. On Josh FM.`,`You’re with ${show}, on Josh FM.`,`Stay right here with ${show}.`])};
    if(phase==='sweep'&&!recentImaging('sweep',8))return{type:'sweep',text:freshPick('sweep',['More music, less interruption. Josh FM.','Your music keeps moving. Josh FM.','One station, your soundtrack. Josh FM.','Josh FM. Keep it right here.'])};
    if(!recentImaging('short',12)&&Math.random()<.22)return{type:'short',text:freshPick('short',['Josh FM.','This is Josh FM.','You’re listening to Josh FM.'])};return null
  }
  async function renderAndSpeak(pack,{manual=false,jingle=true}={}){
    const text=pack?.text||'';if($('djText'))$('djText').textContent=text;$('factSource')?.classList.add('hidden');
    if(jingle&&$('jingles')?.checked&&!manual&&fishAvailable()){
      const imaging=chooseImaging({manual});if(imaging){try{trace('imaging-start',{type:imaging.type});const ok=await speakText(imaging.text,true);trace('imaging-end',{type:imaging.type,ok:ok!==false})}catch(e){trace('jingle-error',{message:String(e?.message||e),type:imaging.type})}}
    }
    trace('speak-start',{chars:text.length,prepared:!!pack?.speechReady});const ok=await speakText(text,false);trace('speak-end',{ok:ok!==false});return ok!==false
  }
  async function transition({track,manual=false,resumeUri='',rewindCurrent=false,prepared=null,label='DJ'}={}){
    if(lock||djBusy)return false;lock=true;djBusy=true;transitionSeq++;trace('transition-start',{manual,resumeUri,rewindCurrent,label});
    let uri=resumeUri,pack=prepared,op=0,paused=false;
    try{
      if(!uri)uri=await currentUri();
      if(!pack){status('DJ-break wordt voorbereid · muziek speelt door.');pack=await makePack(track,manual,{prepareAudio:true})}
      else if(pack.text&&!pack.speechReady)pack.speechReady=await prepareSpeechSafe(pack.text);
      if(!pack?.text||!pack.speechReady){trace('transition-skipped-fish',{hasText:!!pack?.text,fishAvailable:fishAvailable()});status('Fish Audio niet beschikbaar · DJ-break overgeslagen, muziek blijft spelen.',true);try{scheduleTalk()}catch{};return false}
      op=truth()?.begin?.('dj-handoff',{expectedUri:uri,timeoutMs:45000})||0;
      paused=await silenceAndPause(!!rewindCurrent);
      if(!paused){trace('transition-abort-not-paused',{uri});if(op)truth()?.end?.(op,{error:'Spotify pause not confirmed'});status('DJ-break overgeslagen · Spotify kon niet veilig worden gepauzeerd.',true);return false}
      const spoken=await renderAndSpeak(pack,{manual,jingle:true});
      if(!spoken)trace('speech-failed-after-pause');
      await wait(60);const ok=await startExact(uri);
      if(op)truth()?.end?.(op,{error:ok?'':'DJ handoff could not resume Spotify'});
      status(ok?(spoken?'DJ klaar · muziek hervat.':'DJ overgeslagen · muziek hervat.'):'DJ klaar · muziek kon niet automatisch worden hervat.',!ok);trace('transition-end',{ok,spoken,uri,paused});
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),350);return ok&&spoken
    }catch(e){trace('transition-error',{message:String(e?.message||e)});let recovered=false;try{if(uri)recovered=await startExact(uri);else await setVolume(1)}catch{await setVolume(1)}if(op)truth()?.end?.(op,{error:String(e?.message||e)});status(recovered?'DJ-fout · muziek veilig hervat.':'DJ-fout · tik op Play als muziek niet hervat.',true);return false
    }finally{await setVolume(1);djBusy=false;lock=false}
  }
  window.JFMDJTransition={version:'unified-v5-capability-safe',transition,log:()=>[...log],imagingHistory:()=>imagingHistory(),get busy(){return lock},get prefetched(){return autoPrepared?{trackId:autoPrepared.trackId,ready:!!autoPrepared.pack?.speechReady}:null}};

  async function prepareArmed(){const a=armed;if(!a)return;const token=++prepToken;try{const pack=await makePack(a.track,true,{prepareAudio:true});if(token!==prepToken||!armed||armed.id!==a.id)return;armed.prepared=pack;trace(pack.speechReady?'manual-prepared':'manual-prepare-no-audio',{track:a.id})}catch(e){trace('manual-prepare-error',{message:String(e?.message||e)})}}
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(lock||djBusy||!playback?.item?.id)return;const id=playback.item.id;if(armed?.id===id){armed=null;prepToken++;setArmed(false);trace('manual-disarmed');return}armed={id,track:trackObj(playback.item),resumeUri:exactNext(id),prepared:null};setArmed(true);trace('manual-armed',{id,resumeUri:armed.resumeUri});prepareArmed()},true);
  async function runArmed(){if(!armed||lock)return false;const a=armed;armed=null;setArmed(false);return transition({track:a.track,manual:true,resumeUri:a.resumeUri||exactNext(a.id),rewindCurrent:false,prepared:a.prepared,label:'DJ Nu'})}
  setInterval(async()=>{if(polling||lock||!armed)return;polling=true;try{const s=await live();if(!s?.item)return;truth()?.ingest?.(s,'dj-arm-poll');if(s.item.id!==armed.id){await runArmed();return}const dur=Number(s.item.duration_ms||armed.track?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=2200)await runArmed()}finally{polling=false}},350);

  function autoBreakDue(){try{return !skipNextTalk&&Number(tracksSinceTalk)+1>=Number(nextTalkAt)}catch{return false}}
  async function prefetchAutomatic(state){
    if(autoPreparing||lock||armed||!state?.item?.id||!autoBreakDue()||!fishAvailable())return;
    const id=state.item.id;if(lastAutoPrepId===id&&autoPrepared?.trackId===id)return;
    const dur=Number(state.item.duration_ms||0),left=dur-Number(state.progress_ms||0);if(!state.is_playing||dur<=0||left>30000||left<4500)return;
    autoPreparing=true;lastAutoPrepId=id;const track=trackObj(state.item);trace('auto-prefetch-start',{id,left});
    try{const pack=await makePack(track,false,{prepareAudio:true});if(playback?.item?.id!==id){trace('auto-prefetch-stale',{id});return}if(pack.speechReady){autoPrepared={trackId:id,pack,at:Date.now()};trace('auto-prefetch-ready',{id,chars:pack.text?.length||0});status('DJ-break staat alvast klaar · muziek speelt door.')}else{autoPrepared=null;trace('auto-prefetch-no-audio',{id})}}
    catch(e){autoPrepared=null;trace('auto-prefetch-error',{id,message:String(e?.message||e)})}finally{autoPreparing=false}
  }
  setInterval(async()=>{if(lock||armed||autoPreparing)return;try{const s=await live();if(s?.item){truth()?.ingest?.(s,'dj-prefetch-poll');await prefetchAutomatic(s)}}catch{}},2200);

  window.djBreak=djBreak=async function(track=null,manual=false){
    if(lock||djBusy)return false;const uri=await currentUri(),target=track||(playback?.item?trackObj(playback.item):null),targetId=target?.id||'';
    let prepared=null;if(!manual&&autoPrepared&&autoPrepared.trackId===targetId){prepared=autoPrepared.pack;autoPrepared=null;trace('auto-prefetch-consumed',{targetId})}
    return transition({track:target,manual,resumeUri:uri,rewindCurrent:true,prepared,label:manual?'Manual break':'Automatic break'})
  };
})();
