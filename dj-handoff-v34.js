// Josh FM DJ handoff v36.2 — verified mute where supported; iOS pause/speak/rewind/resume fallback.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/,DEVICE=/^[A-Za-z0-9_-]{8,128}$/,LAST_BREAK_KEY='jfm_last_dj_break_at';
  const isiOS=()=>/iP(hone|ad|od)/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  let busy=false,armed=null,polling=false,armedConsumeBusy=false,restorePercent=100,restoreLocal=1;
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const truth=()=>window.JFMPlaybackState||null,player=()=>window.jfmSpotifyPlayer||null;
  const currentState=async()=>{try{return await api('/me/player')}catch{return null}};
  const validDevice=()=>{const raw=String(truth()?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return DEVICE.test(raw)?raw:''};
  const pathWithDevice=base=>{const id=validDevice();return id?base+(base.includes('?')?'&':'?')+'device_id='+encodeURIComponent(id):base};
  const sharedBusy=()=>{try{return !!djBusy}catch{return false}},setSharedBusy=v=>{try{djBusy=!!v}catch{}};
  function renderBreakTime(ts=Number(localStorage.getItem(LAST_BREAK_KEY)||0)){const el=$('djBreakTime');if(!el)return;if(!ts){el.textContent='nog niet';return}el.textContent=new Date(ts).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
  function recordBreakTime(){const ts=Date.now();try{localStorage.setItem(LAST_BREAK_KEY,String(ts))}catch{}renderBreakTime(ts)}
  async function rememberVolume(live){const p=player();const rp=Number(live?.device?.volume_percent);if(Number.isFinite(rp)&&rp>=0)restorePercent=Math.max(1,Math.min(100,rp));if(!isiOS()&&typeof p?.getVolume==='function')try{const v=await p.getVolume();if(Number.isFinite(v))restoreLocal=Math.max(.01,Math.min(1,v))}catch{}}
  async function setVolume(v){const p=player();if(isiOS()){const percent=v<=0?0:restorePercent;await api(pathWithDevice('/me/player/volume?volume_percent='+encodeURIComponent(percent)),{method:'PUT'});return}if(!p||typeof p.setVolume!=='function')throw Error('Josh FM-volumecontroller is niet klaar.');await p.setVolume(v<=0?0:restoreLocal)}
  async function confirmedMute(){if(isiOS()){for(let i=0;i<4;i++){await wait(120+i*80);const s=await currentState(),v=Number(s?.device?.volume_percent);if(Number.isFinite(v)&&v<=1)return true}return false}const p=player();if(typeof p?.getVolume!=='function')return false;for(let i=0;i<5;i++){await wait(80+i*60);try{if(Number(await p.getVolume())<=.01)return true}catch{}}return false}
  async function pauseExpected(uri){try{await api(pathWithDevice('/me/player/pause'),{method:'PUT'})}catch{return false}for(let i=0;i<7;i++){await wait(100+i*60);const s=await currentState();if(s?.item?.uri===uri&&!s?.is_playing)return true}return false}
  async function resumeExpected(uri){try{await api(pathWithDevice('/me/player/play'),{method:'PUT'})}catch{return false}for(let i=0;i<7;i++){await wait(100+i*60);const s=await currentState();if(s?.item?.uri===uri&&s?.is_playing)return true}return false}
  async function buildSpeech(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);if(!text)return null;try{if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}}catch{}return{text,fact,weather}}
  async function speak(pack,manual){if(!pack?.text)return false;if($('djText'))$('djText').textContent=pack.text;if($('factSource'))$('factSource').classList.add('hidden');if($('jingles')?.checked&&!manual&&Math.random()<.2)try{await window.speakText?.('Josh FM.',true)}catch{}try{return(await window.speakText?.(pack.text,false))!==false}catch{return false}}
  async function rewindExpected(uri){const s=await currentState();if(s?.item?.uri!==uri)return false;const p=player();try{if(typeof p?.seek==='function')await p.seek(0);else await api(pathWithDevice('/me/player/seek?position_ms=0'),{method:'PUT'})}catch{return false}for(let i=0;i<7;i++){await wait(100+i*35);const x=await currentState();if(x?.item?.uri===uri&&Number(x.progress_ms||0)<1800){try{truth()?.ingest?.(x,'dj-handoff-v36-rewind')}catch{};return true}}return false}
  async function runBreak(track=null,manual=false){if(busy||sharedBusy())return false;busy=true;setSharedBusy(true);let muteAttempted=false,muted=false,pausedForDJ=false,expectedUri='';try{
    const live=await currentState();expectedUri=TRACK_URI.test(live?.item?.uri||'')?live.item.uri:'';if(!live?.is_playing||!expectedUri)throw Error('Het volgende nummer is nog niet actief.');
    await rememberVolume(live);
    if(isiOS()){
      // iOS often exposes Spotify Web Playback but does not reliably confirm Web API volume changes.
      // Prefer a deterministic pause so the same audible Fish Audio route as the working voice test can run.
      pausedForDJ=await pauseExpected(expectedUri);if(!pausedForDJ)throw Error('DJ overgeslagen: Spotify kon niet veilig worden gepauzeerd.');
      status('DJ live · muziek is veilig gepauzeerd.');
    }else{
      muteAttempted=true;await setVolume(0);if(!(await confirmedMute()))throw Error('DJ overgeslagen: mute kon niet veilig worden bevestigd.');muted=true;status('DJ live · muziek is bevestigd gedempt.');
    }
    try{truth()?.patch?.({expectedLive:true,intent:'dj-handoff'},'dj-handoff-v36-muted')}catch{}
    const target=track||(live?.item?trackObj(live.item):null),pack=await buildSpeech(target,manual);let spoken=false;if(pack)spoken=await speak(pack,manual);
    const same=await currentState();if(same?.item?.uri!==expectedUri)throw Error('Track wisselde tijdens de DJ-break.');
    if(!(await rewindExpected(expectedUri)))throw Error('Het nieuwe nummer kon niet veilig naar het begin worden gezet.');
    if(pausedForDJ){if(!(await resumeExpected(expectedUri)))throw Error('Het nummer kon na de DJ-break niet hervatten.');pausedForDJ=false}else{await setVolume(1);muteAttempted=false;muted=false}
    if(spoken)recordBreakTime();try{truth()?.patch?.({expectedLive:true,intent:'radio-live',progressMs:0},'dj-handoff-v36-complete')}catch{};try{scheduleTalk()}catch{};status(spoken?'DJ klaar · nummer start vanaf het begin.':'DJ overgeslagen · nummer start vanaf het begin.');setTimeout(()=>refresh().catch(()=>{}),250);return spoken
  }catch(e){status(String(e?.message||e),true);return false}finally{
    if(pausedForDJ)try{await rewindExpected(expectedUri);await resumeExpected(expectedUri)}catch{}
    if(muteAttempted||muted)try{await setVolume(1)}catch{};setSharedBusy(false);busy=false
  }}
  function setArmedUi(on){const b=$('djNow');if(!b)return;b.dataset.queued=on?'1':'0';const strong=b.querySelector('b'),small=b.querySelector('span');if(strong)strong.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(small)small.textContent=on?'Praat bij het volgende nummer':'Laat hem iets vertellen'}
  function armManual(){const id=playback?.item?.id;if(!id)return false;if(armed?.fromId===id){armed=null;setArmedUi(false);return false}armed={fromId:id,requestedAt:Date.now()};setArmedUi(true);status('DJ staat klaar · skippen mag, hij praat bij het volgende nummer.');return true}
  async function consumeArmedIfChanged(state=null){if(armedConsumeBusy||busy||!armed)return false;const s=state||await currentState();const newId=s?.item?.id||'';if(!newId||newId===armed.fromId||!s?.is_playing)return false;armedConsumeBusy=true;const pending=armed;armed=null;setArmedUi(false);try{await wait(120);const live=await currentState();if(!live?.item?.id||live.item.id===pending.fromId||!live.is_playing){armed=pending;setArmedUi(true);return false}return await runBreak(null,true)}finally{armedConsumeBusy=false}}
  function ownManualButton(){const old=$('djNow');if(!old||old.dataset.jfmHandoffOwner==='v36')return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmHandoffOwner='v36';fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(!busy)armManual()},true)}
  setInterval(async()=>{if(polling||busy||!armed)return;polling=true;try{await consumeArmedIfChanged()}finally{polling=false}},450);
  window.addEventListener('jfm:trackchange',()=>setTimeout(()=>consumeArmedIfChanged().catch(()=>{}),80));
  window.addEventListener('jfm:natural-next-ready',()=>setTimeout(()=>consumeArmedIfChanged().catch(()=>{}),80));
  function installRefreshDelegate(){try{refresh=async function(){const d=await api('/me/player');if(!d?.item)return;playback=d;try{window.JFMPlaybackState?.ingest?.(d,'app-refresh-v221')}catch{};renderPlayback(d);consumeArmedIfChanged(d).catch(()=>{});const id=d.item.id;if(lastTrackId&&id!==lastTrackId){const ended=session.find(x=>x.id===lastTrackId)||null;if(!session.some(x=>x.id===id)){session.unshift(trackObj(d.item));session=session.slice(0,12);renderHistory()}tracksSinceTalk++;if(tracksSinceTalk>=nextTalkAt&&!sharedBusy()){if(skipNextTalk){skipNextTalk=false;scheduleTalk()}else{await runBreak(ended,false);scheduleTalk()}}}else if(!lastTrackId&&!session.some(x=>x.id===id)){session.unshift(trackObj(d.item));renderHistory()}lastTrackId=id};return true}catch{return false}}
  window.djBreak=runBreak;window.JFMDJTransition={version:'handoff-v36.2-mute-rewind-skip-safe',iosFallback:'pause-speak-rewind-resume',transition:({track,manual=false}={})=>runBreak(track,manual),get busy(){return busy}};
  const boot=()=>{renderBreakTime();ownManualButton();installRefreshDelegate();if(!$('djNow'))setTimeout(boot,150)};boot();window.addEventListener('pageshow',()=>{renderBreakTime();setTimeout(()=>{ownManualButton();installRefreshDelegate()},200)});
  window.JFMDJHandoff={version:'v36.2-mute-rewind-skip-safe',iosFallback:'pause-speak-rewind-resume',runBreak,consumeArmedIfChanged,get busy(){return busy},get armed(){return armed?.fromId||''},get lastBreakAt(){return Number(localStorage.getItem(LAST_BREAK_KEY)||0)}};
})();
