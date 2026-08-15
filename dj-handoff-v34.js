// MAIR DJ handoff — executes one DJ break; scheduling is owned by JFMDJAuthoritative.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/,DEVICE=/^[A-Za-z0-9_-]{8,128}$/,LAST_BREAK_KEY='jfm_last_dj_break_at';
  const isiOS=()=>/iP(hone|ad|od)/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  let busy=false,restorePercent=100,restoreLocal=1;
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const truth=()=>window.JFMPlaybackState||null,player=()=>window.jfmSpotifyPlayer||null;
  const currentState=async()=>{try{return await api('/me/player')}catch{return null}};
  const validDevice=()=>{const raw=String(truth()?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return DEVICE.test(raw)?raw:''};
  const pathWithDevice=base=>{const id=validDevice();return id?base+(base.includes('?')?'&':'?')+'device_id='+encodeURIComponent(id):base};
  const sharedBusy=()=>{try{return !!djBusy}catch{return false}},setSharedBusy=v=>{try{djBusy=!!v}catch{}};
  function renderBreakTime(ts=Number(localStorage.getItem(LAST_BREAK_KEY)||0)){const el=$('djBreakTime');if(!el)return;if(!ts){el.textContent='nog niet';return}el.textContent=new Date(ts).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
  function recordBreakTime(){const ts=Date.now();try{localStorage.setItem(LAST_BREAK_KEY,String(ts))}catch{}renderBreakTime(ts)}
  async function rememberVolume(live){const p=player();const rp=Number(live?.device?.volume_percent);if(Number.isFinite(rp)&&rp>=0)restorePercent=Math.max(1,Math.min(100,rp));if(!isiOS()&&typeof p?.getVolume==='function')try{const v=await p.getVolume();if(Number.isFinite(v))restoreLocal=Math.max(.01,Math.min(1,v))}catch{}}
  async function setVolume(v){const p=player();if(isiOS()){const percent=v<=0?0:restorePercent;await api(pathWithDevice('/me/player/volume?volume_percent='+encodeURIComponent(percent)),{method:'PUT'});return}if(!p||typeof p.setVolume!=='function')throw Error('MAIR-volumecontroller is niet klaar.');await p.setVolume(v<=0?0:restoreLocal)}
  async function confirmedMute(){if(isiOS()){for(let i=0;i<4;i++){await wait(150+i*100);const s=await currentState(),v=Number(s?.device?.volume_percent);if(Number.isFinite(v)&&v<=1)return true}return false}const p=player();if(typeof p?.getVolume!=='function')return false;for(let i=0;i<5;i++){await wait(80+i*60);try{if(Number(await p.getVolume())<=.01)return true}catch{}}return false}
  async function pauseExpected(uri){try{await api(pathWithDevice('/me/player/pause'),{method:'PUT'})}catch{return false}for(let i=0;i<5;i++){await wait(160+i*110);const s=await currentState();if(s?.item?.uri===uri&&!s?.is_playing){try{truth()?.ingest?.(s,'dj-handoff-pause')}catch{};return true}}return false}
  async function resumeExpected(uri){try{await api(pathWithDevice('/me/player/play'),{method:'PUT'})}catch{return false}for(let i=0;i<5;i++){await wait(160+i*110);const s=await currentState();if(s?.item?.uri===uri&&s?.is_playing){try{truth()?.ingest?.(s,'dj-handoff-resume')}catch{};return true}}return false}
  async function buildSpeech(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);if(!text)return null;try{if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}}catch{}return{text,fact,weather}}
  async function speak(pack,manual){if(!pack?.text)return false;if($('djText'))$('djText').textContent=pack.text;if($('factSource'))$('factSource').classList.add('hidden');if($('jingles')?.checked&&!manual&&Math.random()<.2)try{await window.speakText?.('MAIR.',true)}catch{}try{return(await window.speakText?.(pack.text,false))===true}catch{return false}}
  async function rewindExpected(uri){const s=await currentState();if(s?.item?.uri!==uri)return false;const p=player();try{if(typeof p?.seek==='function')await p.seek(0);else await api(pathWithDevice('/me/player/seek?position_ms=0'),{method:'PUT'})}catch{return false}for(let i=0;i<5;i++){await wait(130+i*80);const x=await currentState();if(x?.item?.uri===uri&&Number(x.progress_ms||0)<1800){try{truth()?.ingest?.(x,'dj-handoff-rewind')}catch{};return true}}return false}
  async function runBreak(track=null,manual=false){if(busy||sharedBusy())return false;busy=true;setSharedBusy(true);let muteAttempted=false,muted=false,pausedForDJ=false,expectedUri='';try{
    const live=await currentState();expectedUri=TRACK_URI.test(live?.item?.uri||'')?live.item.uri:'';if(!live?.is_playing||!expectedUri)throw Error('Het nummer is nog niet actief.');
    const target=track||(live?.item?trackObj(live.item):null);
    // Prepare speech before muting/pausing so the silence is as short as possible.
    const pack=await buildSpeech(target,manual);if(!pack)throw Error('DJ-stem kon niet worden voorbereid.');
    await rememberVolume(live);
    if(isiOS()){
      pausedForDJ=await pauseExpected(expectedUri);if(!pausedForDJ)throw Error('Spotify kon niet veilig worden gepauzeerd.');
      status('DJ live · muziek is veilig gepauzeerd.');
    }else{
      muteAttempted=true;await setVolume(0);if(!(await confirmedMute()))throw Error('Mute kon niet veilig worden bevestigd.');muted=true;status('DJ live · muziek is bevestigd gedempt.');
    }
    try{truth()?.patch?.({expectedLive:true,intent:'dj-handoff'},'dj-handoff-muted')}catch{}
    const spoken=await speak(pack,manual);
    if(!spoken)throw Error('Fish Audio leverde geen hoorbare DJ-break.');
    const same=await currentState();if(same?.item?.uri!==expectedUri)throw Error('Track wisselde tijdens de DJ-break.');
    if(!(await rewindExpected(expectedUri)))throw Error('Het nummer kon niet veilig naar het begin worden gezet.');
    if(pausedForDJ){if(!(await resumeExpected(expectedUri)))throw Error('Het nummer kon na de DJ-break niet hervatten.');pausedForDJ=false}else{await setVolume(1);muteAttempted=false;muted=false}
    recordBreakTime();try{truth()?.patch?.({expectedLive:true,intent:'radio-live',progressMs:0},'dj-handoff-complete')}catch{};status('DJ klaar · nummer start vanaf het begin.');return true
  }catch(e){status(`DJ wacht · ${String(e?.message||e)}`,true);return false}finally{
    if(pausedForDJ)try{await rewindExpected(expectedUri);await resumeExpected(expectedUri)}catch{}
    if(muteAttempted||muted)try{await setVolume(1)}catch{};setSharedBusy(false);busy=false
  }}
  window.JFMDJTransition={version:'handoff-v37-transport-only',iosFallback:'pause-speak-rewind-resume',transition:({track=null,manual=false}={})=>runBreak(track,manual),get busy(){return busy}};
  window.JFMDJHandoff={version:'handoff-v37-transport-only',runBreak,get busy(){return busy},get lastBreakAt(){return Number(localStorage.getItem(LAST_BREAK_KEY)||0)}};
  renderBreakTime();window.addEventListener('pageshow',()=>renderBreakTime());
})();