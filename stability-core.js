// Josh FM stability core — owns Spotify auth/SDK/device state only.
// Transport is owned by playback-primary.js, DJ handoff by dj-handoff-v34.js,
// and MediaSession metadata/position by pwa-platform.js.
(()=>{
  if(window.__jfmStabilityCoreInstalled)return;window.__jfmStabilityCoreInstalled=true;
  const $=id=>document.getElementById(id);
  const PKCE_V='jfm_pkce_verifier_v2',PKCE_S='jfm_pkce_state_v2',STREAM='jfm_streaming_ready_v2',DEVICE='jfm_spotify_device_id';
  let player=null,deviceId='',initPromise=null,lastEndSignal='',lastObserved=null,reconnectPromise=null,playbackErrorTimer=null;
  function signalNatural(track){if(!track?.id)return false;const sig=`${track.id}:${Math.floor(Number(track.durationMs||0)/1000)}`;if(lastEndSignal===sig)return false;lastEndSignal=sig;try{window.dispatchEvent(new CustomEvent('jfm:natural-track-end',{detail:{trackId:track.id,uri:track.uri||'',durationMs:Number(track.durationMs||0),positionMs:Number(track.positionMs||0),source:track.source||'sdk'}}))}catch{}return true}
  function message(text,bad=false){const el=$('queueInfo');if(el){el.textContent=text;el.style.color=bad?'#ffb4b4':''}}
  function setStatus(ok,text){const s=$('status');if(s){s.classList.toggle('on',ok);s.classList.toggle('off',!ok);s.textContent=text||(ok?'gekoppeld':'offline')}}
  function enable(ok){['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild'].forEach(id=>{const e=$(id);if(e)e.disabled=!ok})}
  function rememberPKCE(v,s){localStorage.setItem(PKCE_V,v);localStorage.setItem(PKCE_S,s);sessionStorage.setItem('jfm_verifier',v);sessionStorage.setItem('jfm_state',s)}
  function clearPKCE(){localStorage.removeItem(PKCE_V);localStorage.removeItem(PKCE_S);sessionStorage.removeItem('jfm_verifier');sessionStorage.removeItem('jfm_state')}
  function rememberDevice(id){deviceId=String(id||'').trim();if(deviceId)localStorage.setItem(DEVICE,deviceId);else localStorage.removeItem(DEVICE)}
  async function connectSpotify(){const id=spotifyClientId||$('clientId')?.value.trim();if(!id)throw Error('Spotify Client ID ontbreekt.');spotifyClientId=id;localStorage.setItem('jfm_client_id',id);const verifier=rand(),state=rand(20);rememberPKCE(verifier,state);localStorage.setItem('jfm_auth_requested_streaming','1');const challenge=b64url(await sha256(verifier));const scopes=['streaming','user-read-private','user-read-email','user-top-read','user-read-recently-played','user-read-currently-playing','user-read-playback-state','user-modify-playback-state','user-library-read','playlist-read-private'].join(' ');const p=new URLSearchParams({response_type:'code',client_id:id,scope:scopes,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});location.assign('https://accounts.spotify.com/authorize?'+p)}
  window.connect=connect=connectSpotify;
  async function repairCallback(){const q=new URLSearchParams(location.search),code=q.get('code');if(!code)return false;if(token||refreshToken)return true;const expected=sessionStorage.getItem('jfm_state')||localStorage.getItem(PKCE_S),got=q.get('state'),verifier=sessionStorage.getItem('jfm_verifier')||localStorage.getItem(PKCE_V);if(!expected||!verifier||got!==expected)throw Error('Spotify-beveiligingscontrole kon niet worden hersteld. Koppel opnieuw.');const id=spotifyClientId||localStorage.getItem('jfm_client_id');if(!id)throw Error('Spotify Client ID ontbreekt.');const body=new URLSearchParams({client_id:id,grant_type:'authorization_code',code,redirect_uri:redirectUri(),code_verifier:verifier}),r=await timedFetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)throw Error('Spotify-login kon niet worden afgerond.');const data=await r.json();saveToken(data);if((data.scope||'').split(' ').includes('streaming'))localStorage.setItem(STREAM,'1');clearPKCE();history.replaceState({},'',location.pathname);return true}
  function loadSDK(){if(window.Spotify)return Promise.resolve();return new Promise((resolve,reject)=>{const old=window.onSpotifyWebPlaybackSDKReady;window.onSpotifyWebPlaybackSDKReady=()=>{try{old?.()}catch{}resolve()};let s=document.getElementById('spotify-sdk-stable');if(s){const timer=setInterval(()=>{if(window.Spotify){clearInterval(timer);resolve()}},100);setTimeout(()=>{clearInterval(timer);if(!window.Spotify)reject(Error('Spotify-speler kon niet laden.'))},10000);return}s=document.createElement('script');s.id='spotify-sdk-stable';s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;s.onerror=()=>reject(Error('Spotify-speler kon niet laden.'));document.head.appendChild(s)})}
  async function initPlayer(){
    if(player&&deviceId)return deviceId;if(initPromise)return initPromise;
    initPromise=(async()=>{
      const t=await ensure();if(!t)throw Error('Spotify is niet gekoppeld.');await loadSDK();
      player=new Spotify.Player({name:'Josh FM',getOAuthToken:async cb=>{try{cb(await ensure()||'')}catch{cb('')}},volume:1,enableMediaSession:false});window.jfmSpotifyPlayer=player;
      const ready=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Josh FM-speler reageert niet.')),10000);
        player.addListener('ready',({device_id})=>{clearTimeout(timer);rememberDevice(device_id);localStorage.setItem(STREAM,'1');message('Spotify gekoppeld · Josh FM-speler klaar.');setStatus(true,'gekoppeld');enable(true);resolve(device_id)});
        player.addListener('not_ready',({device_id}={})=>{if(!device_id||device_id===deviceId)rememberDevice('');lastObserved=null;try{window.JFMPlaybackState?.patch?.({deviceId:'',deviceName:'',isPlaying:false},'sdk-not-ready')}catch{};message('Spotify-speler is tijdelijk offline.',true)});
        player.addListener('authentication_error',()=>{rememberDevice('');localStorage.removeItem(STREAM);message('Spotify moet één keer opnieuw gekoppeld worden voor afspelen in Josh FM.',true);enable(false);if($('connect'))$('connect').disabled=false});
        player.addListener('account_error',()=>message('Spotify Premium is nodig om muziek in Josh FM af te spelen.',true));
        player.addListener('autoplay_failed',()=>message('iPhone blokkeerde autoplay. Tik nogmaals op Start Josh FM.',true));
        player.addListener('playback_error',({message:m})=>{clearTimeout(playbackErrorTimer);playbackErrorTimer=setTimeout(()=>{playbackErrorTimer=null;const state=window.JFMPlaybackState?.get?.();if(state?.isPlaying&&Date.now()-Number(state.updatedAt||0)<4000){message('MAIR speelt.');return}message('Spotify-afspeelfout: '+m,true)},700)});
        player.addListener('player_state_changed',state=>{
          if(!state)return;const t=state.track_window?.current_track;
          if(!t){try{window.JFMPlaybackState?.ingest?.({item:null,is_playing:false,progress_ms:0,device:{id:deviceId,name:'Josh FM'}},'sdk-empty')}catch{};lastObserved=null;return}
          if(lastObserved?.id&&lastObserved.id!==t.id&&lastObserved.durationMs>0&&lastObserved.positionMs>=Math.max(0,lastObserved.durationMs-2500))signalNatural({...lastObserved,source:'sdk-track-advance'});
          const fake={item:{id:t.id,uri:t.uri,name:t.name,duration_ms:t.duration_ms,artists:(t.artists||[]).map(a=>({name:a.name})),album:{name:t.album?.name||'',images:t.album?.images||[]},external_urls:{spotify:t.id?`https://open.spotify.com/track/${t.id}`:''}},progress_ms:state.position,is_playing:!state.paused,device:{id:deviceId,name:'Josh FM'}};
          playback=fake;try{renderPlayback(fake)}catch{};try{window.JFMPlaybackState?.ingest?.(fake,'sdk')}catch{};if(!state.paused&&playbackErrorTimer){clearTimeout(playbackErrorTimer);playbackErrorTimer=null;message('MAIR speelt.')}
          const duration=Number(t.duration_ms||0),position=Number(state.position||0),nearEnd=duration>0&&position>=Math.max(0,duration-1300);
          // Spotify beeindigt een context in twee vormen: gepauzeerd op (bijna) de duur, of
          // dezelfde track gepauzeerd met de positie teruggeklapt naar ~0. Alleen die tweede
          // vorm heeft extra bewijs nodig, en dat bewijs is bewust smal: de vorige observatie
          // moet deze zelfde track zijn, nog spelend, binnen 3,5s van het einde. Een pauze van
          // de gebruiker houdt zijn positie vast en haalt deze test dus nooit; een device-
          // overdracht wist lastObserved eerst en kan het dus ook niet.
          const collapsedFromEnd=!!(state.paused&&!nearEnd&&position<=1500&&lastObserved&&lastObserved.id===t.id&&!lastObserved.paused&&lastObserved.durationMs>0&&lastObserved.positionMs>position&&lastObserved.positionMs>=Math.max(0,lastObserved.durationMs-3500));
          if(state.paused&&nearEnd)signalNatural({id:t.id,uri:t.uri,durationMs:duration,positionMs:position,source:'sdk-paused-end'});
          // Meld de bereikte eindpositie, niet de teruggeklapte 0: de canonieke
          // transitieclassificatie accepteert alleen bewijs binnen 3,5s van de duur.
          else if(collapsedFromEnd)signalNatural({id:t.id,uri:t.uri,durationMs:lastObserved.durationMs,positionMs:lastObserved.durationMs,source:'sdk-context-reset'});
          else if(!state.paused)lastEndSignal=''
          lastObserved={id:t.id,uri:t.uri,durationMs:duration,positionMs:position,paused:!!state.paused}
        })
      });
      ready.catch(()=>{});
      const ok=await Promise.race([player.connect(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Spotify Web Player verbinden duurde te lang.')),10000))]);if(!ok)throw Error('Spotify Web Player kon niet verbinden.');return ready
    })().catch(e=>{const failed=player;initPromise=null;player=null;window.jfmSpotifyPlayer=null;rememberDevice('');try{failed?.disconnect?.()}catch{}message(e.message||String(e),true);throw e});return initPromise
  }
  async function reconnect(){
    if(reconnectPromise)return reconnectPromise;
    reconnectPromise=(async()=>{const old=player;rememberDevice('');initPromise=null;player=null;window.jfmSpotifyPlayer=null;try{old?.disconnect?.()}catch{};await new Promise(r=>setTimeout(r,180));const id=await initPlayer();if(!id)throw Error('Spotify-device kon niet opnieuw worden geregistreerd.');return id})().finally(()=>{reconnectPromise=null});
    return reconnectPromise
  }
  async function isAvailable(id=deviceId){if(!id)return false;try{const d=await api('/me/player/devices');return Array.isArray(d?.devices)&&d.devices.some(x=>x?.id===id&&!x?.is_restricted)}catch{return false}}
  async function ensureDevice(){let id=deviceId;if(id&&await isAvailable(id))return id;return reconnect()}
  async function transfer(play=false){const id=await ensureDevice();await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});return id}
  async function playUris(uris){const id=await ensureDevice();await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris}});return true}
  function ownConnectButton(){const old=$('connect');if(!old||old.dataset.jfmAuthOwner==='1')return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmAuthOwner='1';fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();connectSpotify().catch(x=>message(x.message||String(x),true))},true)}
  async function reconcile(){try{await repairCallback();const t=await ensure();if(!t){rememberDevice('');setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message('Koppel Spotify om Josh FM te starten.');return}if(localStorage.getItem('jfm_auth_requested_streaming')==='1'){localStorage.setItem(STREAM,'1');localStorage.removeItem('jfm_auth_requested_streaming');clearPKCE()}try{setConnected(true)}catch{enable(true);setStatus(true,'gekoppeld')}message('Spotify gekoppeld · speler wordt voorbereid…');await initPlayer()}catch(e){rememberDevice('');setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message(e.message||String(e),true)}}
  ownConnectButton();setTimeout(reconcile,350);window.addEventListener('pageshow',()=>{ownConnectButton();setTimeout(reconcile,250)});
  window.JFMSpotifySDK={version:'sdk-core-v7-context-reset-end',init:initPlayer,reconnect,isAvailable,ensureDevice,transfer,playUris,get player(){return player},get deviceId(){return deviceId},get health(){return{installed:true,hasPlayer:!!player,deviceId,initializing:!!initPromise,reconnecting:!!reconnectPromise}}};
  window.MAIRRuntime?.register?.('spotify-sdk-core',{version:'sdk-core-v7-context-reset-end',owner:'spotify-sdk'});
})();
