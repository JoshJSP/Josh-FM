// Josh FM DJ transition engine — one owner for mute/pause/speak/resume.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=$('djNow'),player=()=>window.jfmSpotifyPlayer||null;
  let lock=false,polling=false,armed=null,prepToken=0,transitionSeq=0,autoPrepared=null,autoPreparing=false,lastAutoPrepId='';
  const log=[];
  const IMAGING_KEY='jfm_imaging_history_v1';
  function trace(stage,extra={}){const item={at:Date.now(),seq:transitionSeq,stage,...extra};log.unshift(item);if(log.length>60)log.length=60;window.JFMDJTransitionLog=log}
  function status(text,bad=false){const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}}
  function setArmed(on){if(!btn)return;btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function currentUri(){try{const s=await player()?.getCurrentState();const uri=s?.track_window?.current_track?.uri;if(uri)return uri}catch{}try{return(await live())?.item?.uri||''}catch{return''}}
  function exactNext(id){try{const q=Array.isArray(queue)?queue:[],i=q.findIndex(t=>t.id===id);if(i>=0&&q[i+1]?.uri)return q[i+1].uri;return window.jfmUpcoming?.()?.[0]?.uri||''}catch{return''}}
  async function setVolume(v){try{await player()?.setVolume(v);return true}catch{return false}}
  async function silenceAndPause(rewind=false){
    trace('silence-start',{rewind});await setVolume(0);
    let confirmed=false;
    for(let i=0;i<6&&!confirmed;i++){
      try{await player()?.pause()}catch{}
      try{await api('/me/player/pause',{method:'PUT'})}catch{}
      if(rewind){try{await player()?.seek(0)}catch{};try{await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}}
      await wait(90+i*35);
      try{const s=await player()?.getCurrentState();if(s?.paused)confirmed=true}catch{}
      if(!confirmed)try{const s=await live();if(s&&!s.is_playing)confirmed=true}catch{}
    }
    trace('paused',{confirmed});return confirmed
  }
  async function startExact(uri){
    if(!uri){await setVolume(1);trace('resume-missing-uri');return false}
    const p=player(),device=localStorage.getItem('jfm_spotify_device_id')||'';
    for(let i=0;i<5;i++){
      try{await api('/me/player/play'+(device?'?device_id='+encodeURIComponent(device):''),{method:'PUT',body:{uris:[uri],position_ms:0}})}catch{}
      await wait(160+i*90);
      try{const s=await p?.getCurrentState(),cur=s?.track_window?.current_track;if(cur?.uri===uri){if(s.paused)await p.resume();try{await p.seek(0)}catch{};await setVolume(1);trace('resumed-sdk',{uri});return true}}catch{}
      try{const s=await live();if(s?.item?.uri===uri){if(!s.is_playing)try{await api('/me/player/play',{method:'PUT'})}catch{};try{await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{};await setVolume(1);trace('resumed-api',{uri});return true}}catch{}
    }
    await setVolume(1);trace('resume-failed',{uri});return false
  }
  async function makePack(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);return{text,fact,weather}}

  function imagingHistory(){try{return JSON.parse(localStorage.getItem(IMAGING_KEY)||'[]')}catch{return[]}}
  function rememberImaging(type,text){const h=imagingHistory();h.unshift({type,text,at:Date.now()});localStorage.setItem(IMAGING_KEY,JSON.stringify(h.slice(0,24)))}
  function recentImaging(type,minutes=12){const cut=Date.now()-minutes*60000;return imagingHistory().some(x=>x.type===type&&x.at>cut)}
  function freshPick(type,options){const recentText=imagingHistory().slice(0,8).map(x=>x.text);const fresh=options.filter(x=>!recentText.includes(x));const pool=fresh.length?fresh:options;const text=pool[Math.floor(Math.random()*pool.length)]||options[0]||'Josh FM.';rememberImaging(type,text);return text}
  function currentShow(){try{return window.JFMRadioClock?.showName?.()||'Josh FM'}catch{return'Josh FM'}}
  function currentPhase(){try{return window.JFMRadioClock?.clockPhase?.()||'open'}catch{return'open'}}
  function requestTrack(){try{return typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(playback?.item?trackObj(playback.item):null)}catch{return false}}
  function chooseImaging({manual=false}={}){
    if(manual)return null;
    const phase=currentPhase(),show=currentShow();
    if(phase==='top'&&!recentImaging('top',45))return{type:'top',text:freshPick('top',[`This is ${show}. Josh FM.`,`Josh FM. ${show} is on air.`,`On the hour, on Josh FM. ${show}.`])};
    if(requestTrack()&&!recentImaging('request',10))return{type:'request',text:freshPick('request',['Your request, on Josh FM.','You asked for it. Josh FM.','Request line to the radio. This is Josh FM.'])};
    if((phase==='q1'||phase==='half'||phase==='q3')&&!recentImaging('show',18))return{type:'show',text:freshPick('show',[`${show}. On Josh FM.`,`You’re with ${show}, on Josh FM.`,`Stay right here with ${show}.`])};
    if(phase==='sweep'&&!recentImaging('sweep',8))return{type:'sweep',text:freshPick('sweep',['More music, less interruption. Josh FM.','Your music keeps moving. Josh FM.','One station, your soundtrack. Josh FM.','Josh FM. Keep it right here.'])};
    if(!recentImaging('short',12)&&Math.random()<.22)return{type:'short',text:freshPick('short',['Josh FM.','This is Josh FM.','You’re listening to Josh FM.'])};
    return null
  }

  async function renderAndSpeak(pack,{manual=false,jingle=true}={}){
    const text=pack?.text||'';if($('djText'))$('djText').textContent=text;$('factSource')?.classList.add('hidden');
    if(jingle&&$('jingles')?.checked&&!manual){const imaging=chooseImaging({manual});if(imaging){try{trace('imaging-start',{type:imaging.type,text:imaging.text});await speakText(imaging.text,true);trace('imaging-end',{type:imaging.type})}catch(e){trace('jingle-error',{message:String(e?.message||e),type:imaging.type})}}}
    trace('speak-start',{chars:text.length});const ok=await speakText(text,false);trace('speak-end',{ok:ok!==false});return ok!==false
  }
  async function transition({track,manual=false,resumeUri='',rewindCurrent=false,prepared=null,label='DJ'}={}){
    if(lock||djBusy)return false;lock=true;djBusy=true;transitionSeq++;trace('transition-start',{manual,resumeUri,rewindCurrent,label});
    let uri=resumeUri;
    try{
      if(!uri)uri=await currentUri();
      await silenceAndPause(!!rewindCurrent);
      let pack=prepared;if(!pack)pack=await makePack(track,manual);
      await renderAndSpeak(pack,{manual,jingle:true});await wait(80);
      const ok=await startExact(uri);status(ok?'DJ klaar · muziek hervat.':'DJ klaar · muziek kon niet automatisch worden hervat.',!ok);trace('transition-end',{ok,uri});
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),350);return ok
    }catch(e){trace('transition-error',{message:String(e?.message||e)});try{if(uri)await startExact(uri);else await setVolume(1)}catch{await setVolume(1)}status('DJ-fout · muziekherstel uitgevoerd.',true);return false
    }finally{await setVolume(1);djBusy=false;lock=false}
  }
  window.JFMDJTransition={version:'unified-v3-imaging',transition,log:()=>[...log],imagingHistory:()=>imagingHistory(),get busy(){return lock},get prefetched(){return autoPrepared?{trackId:autoPrepared.trackId,ready:true}:null}};

  async function prepareArmed(){const a=armed;if(!a)return;const token=++prepToken;try{const pack=await makePack(a.track,true);if(token!==prepToken||!armed||armed.id!==a.id)return;armed.prepared=pack;try{await window.prepareSpeech?.(pack.text,false)}catch{}trace('manual-prepared',{track:a.id})}catch(e){trace('manual-prepare-error',{message:String(e?.message||e)})}}
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(lock||djBusy||!playback?.item?.id)return;const id=playback.item.id;if(armed?.id===id){armed=null;prepToken++;setArmed(false);trace('manual-disarmed');return}armed={id,track:trackObj(playback.item),resumeUri:exactNext(id),prepared:null};setArmed(true);trace('manual-armed',{id,resumeUri:armed.resumeUri});prepareArmed()},true);

  async function runArmed(){if(!armed||lock)return false;const a=armed;armed=null;setArmed(false);return transition({track:a.track,manual:true,resumeUri:a.resumeUri||exactNext(a.id),rewindCurrent:false,prepared:a.prepared,label:'DJ Nu'})}
  setInterval(async()=>{if(polling||lock||!armed)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armed.id){await setVolume(0);await runArmed();return}const dur=Number(s.item.duration_ms||armed.track?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=2200)await runArmed()}finally{polling=false}},220);

  function autoBreakDue(){try{return !skipNextTalk&&Number(tracksSinceTalk)+1>=Number(nextTalkAt)}catch{return false}}
  async function prefetchAutomatic(state){
    if(autoPreparing||lock||armed||!state?.item?.id||!autoBreakDue())return;
    const id=state.item.id;if(lastAutoPrepId===id&&autoPrepared?.trackId===id)return;
    const dur=Number(state.item.duration_ms||0),left=dur-Number(state.progress_ms||0);if(!state.is_playing||dur<=0||left>25000||left<3500)return;
    autoPreparing=true;lastAutoPrepId=id;const track=trackObj(state.item);trace('auto-prefetch-start',{id,left});
    try{const pack=await makePack(track,false);if(playback?.item?.id!==id){trace('auto-prefetch-stale',{id});return}autoPrepared={trackId:id,pack,at:Date.now()};try{await window.prepareSpeech?.(pack.text,false)}catch{}trace('auto-prefetch-ready',{id,chars:pack.text?.length||0});status('DJ-break staat alvast klaar · muziek speelt door.')}
    catch(e){autoPrepared=null;trace('auto-prefetch-error',{id,message:String(e?.message||e)})}
    finally{autoPreparing=false}
  }
  setInterval(async()=>{if(lock||armed||autoPreparing)return;try{const s=await live();if(s?.item){playback=s;await prefetchAutomatic(s)}}catch{}},1800);

  window.djBreak=djBreak=async function(track=null,manual=false){
    if(lock||djBusy)return false;
    const uri=await currentUri(),target=track||(playback?.item?trackObj(playback.item):null),targetId=target?.id||'';
    let prepared=null;if(!manual&&autoPrepared&&autoPrepared.trackId===targetId){prepared=autoPrepared.pack;autoPrepared=null;trace('auto-prefetch-consumed',{targetId})}
    return transition({track:target,manual,resumeUri:uri,rewindCurrent:true,prepared,label:manual?'Manual break':'Automatic break'})
  };
})();
