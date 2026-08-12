// Josh FM DJ handoff v36 — next track stays active: mute -> DJ -> rewind -> unmute.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/,DEVICE=/^[A-Za-z0-9_-]{8,128}$/;
  let busy=false,armed=null,polling=false;
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const truth=()=>window.JFMPlaybackState||null,player=()=>window.jfmSpotifyPlayer||null;
  const currentState=async()=>{try{return await api('/me/player')}catch{return null}};
  const validDevice=()=>{const raw=String(truth()?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return DEVICE.test(raw)?raw:''};
  const pathWithDevice=base=>{const id=validDevice();return id?base+(base.includes('?')?'&':'?')+'device_id='+encodeURIComponent(id):base};
  const sharedBusy=()=>{try{return !!djBusy}catch{return false}},setSharedBusy=v=>{try{djBusy=!!v}catch{}};
  async function setVolume(v){const p=player();if(!p||typeof p.setVolume!=='function')throw Error('Josh FM-volumecontroller is niet klaar.');await p.setVolume(Math.max(0,Math.min(1,v)))}
  async function buildSpeech(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);if(!text)return null;try{if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}}catch{}return{text,fact,weather}}
  async function speak(pack,manual){if(!pack?.text)return false;if($('djText'))$('djText').textContent=pack.text;if($('factSource'))$('factSource').classList.add('hidden');if($('jingles')?.checked&&!manual&&Math.random()<.2)try{await speakText('Josh FM.',true)}catch{}try{return(await speakText(pack.text,false))!==false}catch{return false}}
  async function rewindExpected(uri){const s=await currentState();if(!s?.is_playing||s.item?.uri!==uri)return false;const p=player();try{if(typeof p?.seek==='function')await p.seek(0);else await api(pathWithDevice('/me/player/seek?position_ms=0'),{method:'PUT'})}catch{return false}for(let i=0;i<7;i++){await wait(100+i*35);const x=await currentState();if(x?.is_playing&&x.item?.uri===uri&&Number(x.progress_ms||0)<1800){try{truth()?.ingest?.(x,'dj-handoff-v36-rewind')}catch{};return true}}return false}
  async function runBreak(track=null,manual=false){
    if(busy||sharedBusy())return false;busy=true;setSharedBusy(true);let muted=false,expectedUri='';
    try{
      const live=await currentState();expectedUri=TRACK_URI.test(live?.item?.uri||'')?live.item.uri:'';
      if(!live?.is_playing||!expectedUri)throw Error('Het volgende nummer is nog niet actief.');
      // Exact radio flow: next song is already playing, then mute immediately.
      await setVolume(0);muted=true;try{truth()?.patch?.({expectedLive:true,intent:'dj-handoff'},'dj-handoff-v36-muted')}catch{};
      const target=track||(live?.item?trackObj(live.item):null);status('DJ live · nieuw nummer staat tijdelijk stil in de mix.');
      const pack=await buildSpeech(target,manual);let spoken=false;if(pack)spoken=await speak(pack,manual);
      const same=await currentState();if(same?.item?.uri===expectedUri){const rewound=await rewindExpected(expectedUri);if(!rewound)throw Error('Het nieuwe nummer kon niet veilig naar het begin worden gezet.');}
      await setVolume(1);muted=false;try{truth()?.patch?.({expectedLive:true,intent:'radio-live',progressMs:0},'dj-handoff-v36-complete')}catch{};
      try{scheduleTalk()}catch{};status(spoken?'DJ klaar · nummer start vanaf het begin.':'DJ overgeslagen · nummer start vanaf het begin.');setTimeout(()=>refresh().catch(()=>{}),250);return spoken
    }catch(e){status('DJ-fout · '+String(e?.message||e),true);return false}
    finally{if(muted)try{await setVolume(1)}catch{};setSharedBusy(false);busy=false}
  }
  function setArmedUi(on){const b=$('djNow');if(!b)return;b.dataset.queued=on?'1':'0';const strong=b.querySelector('b'),small=b.querySelector('span');if(strong)strong.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(small)small.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  function ownManualButton(){const old=$('djNow');if(!old||old.dataset.jfmHandoffOwner==='v36')return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmHandoffOwner='v36';fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(busy)return;const id=playback?.item?.id;if(!id)return;if(armed?.id===id){armed=null;setArmedUi(false);return}armed={id,track:trackObj(playback.item)};setArmedUi(true)},true)}
  setInterval(async()=>{if(polling||busy||!armed||document.visibilityState!=='visible')return;polling=true;try{const s=await currentState();if(s?.item?.id&&s.item.id!==armed.id){const a=armed;armed=null;setArmedUi(false);await runBreak(a.track,true)}}finally{polling=false}},900);
  window.djBreak=runBreak;
  window.JFMDJTransition={version:'handoff-v36-mute-rewind',transition:({track,manual=false}={})=>runBreak(track,manual),get busy(){return busy}};
  const boot=()=>{ownManualButton();if(!$('djNow'))setTimeout(boot,150)};boot();window.addEventListener('pageshow',()=>setTimeout(ownManualButton,200));
  window.JFMDJHandoff={version:'v36-mute-rewind',runBreak,get busy(){return busy},get armed(){return armed?.id||''}};
})();