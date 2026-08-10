// Josh FM stability core — one owner for Spotify auth/playback and DJ audio handoff.
(()=>{
  const $=id=>document.getElementById(id), wait=ms=>new Promise(r=>setTimeout(r,ms));
  const PKCE_V='jfm_pkce_verifier_v2',PKCE_S='jfm_pkce_state_v2',STREAM='jfm_streaming_ready_v2';
  let player=null,deviceId='',initPromise=null,starting=false;

  function message(text,bad=false){const el=$('queueInfo');if(el){el.textContent=text;el.style.color=bad?'#ffb4b4':''}}
  function setStatus(ok,text){const s=$('status');if(s){s.classList.toggle('on',ok);s.classList.toggle('off',!ok);s.textContent=text||(ok?'gekoppeld':'offline')}}
  function enable(ok){['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild'].forEach(id=>{const e=$(id);if(e)e.disabled=!ok})}
  function rememberPKCE(v,s){localStorage.setItem(PKCE_V,v);localStorage.setItem(PKCE_S,s);sessionStorage.setItem('jfm_verifier',v);sessionStorage.setItem('jfm_state',s)}
  function clearPKCE(){localStorage.removeItem(PKCE_V);localStorage.removeItem(PKCE_S);sessionStorage.removeItem('jfm_verifier');sessionStorage.removeItem('jfm_state')}
  function syncIOSPosition(state,track){
    if(!('mediaSession'in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
    try{
      // Spotify SDK values are milliseconds; Media Session requires seconds.
      const durationMs=Number(track?.duration_ms)||0,positionMs=Number(state?.position)||0;
      if(durationMs<=0)return;
      const duration=Math.max(.001,durationMs/1000),position=Math.max(0,Math.min(duration-.001,positionMs/1000));
      navigator.mediaSession.setPositionState({duration,playbackRate:1,position});
      navigator.mediaSession.playbackState=state?.paused?'paused':'playing';
    }catch{}
  }

  async function connectSpotify(){
    const id=spotifyClientId||$('clientId')?.value.trim();if(!id)throw Error('Spotify Client ID ontbreekt.');
    spotifyClientId=id;localStorage.setItem('jfm_client_id',id);
    const verifier=rand(),state=rand(20);rememberPKCE(verifier,state);localStorage.setItem('jfm_auth_requested_streaming','1');
    const challenge=b64url(await sha256(verifier));
    const scopes=['streaming','user-read-private','user-read-email','user-top-read','user-read-recently-played','user-read-currently-playing','user-read-playback-state','user-modify-playback-state','user-library-read','playlist-read-private'].join(' ');
    const p=new URLSearchParams({response_type:'code',client_id:id,scope:scopes,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});
    location.assign('https://accounts.spotify.com/authorize?'+p);
  }
  window.connect=connect=connectSpotify;

  async function repairCallback(){
    const q=new URLSearchParams(location.search),code=q.get('code');if(!code)return false;
    if(token||refreshToken)return true;
    const expected=sessionStorage.getItem('jfm_state')||localStorage.getItem(PKCE_S),got=q.get('state');
    const verifier=sessionStorage.getItem('jfm_verifier')||localStorage.getItem(PKCE_V);
    if(!expected||!verifier||got!==expected)throw Error('Spotify-beveiligingscontrole kon niet worden hersteld. Koppel opnieuw.');
    const id=spotifyClientId||localStorage.getItem('jfm_client_id');
    const body=new URLSearchParams({client_id:id,grant_type:'authorization_code',code,redirect_uri:redirectUri(),code_verifier:verifier});
    const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!r.ok)throw Error('Spotify-login kon niet worden afgerond.');
    const data=await r.json();saveToken(data);if((data.scope||'').split(' ').includes('streaming'))localStorage.setItem(STREAM,'1');
    clearPKCE();history.replaceState({},'',location.pathname);return true;
  }

  function loadSDK(){
    if(window.Spotify)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const old=window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady=()=>{try{old?.()}catch{}resolve()};
      let s=document.getElementById('spotify-sdk-stable');if(s)return;
      s=document.createElement('script');s.id='spotify-sdk-stable';s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;s.onerror=()=>reject(Error('Spotify-speler kon niet laden.'));document.head.appendChild(s);
    });
  }

  async function initPlayer(){
    if(player&&deviceId)return deviceId;if(initPromise)return initPromise;
    initPromise=(async()=>{
      const t=await ensure();if(!t)throw Error('Spotify is niet gekoppeld.');
      await loadSDK();
      player=new Spotify.Player({name:'Josh FM',getOAuthToken:async cb=>{try{cb(await ensure()||'')}catch{cb('')}},volume:1,enableMediaSession:true});
      window.jfmSpotifyPlayer=player;
      const ready=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Josh FM-speler reageert niet.')),10000);
        player.addListener('ready',({device_id})=>{clearTimeout(timer);deviceId=device_id;localStorage.setItem('jfm_spotify_device_id',device_id);localStorage.setItem(STREAM,'1');message('Spotify gekoppeld · Josh FM-speler klaar.');setStatus(true,'gekoppeld');enable(true);resolve(device_id)});
        player.addListener('not_ready',()=>{deviceId='';message('Spotify-speler is tijdelijk offline.',true)});
        player.addListener('authentication_error',()=>{localStorage.removeItem(STREAM);message('Spotify moet één keer opnieuw gekoppeld worden voor afspelen in Josh FM.',true);enable(false);if($('connect'))$('connect').disabled=false});
        player.addListener('account_error',()=>message('Spotify Premium is nodig om muziek in Josh FM af te spelen.',true));
        player.addListener('autoplay_failed',()=>message('iPhone blokkeerde autoplay. Tik nogmaals op Start Josh FM.',true));
        player.addListener('playback_error',({message:m})=>message('Spotify-afspeelfout: '+m,true));
        player.addListener('player_state_changed',state=>{
          if(!state)return;const t=state.track_window?.current_track;if(!t)return;
          const fake={item:{id:t.id,uri:t.uri,name:t.name,duration_ms:t.duration_ms,artists:(t.artists||[]).map(a=>({name:a.name})),album:{name:t.album?.name||'',images:t.album?.images||[]},external_urls:{spotify:t.id?`https://open.spotify.com/track/${t.id}`:''}},progress_ms:state.position,is_playing:!state.paused,device:{id:deviceId,name:'Josh FM'}};
          playback=fake;try{renderPlayback(fake)}catch{};syncIOSPosition(state,t);
        });
      });
      const ok=await player.connect();if(!ok)throw Error('Spotify Web Player kon niet verbinden.');return ready;
    })().catch(e=>{initPromise=null;message(e.message||String(e),true);throw e});
    return initPromise;
  }

  async function transfer(play=false){const id=deviceId||await initPlayer();await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});return id}
  async function playUris(uris){const id=deviceId||await initPlayer();await transfer(false);await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris}});await wait(250);try{await player.resume()}catch{}return true}
  async function playUri(uri){if(!uri){try{await player?.resume();return true}catch{return false}}return playUris([uri])}
  window.jfmEnsureSpotifyDevice=async play=>{try{return await transfer(!!play)}catch{return''}};
  window.jfmPlayUri=async uri=>{try{return await playUri(uri)}catch(e){message(e.message||String(e),true);return false}};
  window.jfmWebResume=async()=>{try{await player?.resume();return true}catch{return false}};
  window.jfmWebPause=async()=>{try{await player?.pause();return true}catch{return false}};
  window.jfmWebNext=async()=>{try{await player?.nextTrack();return true}catch{return false}};
  window.jfmWebPrevious=async()=>{try{await player?.previousTrack();return true}catch{return false}};

  async function startJosh(){
    if(starting)return;starting=true;const b=$('start');if(b){b.disabled=true;b.textContent='Josh FM start…'};
    try{
      if(!player||!deviceId){message('Spotify-speler wordt klaargemaakt…');await initPlayer()}
      try{await player.activateElement()}catch{}
      if(!queue?.length){message('Radioset wordt gemaakt…');await buildSet()}
      const uris=(queue||[]).slice(0,30).map(x=>x.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare nummers gevonden.');
      session=[];try{renderHistory()}catch{};try{scheduleTalk()}catch{};
      if($('jingles')?.checked){message('Josh FM start…');try{await Promise.race([speakText('Josh FM. Jouw muziek, jouw radioshow.',true),wait(5000)])}catch{}}
      message('Muziek wordt gestart…');await playUris(uris);try{startPolling()}catch{};setStatus(true,'live');message(`Josh FM is live · ${queue.length} tracks.`);setTimeout(()=>refresh().catch(()=>{}),500);
    }catch(e){message('Starten lukte niet: '+(e.message||String(e)),true)}finally{starting=false;if(b){b.disabled=false;b.textContent='Start Josh FM'}}
  }

  async function stableDJBreak(track=null,manual=false){
    if(djBusy)return;djBusy=true;
    try{
      const wasPlaying=!!playback?.is_playing,target=track||(playback?.item?trackObj(playback.item):null);
      if(wasPlaying){try{await player?.pause()}catch{await api('/me/player/pause',{method:'PUT'}).catch(()=>{})}}
      const [fact,weather]=await Promise.all([getFact(target),getWeather()]);const text=await makeDJScript(target,fact,weather,manual);
      if($('djText'))$('djText').textContent=text;if($('factSource'))$('factSource').classList.add('hidden');
      if($('jingles')?.checked&&Math.random()<.2&&!manual)try{await speakText('Josh FM.',true)}catch{}
      await speakText(text,false);
      if(wasPlaying){let ok=false;for(let i=0;i<3&&!ok;i++){try{await player?.resume();await wait(250);const s=await player?.getCurrentState();ok=!!s&&!s.paused}catch{}if(!ok)try{await transfer(true);ok=true}catch{}}if(!ok)message('Tik op Play om de muziek te hervatten.',true)}
    }finally{djBusy=false}
  }
  window.djBreak=djBreak=stableDJBreak;

  function ownButton(id,handler){const old=$(id);if(!old)return null;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('click',handler,true);return fresh}
  ownButton('connect',e=>{e.preventDefault();e.stopImmediatePropagation();connectSpotify().catch(x=>message(x.message||String(x),true))});
  ownButton('start',e=>{e.preventDefault();e.stopImmediatePropagation();if(player)try{player.activateElement()}catch{}startJosh()});
  ownButton('play',async e=>{e.preventDefault();e.stopImmediatePropagation();try{if(!player||!deviceId)await initPlayer();try{await player.activateElement()}catch{}const s=await player.getCurrentState();if(s&&!s.paused)await player.pause();else await player.resume()}catch(x){message(x.message||String(x),true)}});
  ownButton('next',async e=>{e.preventDefault();e.stopImmediatePropagation();try{if(playback?.item?.id)recordSkip(playback.item.id);if(!player||!deviceId)await initPlayer();await player.nextTrack();setTimeout(()=>refresh().catch(()=>{}),300)}catch(x){message(x.message||String(x),true)}});
  ownButton('prev',async e=>{e.preventDefault();e.stopImmediatePropagation();try{if(!player||!deviceId)await initPlayer();await player.previousTrack();setTimeout(()=>refresh().catch(()=>{}),300)}catch(x){message(x.message||String(x),true)}});

  async function reconcile(){
    try{
      await repairCallback();const t=await ensure();if(!t){setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message('Koppel Spotify om Josh FM te starten.');return}
      if(localStorage.getItem('jfm_auth_requested_streaming')==='1'){localStorage.setItem(STREAM,'1');localStorage.removeItem('jfm_auth_requested_streaming');clearPKCE()}
      try{setConnected(true)}catch{enable(true);setStatus(true,'gekoppeld')}
      message('Spotify gekoppeld · speler wordt voorbereid…');
      await initPlayer();
    }catch(e){setStatus(false,'offline');enable(false);if($('connect'))$('connect').disabled=false;message(e.message||String(e),true)}
  }
  setTimeout(reconcile,350);window.addEventListener('pageshow',()=>setTimeout(reconcile,250));
})();