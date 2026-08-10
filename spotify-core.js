// Josh FM Spotify core — one owner for auth + playback controls.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const PKCE_V='jfm_pkce_verifier_persist',PKCE_S='jfm_pkce_state_persist';
  let player=null,deviceId='',ready=false,initPromise=null,starting=false,lastSdkTrack='';
  const info=t=>{const e=$('queueInfo');if(e)e.textContent=t};
  const status=(t,bad=false)=>{let e=$('playbackDiag');if(!e){e=document.createElement('p');e.id='playbackDiag';e.className='muted';$('start')?.insertAdjacentElement('afterend',e)}if(e){e.textContent=t;e.style.color=bad?'#ffb4b4':''}};

  async function connectSpotify(){
    const id=spotifyClientId||$('clientId')?.value.trim();if(!id)throw Error('Spotify Client ID ontbreekt.');
    spotifyClientId=id;localStorage.setItem('jfm_client_id',id);
    const verifier=rand(),state=rand(20);
    sessionStorage.setItem('jfm_verifier',verifier);sessionStorage.setItem('jfm_state',state);
    localStorage.setItem(PKCE_V,verifier);localStorage.setItem(PKCE_S,state);
    const challenge=b64url(await sha256(verifier));
    const scopes=['streaming','user-read-private','user-top-read','user-read-recently-played','user-read-currently-playing','user-read-playback-state','user-modify-playback-state','user-library-read','playlist-read-private'].join(' ');
    const p=new URLSearchParams({response_type:'code',client_id:id,scope:scopes,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});
    location.assign('https://accounts.spotify.com/authorize?'+p);
  }

  function loadSDK(){return new Promise((resolve,reject)=>{
    if(window.Spotify)return resolve();
    if(document.getElementById('spotify-sdk-core')){const timer=setInterval(()=>{if(window.Spotify){clearInterval(timer);resolve()}},100);setTimeout(()=>{clearInterval(timer);if(!window.Spotify)reject(Error('Spotify speler kon niet laden.'))},10000);return}
    const prev=window.onSpotifyWebPlaybackSDKReady;window.onSpotifyWebPlaybackSDKReady=()=>{try{prev?.()}catch{}resolve()};
    const s=document.createElement('script');s.id='spotify-sdk-core';s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;s.onerror=()=>reject(Error('Spotify speler kon niet laden.'));document.head.appendChild(s);
  })}

  function mapSdkTrack(t){return t?{id:t.id,uri:t.uri,name:t.name,duration_ms:t.duration_ms,artists:(t.artists||[]).map(a=>({name:a.name})),album:{name:t.album?.name||'',images:t.album?.images||[]},external_urls:{spotify:t.id?`https://open.spotify.com/track/${t.id}`:''}}:null}
  function emitState(state){
    if(!state)return;const t=state.track_window?.current_track;if(!t)return;
    const previousId=lastSdkTrack;lastSdkTrack=t.id;
    const fake={item:mapSdkTrack(t),progress_ms:state.position,is_playing:!state.paused,device:{id:deviceId,name:'Josh FM'}};
    playback=fake;try{renderPlayback(fake)}catch{}
    window.dispatchEvent(new CustomEvent('jfm:playerstate',{detail:{state,playback:fake,trackId:t.id,previousTrackId:previousId}}));
    if(previousId&&previousId!==t.id)window.dispatchEvent(new CustomEvent('jfm:trackchange',{detail:{state,playback:fake,trackId:t.id,previousTrackId:previousId}}));
  }

  async function initPlayer(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      const t=await ensure();if(!t)throw Error('Spotify is niet gekoppeld.');
      await loadSDK();
      player=new Spotify.Player({name:'Josh FM',getOAuthToken:async cb=>{try{cb(await ensure()||'')}catch{cb('')}},volume:1,enableMediaSession:true});
      window.jfmSpotifyPlayer=player;
      const deviceReady=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Josh FM-speler reageert niet. Koppel Spotify opnieuw.')),12000);
        player.addListener('ready',({device_id})=>{clearTimeout(timer);deviceId=device_id;ready=true;window.jfmWebPlayerReady=true;window.jfmWebPlayerDeviceId=device_id;status('Spotify gekoppeld · Josh FM-speler klaar');resolve(device_id)});
        player.addListener('not_ready',()=>{ready=false;window.jfmWebPlayerReady=false;status('Josh FM-speler is tijdelijk offline.',true)});
        player.addListener('authentication_error',()=>status('Spotify-toestemming ontbreekt. Ontkoppel Spotify en koppel één keer opnieuw.',true));
        player.addListener('account_error',()=>status('Spotify Premium is nodig voor afspelen in Josh FM.',true));
        player.addListener('initialization_error',({message})=>status('Speler kon niet starten: '+message,true));
        player.addListener('playback_error',({message})=>status('Spotify afspeelfout: '+message,true));
        player.addListener('autoplay_failed',()=>status('iPhone blokkeerde autoplay. Tik opnieuw op Start Josh FM.',true));
        player.addListener('player_state_changed',emitState);
      });
      const ok=await player.connect();if(!ok)throw Error('Spotify-speler kon niet verbinden.');
      await deviceReady;return deviceId;
    })().catch(e=>{initPromise=null;status(e.message||String(e),true);throw e});
    return initPromise;
  }

  async function playUris(uris){
    if(!ready||!deviceId)await initPlayer();
    await api('/me/player/play?device_id='+encodeURIComponent(deviceId),{method:'PUT',body:{uris}});
    await wait(350);return true;
  }
  async function startJosh(){
    if(starting)return;starting=true;const b=$('start');if(b)b.textContent='Josh FM start…';
    try{
      if(!player||!ready){info('Josh FM-speler wordt voorbereid…');await initPlayer();status('Speler klaar. Tik nu nog één keer op Start Josh FM.');return}
      await player.activateElement();
      if(!queue?.length){info('Radioset wordt gemaakt…');await buildSet()}
      const uris=(queue||[]).slice(0,30).map(x=>x.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare nummers gevonden.');
      info('Muziek wordt gestart…');await playUris(uris);await wait(450);
      let s=await player.getCurrentState().catch(()=>null);if(!s||s.paused){await player.resume();await wait(250);s=await player.getCurrentState().catch(()=>null)}
      if(!s||s.paused)throw Error('Playback bleef gepauzeerd. Tik één keer op Play.');
      session=[];try{renderHistory()}catch{};try{scheduleTalk()}catch{};try{startPolling()}catch{};
      status('✓ Spotify gekoppeld · ✓ Josh FM-speler · ✓ muziek speelt');info(`Josh FM is live · ${queue.length} tracks.`);
    }catch(e){status(e.message||String(e),true);info('Starten lukte niet: '+(e.message||String(e)))}finally{starting=false;if(b)b.textContent='Start Josh FM'}
  }

  async function togglePlay(){
    if(!player||!ready){await initPlayer();status('Speler klaar. Tik nogmaals op Play.');return}
    await player.activateElement().catch(()=>{});const s=await player.getCurrentState().catch(()=>null);
    if(s&&!s.paused)await player.pause();else await player.resume();
  }

  function replace(id,fn){const old=$(id);if(!old)return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.disabled=old.disabled;fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();Promise.resolve(fn(e)).catch(x=>status(x.message||String(x),true))},true)}
  replace('connect',()=>connectSpotify());
  replace('start',()=>startJosh());
  replace('play',()=>togglePlay());
  replace('next',async()=>{if(playback?.item?.id)try{recordSkip(playback.item.id)}catch{};if(!player||!ready)await initPlayer();await player.nextTrack()});
  replace('prev',async()=>{if(!player||!ready)await initPlayer();await player.previousTrack()});

  window.JFMSpotify={init:initPlayer,start:startJosh,playUris,get player(){return player},get deviceId(){return deviceId},get ready(){return ready}};
  window.jfmEnsureSpotifyDevice=async()=>{try{return deviceId||await initPlayer()}catch{return''}};
  window.jfmPlayUri=async uri=>{try{if(!player||!ready)await initPlayer();if(uri)await playUris([uri]);else await player.resume();return true}catch{return false}};
  window.jfmWebResume=async()=>{try{await player.resume();return true}catch{return false}};
  window.jfmWebPause=async()=>{try{await player.pause();return true}catch{return false}};
  window.jfmWebNext=async()=>{try{await player.nextTrack();return true}catch{return false}};
  window.jfmWebPrevious=async()=>{try{await player.previousTrack();return true}catch{return false}};
  window.jfmWebPlayUri=async uri=>window.jfmPlayUri(uri);
  window.jfmGetPlayerState=async()=>{try{return await player?.getCurrentState()}catch{return null}};

  async function reconcile(){
    try{const t=await ensure();if(!t)return;try{setConnected(true)}catch{};localStorage.removeItem(PKCE_V);localStorage.removeItem(PKCE_S);initPlayer().catch(()=>{})}catch{}
  }
  setTimeout(reconcile,600);window.addEventListener('pageshow',()=>setTimeout(reconcile,300));
})();