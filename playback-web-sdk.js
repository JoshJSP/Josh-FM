// Josh FM browser playback controller — makes Josh FM itself the Spotify device on iPhone/PWA.
(()=>{
  const $=id=>document.getElementById(id), wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id';
  let player=null,deviceId='',ready=false,connecting=false,lastError='',apiWrapped=false,controlsBusy=false;
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const setControlsBusy=on=>{controlsBusy=!!on;['prev','play','next','start'].forEach(id=>{const b=$(id);if(b)b.disabled=!!on})};
  async function token(){if(typeof ensure!=='function')throw Error('Spotify-sessie is niet beschikbaar.');const t=await ensure();if(!t)throw Error('Spotify is niet gekoppeld.');return t}
  function sdkState(){return{ready,deviceId,lastError,connecting}}
  function wrapApi(){
    if(apiWrapped||typeof api!=='function')return;const raw=api;
    api=window.api=async function(path,opt={}){
      let p=String(path||'');
      if(deviceId&&/^\/me\/player\/(play|pause|next|previous)(?:\?|$)/.test(p)&&!/[?&]device_id=/.test(p))p+=(p.includes('?')?'&':'?')+'device_id='+encodeURIComponent(deviceId);
      return raw(p,opt)
    };apiWrapped=true
  }
  function ingestSdkState(s){
    if(!s)return;
    try{window.JFMPlaybackState?.ingest?.(s,'web-playback-sdk')}catch{}
    const t=s.track_window?.current_track;if(!t)return;
    try{
      playback={item:t,is_playing:!s.paused,progress_ms:s.position||0,device:{id:deviceId,name:'Josh FM',type:'Computer',is_active:true}};
      renderPlayback(playback)
    }catch{}
  }
  async function loadSdk(){
    if(window.Spotify)return;
    await new Promise((resolve,reject)=>{
      const old=window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady=()=>{try{old?.()}catch{}resolve()};
      if(document.querySelector('script[data-jfm-spotify-sdk]')){setTimeout(()=>window.Spotify?resolve():reject(Error('Spotify SDK laden duurde te lang.')),7000);return}
      const s=document.createElement('script');s.src='https://sdk.scdn.co/spotify-player.js';s.dataset.jfmSpotifySdk='1';s.onerror=()=>reject(Error('Spotify Web Playback SDK kon niet worden geladen.'));document.head.appendChild(s)
    })
  }
  async function init(){
    if(ready&&player)return player;if(connecting){for(let i=0;i<40&&!ready;i++)await wait(150);return player}
    connecting=true;lastError='';
    try{
      await loadSdk();
      player=new Spotify.Player({name:'Josh FM',getOAuthToken:cb=>token().then(cb).catch(e=>{lastError=e.message;status(e.message,true)}),volume:1});
      player.addListener('ready',({device_id})=>{deviceId=device_id;ready=true;localStorage.setItem(DEVICE_KEY,deviceId);wrapApi();status('Josh FM-player verbonden. Klaar om te starten.');try{window.JFMPlaybackState?.patch?.({deviceId,deviceName:'Josh FM'},'sdk-ready')}catch{}});
      player.addListener('not_ready',({device_id})=>{if(device_id===deviceId)ready=false;status('Josh FM-player is tijdelijk offline. Opnieuw verbinden…',true);setTimeout(()=>init().catch(()=>{}),1200)});
      player.addListener('player_state_changed',ingestSdkState);
      player.addListener('autoplay_failed',()=>status('Tik nogmaals op Start Josh FM om audio op je iPhone te activeren.',true));
      player.addListener('initialization_error',({message})=>{lastError=message;status('Browser-player kon niet starten: '+message,true)});
      player.addListener('authentication_error',({message})=>{lastError=message;status('Spotify-login verlopen. Koppel Spotify opnieuw.',true)});
      player.addListener('account_error',()=>{lastError='Spotify Premium vereist';status('Spotify Premium is nodig om muziek rechtstreeks in Josh FM af te spelen.',true)});
      player.addListener('playback_error',({message})=>{lastError=message;status('Afspeelfout: '+message,true)});
      const ok=await player.connect();if(!ok)throw Error('Spotify browser-player maakte geen verbinding.');
      for(let i=0;i<50&&!ready;i++)await wait(100);
      return player
    }finally{connecting=false}
  }
  function activateFromGesture(){try{player?.activateElement?.()}catch{}}
  ['start','play','next','prev','djNow'].forEach(id=>document.addEventListener('click',e=>{if(e.target?.closest?.('#'+id))activateFromGesture()},true));
  async function transfer(play=false){await init();if(!deviceId)throw Error('Josh FM-afspeelapparaat is nog niet klaar.');await api('/me/player',{method:'PUT',body:{device_ids:[deviceId],play:!!play}});return deviceId}
  async function currentRemote(){try{return await api('/me/player')}catch{return null}}
  async function ensureActiveDevice(){
    await init();if(!deviceId)throw Error('Josh FM-afspeelapparaat is nog niet klaar.');
    const remote=await currentRemote();
    if(remote?.device?.id!==deviceId){await transfer(!!remote?.is_playing);await wait(180)}
    return remote
  }
  async function verifiedState(tries=8){for(let i=0;i<tries;i++){await wait(180+i*60);try{const s=await api('/me/player');if(s?.device?.id===deviceId)return s}catch{}}return null}
  async function verifyTransport(kind,before){
    for(let i=0;i<8;i++){
      await wait(140+i*55);const s=await currentRemote();if(!s||s.device?.id!==deviceId)continue;
      if(kind==='play'&&!!s.is_playing!==!!before?.is_playing)return s;
      if(kind==='next'&&s.item?.id&&s.item.id!==before?.item?.id)return s;
      if(kind==='prev'&&s.item?.id&&s.item.id!==before?.item?.id)return s;
    }
    return null
  }
  const legacyStart=typeof startRadio==='function'?startRadio:null;
  async function startWebRadio(){
    activateFromGesture();
    if(controlsBusy)return;setControlsBusy(true);status('Josh FM-player wordt gestart…');
    try{
      await init();
      if(!queue?.length)await buildSet();if(!queue?.length)throw Error('Ik kon geen tracks voor de radioset vinden.');
      if($('jingles')?.checked&&typeof speakText==='function'){status('Josh FM-jingle…');await speakText('Josh FM. Your music, your radio show.',true).catch(()=>{})}
      await transfer(false);const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);if(!uris.length)throw Error('De radioset bevat geen afspeelbare Spotify-tracks.');
      await api('/me/player/play?device_id='+encodeURIComponent(deviceId),{method:'PUT',body:{uris,position_ms:0}});
      const s=await verifiedState();if(!s?.is_playing)throw Error('Spotify bevestigde de browser-playback niet.');
      session=[];lastTrackId=null;renderHistory();scheduleTalk();try{window.JFMPlaybackState?.setExpectedLive?.(true,'radio-live')}catch{};startPolling();await refresh();status(`Josh FM is live · ${queue.length} tracks klaar.`)
    }catch(e){lastError=String(e?.message||e);status('Starten lukte niet: '+lastError,true);throw e}finally{setControlsBusy(false)}
  }
  async function transport(kind){
    // IMPORTANT on iOS: activateElement must run synchronously inside the user's tap,
    // before any await. The capture listener above does this too; this is a second guard.
    activateFromGesture();
    if(controlsBusy)return;setControlsBusy(true);
    try{
      await init();
      const before=await ensureActiveDevice();
      status(kind==='play'?(before?.is_playing?'Pauzeren…':'Afspelen…'):(kind==='next'?'Volgende nummer…':'Vorige nummer…'));
      if(kind==='next'){
        if(before?.item?.id)try{recordSkip(before.item.id)}catch{};
        await api('/me/player/next?device_id='+encodeURIComponent(deviceId),{method:'POST'});
      }else if(kind==='prev'){
        await api('/me/player/previous?device_id='+encodeURIComponent(deviceId),{method:'POST'});
      }else if(kind==='play'){
        if(before?.is_playing)await api('/me/player/pause?device_id='+encodeURIComponent(deviceId),{method:'PUT'});
        else await api('/me/player/play?device_id='+encodeURIComponent(deviceId),{method:'PUT'});
      }
      let confirmed=await verifyTransport(kind,before);
      if(!confirmed&&kind==='play'){
        // SDK fallback for browsers where the Web API command is accepted but state lags.
        if(before?.is_playing)await player.pause();else await player.resume();
        confirmed=await verifyTransport(kind,before)
      }
      if(!confirmed)throw Error('Spotify bevestigde de bediening niet.');
      ingestSdkState(await player.getCurrentState().catch(()=>null));
      await refresh().catch(()=>{});
      status(confirmed.is_playing?'Josh FM speelt.':'Josh FM staat gepauzeerd.')
    }catch(e){lastError=String(e?.message||e);status('Bediening mislukt: '+lastError,true);throw e}finally{setControlsBusy(false)}
  }
  try{startRadio=startWebRadio}catch{}
  try{control=transport}catch{}
  window.JFMWebPlayer={version:'web-sdk-v2-ios-controls',init,transfer,activate:activateFromGesture,start:startWebRadio,next:()=>transport('next'),previous:()=>transport('prev'),toggle:()=>transport('play'),getCurrentState:()=>player?.getCurrentState?.(),setVolume:v=>player?.setVolume?.(v),seek:ms=>player?.seek?.(ms),pause:()=>player?.pause?.(),resume:()=>player?.resume?.(),get player(){return player},get deviceId(){return deviceId},get state(){return sdkState()}};
  window.jfmSpotifyPlayer=window.JFMWebPlayer;
  window.addEventListener('pageshow',()=>{navigator.serviceWorker?.getRegistration?.().then(r=>r?.update?.()).catch(()=>{});if(localStorage.getItem('jfm_token'))init().catch(()=>{})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&localStorage.getItem('jfm_token'))init().catch(()=>{})});
  // Warm the SDK/player before the first user tap so iOS can synchronously activate it.
  const warm=()=>{if(localStorage.getItem('jfm_token'))init().catch(()=>{})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(warm,120));else setTimeout(warm,120);
  setTimeout(warm,700);
})();
