// MAIR stability core — owns Spotify auth/SDK/device state only.
// Transport is owned by playback-primary.js; MediaSession remains owned elsewhere.
(()=>{
  if(window.__jfmStabilityCoreInstalled)return;window.__jfmStabilityCoreInstalled=true;
  const $=id=>document.getElementById(id);
  const PKCE_V='jfm_pkce_verifier_v2',PKCE_S='jfm_pkce_state_v2',STREAM='jfm_streaming_ready_v2',DEVICE='jfm_spotify_device_id';
  let player=null,deviceId='',initPromise=null,lastEndSignal='',lastObserved=null,reconnectPromise=null,playbackErrorTimer=null,authRecoveryPromise=null;
  function signalNatural(track){if(!track?.id)return false;const sig=`${track.id}:${Math.floor(Number(track.durationMs||0)/1000)}`;if(lastEndSignal===sig)return false;lastEndSignal=sig;try{window.dispatchEvent(new CustomEvent('jfm:natural-track-end',{detail:{trackId:track.id,uri:track.uri||'',durationMs:Number(track.durationMs||0),positionMs:Number(track.positionMs||0),source:track.source||'sdk'}}))}catch{}return true}
  function message(text,bad=false){const el=$('queueInfo');if(el){el.textContent=text;el.style.color=bad?'#ffb4b4':''}}
  function setStatus(ok,text){const s=$('status');if(s){s.classList.toggle('on',ok);s.classList.toggle('off',!ok);s.textContent=text||(ok?'gekoppeld':'offline')}}
  function enable(ok){['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild'].forEach(id=>{const e=$(id);if(e)e.disabled=!ok})}
  function emit(name,detail={}){try{window.dispatchEvent(new CustomEvent(name,{detail:{...detail,at:Date.now()}}))}catch{}}
  function authState(){
    const rel=window.MAIRSpotifySessionReliability?.state||{},base=window.JFMAuth?.state||{};
    let storedRefresh=false,storedAccess=false;try{storedRefresh=!!localStorage.getItem('jfm_refresh');storedAccess=!!localStorage.getItem('jfm_token')}catch{}
    const hasRefresh=rel.hasRefreshToken??base.hasRefreshToken??storedRefresh,hasAccess=rel.hasAccessToken??base.hasAccessToken??storedAccess,reauthRequired=!!rel.reauthRequired;
    return{hasRefreshToken:!!hasRefresh,hasAccessToken:!!hasAccess,reauthRequired,authenticated:!!(hasRefresh||hasAccess)&&!reauthRequired}
  }
  function showAuthorizedRecovery(text='Spotify-speler wordt opnieuw klaargezet…'){setStatus(true,'gekoppeld');enable(true);message(text,true);emit('mair:spotify-device-recovering',{authenticated:true})}
  function showReauthRequired(text='Spotify-sessie is verlopen. Koppel Spotify opnieuw.'){localStorage.removeItem(STREAM);setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message(text,true);emit('mair:user-error',{scope:'auth',error:text})}
  function rememberPKCE(v,s){localStorage.setItem(PKCE_V,v);localStorage.setItem(PKCE_S,s);sessionStorage.setItem('jfm_verifier',v);sessionStorage.setItem('jfm_state',s)}
  function clearPKCE(){localStorage.removeItem(PKCE_V);localStorage.removeItem(PKCE_S);sessionStorage.removeItem('jfm_verifier');sessionStorage.removeItem('jfm_state')}
  function rememberDevice(id){deviceId=String(id||'').trim();if(deviceId)localStorage.setItem(DEVICE,deviceId);else localStorage.removeItem(DEVICE)}
  async function connectSpotify(){const id=spotifyClientId||$('clientId')?.value.trim();if(!id)throw Error('Spotify Client ID ontbreekt.');spotifyClientId=id;localStorage.setItem('jfm_client_id',id);const verifier=rand(),state=rand(20);rememberPKCE(verifier,state);localStorage.setItem('jfm_auth_requested_streaming','1');const challenge=b64url(await sha256(verifier));const scopes=['streaming','user-read-private','user-read-email','user-top-read','user-read-recently-played','user-read-currently-playing','user-read-playback-state','user-modify-playback-state','user-library-read','playlist-read-private'].join(' ');const p=new URLSearchParams({response_type:'code',client_id:id,scope:scopes,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});location.assign('https://accounts.spotify.com/authorize?'+p)}
  window.connect=connect=connectSpotify;
  async function repairCallback(){const q=new URLSearchParams(location.search),code=q.get('code');if(!code)return false;if(token||refreshToken)return true;const expected=sessionStorage.getItem('jfm_state')||localStorage.getItem(PKCE_S),got=q.get('state'),verifier=sessionStorage.getItem('jfm_verifier')||localStorage.getItem(PKCE_V);if(!expected||!verifier||got!==expected)throw Error('Spotify-beveiligingscontrole kon niet worden hersteld. Koppel opnieuw.');const id=spotifyClientId||localStorage.getItem('jfm_client_id');if(!id)throw Error('Spotify Client ID ontbreekt.');const body=new URLSearchParams({client_id:id,grant_type:'authorization_code',code,redirect_uri:redirectUri(),code_verifier:verifier}),r=await timedFetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)throw Error('Spotify-login kon niet worden afgerond.');const data=await r.json();saveToken(data);if((data.scope||'').split(' ').includes('streaming'))localStorage.setItem(STREAM,'1');clearPKCE();history.replaceState({},'',location.pathname);return true}
  function loadSDK(){if(window.Spotify)return Promise.resolve();return new Promise((resolve,reject)=>{const old=window.onSpotifyWebPlaybackSDKReady;window.onSpotifyWebPlaybackSDKReady=()=>{try{old?.()}catch{}resolve()};let s=document.getElementById('spotify-sdk-stable');if(s){const timer=setInterval(()=>{if(window.Spotify){clearInterval(timer);resolve()}},100);setTimeout(()=>{clearInterval(timer);if(!window.Spotify)reject(Error('Spotify-speler kon niet laden.'))},10000);return}s=document.createElement('script');s.id='spotify-sdk-stable';s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;s.onerror=()=>reject(Error('Spotify-speler kon niet laden.'));document.head.appendChild(s)})}
  async function handleAuthenticationError(){
    if(authRecoveryPromise)return authRecoveryPromise;
    authRecoveryPromise=(async()=>{
      rememberDevice('');
      const before=authState();if(before.reauthRequired){showReauthRequired();return false}
      try{
        const t=await window.JFMAuth?.ensure?.();
        const after=authState();if(t||after.authenticated){showAuthorizedRecovery('Spotify-sessie is geldig · speler wordt opnieuw klaargezet…');emit('mair:spotify-auth-recovered');setTimeout(()=>reconnect().catch(()=>false),180);return true}
      }catch(e){if(e?.code==='AUTH_REAUTH_REQUIRED'||authState().reauthRequired){showReauthRequired();return false}}
      const after=authState();if(after.authenticated){showAuthorizedRecovery('Spotify reageert tijdelijk niet. Je koppeling blijft bewaard.');return false}
      showReauthRequired();return false
    })().finally(()=>{authRecoveryPromise=null});return authRecoveryPromise
  }
  async function initPlayer(){
    if(player&&deviceId)return deviceId;if(initPromise)return initPromise;
    initPromise=(async()=>{
      const t=await ensure();if(!t)throw Error('Spotify is niet gekoppeld.');await loadSDK();
      player=new Spotify.Player({name:'MAIRFM',getOAuthToken:async cb=>{try{cb(await ensure()||'')}catch{cb('')}},volume:1,enableMediaSession:false});window.jfmSpotifyPlayer=player;
      const ready=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('MAIRFM-speler reageert niet.')),10000);
        player.addListener('ready',({device_id})=>{clearTimeout(timer);rememberDevice(device_id);localStorage.setItem(STREAM,'1');message('Spotify gekoppeld · MAIRFM-speler klaar.');setStatus(true,'gekoppeld');enable(true);emit('mair:spotify-device-recovered',{deviceId:device_id,source:'sdk-ready'});resolve(device_id)});
        player.addListener('not_ready',({device_id}={})=>{if(!device_id||device_id===deviceId)rememberDevice('');try{window.JFMPlaybackState?.patch?.({deviceId:'',deviceName:'',isPlaying:false},'sdk-not-ready')}catch{};const a=authState();if(a.authenticated)showAuthorizedRecovery('Spotify-speler is tijdelijk offline. MAIRFM probeert hem te herstellen.');else message('Spotify-speler is tijdelijk offline.',true);emit('mair:spotify-device-lost',{deviceId:device_id||''})});
        player.addListener('authentication_error',()=>{handleAuthenticationError().catch(()=>false)});
        player.addListener('account_error',()=>{message('Spotify Premium is nodig om muziek in MAIRFM af te spelen.',true);emit('mair:user-error',{scope:'playback',error:'Spotify Premium is nodig.'})});
        player.addListener('autoplay_failed',()=>{message('iPhone wacht op een tik om audio te hervatten.',true);emit('mair:spotify-gesture-required')});
        player.addListener('playback_error',({message:m})=>{clearTimeout(playbackErrorTimer);playbackErrorTimer=setTimeout(()=>{playbackErrorTimer=null;const state=window.JFMPlaybackState?.get?.();if(state?.isPlaying&&Date.now()-Number(state.updatedAt||0)<4000){message('MAIR speelt.');return}message('Spotify-afspeelfout: '+m,true)},700)});
        player.addListener('player_state_changed',state=>{
          if(!state)return;const t=state.track_window?.current_track;
          if(!t){try{window.JFMPlaybackState?.ingest?.({item:null,is_playing:false,progress_ms:0,device:{id:deviceId,name:'MAIRFM'}},'sdk-empty')}catch{};lastObserved=null;return}
          if(lastObserved?.id&&lastObserved.id!==t.id&&lastObserved.durationMs>0&&lastObserved.positionMs>=Math.max(0,lastObserved.durationMs-2500))signalNatural({...lastObserved,source:'sdk-track-advance'});
          const fake={item:{id:t.id,uri:t.uri,name:t.name,duration_ms:t.duration_ms,artists:(t.artists||[]).map(a=>({name:a.name})),album:{name:t.album?.name||'',images:t.album?.images||[]},external_urls:{spotify:t.id?`https://open.spotify.com/track/${t.id}`:''}},progress_ms:state.position,is_playing:!state.paused,device:{id:deviceId,name:'MAIRFM'}};
          playback=fake;try{renderPlayback(fake)}catch{};try{window.JFMPlaybackState?.ingest?.(fake,'sdk')}catch{};if(!state.paused){if(playbackErrorTimer){clearTimeout(playbackErrorTimer);playbackErrorTimer=null}message('MAIR speelt.');setStatus(true,'gekoppeld');enable(true)}
          const duration=Number(t.duration_ms||0),position=Number(state.position||0),nearEnd=duration>0&&position>=Math.max(0,duration-1300);
          if(state.paused&&nearEnd)signalNatural({id:t.id,uri:t.uri,durationMs:duration,positionMs:position,source:'sdk-paused-end'});else if(!state.paused)lastEndSignal='';lastObserved={id:t.id,uri:t.uri,durationMs:duration,positionMs:position,paused:!!state.paused}
        })
      });
      ready.catch(()=>{});
      const ok=await Promise.race([player.connect(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Spotify Web Player verbinden duurde te lang.')),10000))]);if(!ok)throw Error('Spotify Web Player kon niet verbinden.');return ready
    })().catch(e=>{const failed=player;initPromise=null;player=null;window.jfmSpotifyPlayer=null;rememberDevice('');try{failed?.disconnect?.()}catch{};message(e.message||String(e),true);throw e});return initPromise
  }
  async function reconnect(){if(reconnectPromise)return reconnectPromise;reconnectPromise=(async()=>{const old=player;rememberDevice('');initPromise=null;player=null;window.jfmSpotifyPlayer=null;try{old?.disconnect?.()}catch{};await new Promise(r=>setTimeout(r,180));const id=await initPlayer();if(!id)throw Error('Spotify-device kon niet opnieuw worden geregistreerd.');return id})().finally(()=>{reconnectPromise=null});return reconnectPromise}
  async function isAvailable(id=deviceId){if(!id)return false;try{const d=await api('/me/player/devices');return Array.isArray(d?.devices)&&d.devices.some(x=>x?.id===id&&!x?.is_restricted)}catch{return false}}
  async function ensureDevice(){let id=deviceId;if(id&&await isAvailable(id))return id;return reconnect()}
  async function transfer(play=false){const id=await ensureDevice();await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});return id}
  async function playUris(uris){const id=await ensureDevice();await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris}});return true}
  function ownConnectButton(){const old=$('connect');if(!old||old.dataset.jfmAuthOwner==='1')return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmAuthOwner='1';fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();connectSpotify().catch(x=>message(x.message||String(x),true))},true)}
  async function reconcile(){
    try{
      await repairCallback();const t=await ensure();
      if(!t){rememberDevice('');const a=authState();if(a.reauthRequired||!a.authenticated){setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message('Koppel Spotify om MAIRFM te starten.')}return}
      if(localStorage.getItem('jfm_auth_requested_streaming')==='1'){localStorage.setItem(STREAM,'1');localStorage.removeItem('jfm_auth_requested_streaming');clearPKCE()}
      try{setConnected(true)}catch{enable(true);setStatus(true,'gekoppeld')}
      message('Spotify gekoppeld · speler wordt voorbereid…');await initPlayer()
    }catch(e){
      rememberDevice('');const a=authState();
      if(e?.code==='AUTH_REAUTH_REQUIRED'||a.reauthRequired||!a.authenticated){showReauthRequired(e?.message||'Spotify-sessie is verlopen. Koppel Spotify opnieuw.');return}
      showAuthorizedRecovery('Spotify-speler tijdelijk niet beschikbaar. Je koppeling blijft bewaard.');emit('mair:spotify-device-error',{error:String(e?.message||e).slice(0,240)})
    }
  }
  ownConnectButton();setTimeout(reconcile,350);window.addEventListener('pageshow',()=>{ownConnectButton();setTimeout(reconcile,250)});
  window.JFMSpotifySDK={version:'sdk-core-v7-auth-device-separated',init:initPlayer,reconnect,isAvailable,ensureDevice,transfer,playUris,get player(){return player},get deviceId(){return deviceId},get auth(){return authState()},get health(){return{installed:true,hasPlayer:!!player,deviceId,initializing:!!initPromise,reconnecting:!!reconnectPromise,authRecovering:!!authRecoveryPromise,auth:authState()}}};
  window.MAIRRuntime?.register?.('spotify-sdk-core',{version:'sdk-core-v7-auth-device-separated',owner:'spotify-sdk'});
})();
