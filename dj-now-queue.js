// Josh FM DJ transition engine — one owner for mute/pause/speak/resume.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=$('djNow'),player=()=>window.jfmSpotifyPlayer||null;
  let lock=false,polling=false,armed=null,prepToken=0,transitionSeq=0;
  const log=[];
  function trace(stage,extra={}){const item={at:Date.now(),seq:transitionSeq,stage,...extra};log.unshift(item);if(log.length>40)log.length=40;window.JFMDJTransitionLog=log}
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
  async function renderAndSpeak(pack,{manual=false,jingle=true}={}){
    const text=pack?.text||'';if($('djText'))$('djText').textContent=text;$('factSource')?.classList.add('hidden');
    if(jingle&&$('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch(e){trace('jingle-error',{message:String(e?.message||e)})}}
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
  window.JFMDJTransition={version:'unified-v1',transition,log:()=>[...log],get busy(){return lock}};

  async function prepareArmed(){const a=armed;if(!a)return;const token=++prepToken;try{const pack=await makePack(a.track,true);if(token!==prepToken||!armed||armed.id!==a.id)return;armed.prepared=pack;try{await window.prepareSpeech?.(pack.text,false)}catch{}trace('manual-prepared',{track:a.id})}catch(e){trace('manual-prepare-error',{message:String(e?.message||e)})}}
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(lock||djBusy||!playback?.item?.id)return;const id=playback.item.id;if(armed?.id===id){armed=null;prepToken++;setArmed(false);trace('manual-disarmed');return}armed={id,track:trackObj(playback.item),resumeUri:exactNext(id),prepared:null};setArmed(true);trace('manual-armed',{id,resumeUri:armed.resumeUri});prepareArmed()},true);

  async function runArmed(){if(!armed||lock)return false;const a=armed;armed=null;setArmed(false);return transition({track:a.track,manual:true,resumeUri:a.resumeUri||exactNext(a.id),rewindCurrent:false,prepared:a.prepared,label:'DJ Nu'})}
  setInterval(async()=>{if(polling||lock||!armed)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armed.id){await setVolume(0);await runArmed();return}const dur=Number(s.item.duration_ms||armed.track?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=2200)await runArmed()}finally{polling=false}},220);

  window.djBreak=djBreak=async function(track=null,manual=false){
    if(lock||djBusy)return false;
    const uri=await currentUri(),target=track||(playback?.item?trackObj(playback.item):null);
    return transition({track:target,manual,resumeUri:uri,rewindCurrent:true,label:manual?'Manual break':'Automatic break'})
  };
})();
