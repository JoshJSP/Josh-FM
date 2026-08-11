// Josh FM Spotify Connect recovery — stable device handoff without Web Playback SDK.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id',PENDING='jfm_start_after_spotify',STATE_KEY='jfm_playback_recovery_v2';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let starting=false,resuming=false,recovering=false,watching=false,hiddenWasPlaying=false,lastVisibleAt=Date.now();
  let health={lastGoodAt:0,lastDevice:'',lastUri:'',lastProgress:0,recoveries:0,failures:0,lastReason:'',...loadState()};
  function loadState(){try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'{}')}catch{return{}}}
  function saveState(){try{sessionStorage.setItem(STATE_KEY,JSON.stringify(health))}catch{}}
  function info(t){const q=$('queueInfo');if(q)q.textContent=t}
  function storedDevice(){return localStorage.getItem(DEVICE_KEY)||''}
  function remember(s){
    const id=s?.device?.id||'';if(id){localStorage.setItem(DEVICE_KEY,id);health.lastDevice=id}
    if(s?.item?.uri)health.lastUri=s.item.uri;
    if(Number.isFinite(Number(s?.progress_ms)))health.lastProgress=Number(s.progress_ms)||0;
    if(s?.is_playing)health.lastGoodAt=Date.now();saveState();return id
  }
  function radioIsLive(){return !!playback?.is_playing}
  function setExpectedLive(on){health.expectedLive=!!on;saveState()}
  function syncStartButton(forceLive=null){
    const b=$('start');if(!b)return;
    const live=forceLive===null?radioIsLive():!!forceLive;
    b.classList.toggle('hidden',live);b.style.display=live?'none':'';
    if(!live&&!starting){b.disabled=false;b.textContent='Start Josh FM'}
  }
  async function devices(){try{return (await api('/me/player/devices'))?.devices||[]}catch{return[]}}
  function scoreDevice(d,stored){
    if(!d||d.is_restricted)return-999;
    let n=0;if(d.is_active)n+=100;if(d.id===stored)n+=55;if(d.type==='Smartphone')n+=30;if(d.type==='Computer')n+=15;if(d.volume_percent!==null)n+=3;return n
  }
  async function chooseDevice({preferActive=true}={}){
    try{
      const s=await api('/me/player');
      if(s?.device?.id&&!s.device.is_restricted){playback=s;remember(s);syncStartButton(!!s.is_playing);if(preferActive||s.is_playing)return s.device.id}
    }catch{}
    const list=await devices(),stored=storedDevice();
    const ranked=list.filter(d=>d&&!d.is_restricted).sort((a,b)=>scoreDevice(b,stored)-scoreDevice(a,stored));
    const d=ranked[0];if(d?.id){localStorage.setItem(DEVICE_KEY,d.id);health.lastDevice=d.id;saveState()}
    return d?.id||stored;
  }
  async function transfer(id,play=false){
    if(!id)return false;
    try{
      const s=await api('/me/player').catch(()=>null);if(s?.device?.id===id){remember(s);return true}
      await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(300);health.lastDevice=id;saveState();return true
    }catch{return false}
  }
  async function ensureDevice(play=false){const id=await chooseDevice();if(!id)return'';await transfer(id,play);return id}

  async function hardPlay(uri,preferredId='',positionMs=null){
    if(resuming)return false;resuming=true;
    try{
      let id=preferredId||storedDevice()||await chooseDevice();if(!id)return false;
      for(let i=0;i<5;i++){
        await transfer(id,false);
        try{
          const body=uri?{uris:[uri],...(Number.isFinite(Number(positionMs))?{position_ms:Math.max(0,Number(positionMs)||0)}:{})}:undefined;
          await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body});
        }catch{}
        await wait(380+i*180);
        const s=await api('/me/player').catch(()=>null);if(s?.device?.id)remember(s);
        if(s?.is_playing&&(!uri||s.item?.uri===uri)){playback=s;remember(s);setExpectedLive(true);try{renderPlayback(s)}catch{};syncStartButton(true);return true}
        const fresh=await chooseDevice({preferActive:false});if(fresh)id=fresh
      }
      health.failures++;saveState();return false
    }finally{resuming=false}
  }
  async function playUri(uri){return hardPlay(uri)}

  async function recover(reason='unknown',{force=false}={}){
    if(recovering||starting||djBusy||window.JFMDJTransition?.busy)return false;
    recovering=true;health.lastReason=reason;saveState();
    try{
      const live=await api('/me/player').catch(()=>null);
      if(live?.device?.id)remember(live);
      if(live?.is_playing){playback=live;setExpectedLive(true);syncStartButton(true);return true}
      if(!force&&!health.expectedLive&&!hiddenWasPlaying)return false;
      const uri=live?.item?.uri||health.lastUri||playback?.item?.uri||'';
      const pos=Number.isFinite(Number(live?.progress_ms))?Number(live.progress_ms):health.lastProgress;
      let id=live?.device?.id||await chooseDevice({preferActive:false});
      if(!id&&isIOS){info('Spotify is niet actief. Open Spotify kort en ga daarna terug naar Josh FM.');return false}
      if(!id)return false;
      const ok=await hardPlay(uri,id,pos);
      if(ok){health.recoveries++;health.lastGoodAt=Date.now();hiddenWasPlaying=false;saveState();info('Spotify-verbinding hersteld · Josh FM speelt verder.');setTimeout(()=>refresh().catch(()=>{}),250)}
      else{health.failures++;saveState()}
      return ok
    }catch(e){health.failures++;health.lastReason=reason+': '+String(e?.message||e).slice(0,120);saveState();return false}
    finally{recovering=false}
  }

  async function startQueue(){
    if(starting)return;starting=true;
    const b=$('start');if(b){b.disabled=true;b.textContent='Josh FM start…';b.classList.remove('hidden');b.style.display=''}
    try{
      const linked=await window.JFMAuth?.reconcile?.();if(linked===false)throw Error('Spotify is niet gekoppeld.');
      if(!queue?.length){info('Radioset wordt gemaakt…');await buildSet()}
      if(!queue?.length)throw Error('Geen nummers gevonden voor je radioset.');
      let id=await chooseDevice({preferActive:false});
      if(!id&&isIOS){sessionStorage.setItem(PENDING,'1');info('Spotify wordt kort geopend om je iPhone als afspeelapparaat te activeren. Ga daarna terug naar Josh FM.');location.assign('spotify:');return}
      if(!id)throw Error('Geen Spotify-afspeelapparaat gevonden. Open Spotify één keer en probeer opnieuw.');
      await transfer(id,false);
      if($('jingles')?.checked&&typeof speakText==='function'){
        info('Josh FM-jingle…');try{await Promise.race([speakText('Josh FM. Your music, your radio show.',true),wait(5000)])}catch{}await wait(250);id=await chooseDevice({preferActive:false})||id
      }
      const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare Spotify-tracks gevonden.');
      info('Muziek wordt gestart…');const ok=await hardPlay(uris[0],id,0);if(!ok)throw Error('Spotify reageert niet op afspelen. Open Spotify kort en probeer opnieuw.');
      const s=await api('/me/player').catch(()=>null);if(s){playback=s;remember(s);try{renderPlayback(s)}catch{}}
      session=[];try{renderHistory()}catch{};try{scheduleTalk()}catch{};try{startPolling()}catch{};
      setExpectedLive(true);info(`Josh FM is live · ${queue.length} tracks klaar.`);syncStartButton(true)
    }catch(e){setExpectedLive(false);info('Starten lukte niet: '+String(e?.message||e));syncStartButton(false)}
    finally{starting=false;if(b&&!radioIsLive()){b.disabled=false;b.textContent='Start Josh FM';syncStartButton(false)}}
  }
  async function playPause(){
    try{
      const s=await api('/me/player').catch(()=>playback);
      if(s?.is_playing){setExpectedLive(false);hiddenWasPlaying=false;await api('/me/player/pause',{method:'PUT'});setTimeout(()=>{refresh().catch(()=>{});syncStartButton(false)},250);return}
      setExpectedLive(true);const ok=await hardPlay(null);if(!ok){setExpectedLive(false);info('Spotify is niet actief. Open Spotify één keer en probeer opnieuw.')}setTimeout(()=>refresh().catch(()=>{}),300)
    }catch(e){setExpectedLive(false);info('Afspelen lukte niet: '+String(e?.message||e))}
  }
  async function next(){try{if(playback?.item?.id)recordSkip(playback.item.id);setExpectedLive(true);const id=await chooseDevice();await api('/me/player/next'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});await wait(250);await hardPlay(null,id);setTimeout(()=>refresh().catch(()=>{}),300)}catch(e){info('Volgende nummer lukte niet: '+String(e?.message||e))}}
  async function prev(){try{setExpectedLive(true);const id=await chooseDevice();await api('/me/player/previous'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});await wait(250);await hardPlay(null,id);setTimeout(()=>refresh().catch(()=>{}),300)}catch(e){info('Vorige nummer lukte niet: '+String(e?.message||e))}}
  function own(id,fn){const old=$(id);if(!old)return;const b=old.cloneNode(true);old.replaceWith(b);if(id==='start'){b.disabled=false;b.classList.remove('hidden');b.style.display=''}b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()})}
  own('start',startQueue);own('play',playPause);own('next',next);own('prev',prev);

  async function resumePending(){if(document.visibilityState!=='visible'||sessionStorage.getItem(PENDING)!=='1')return;sessionStorage.removeItem(PENDING);info('Spotify is actief · Josh FM start…');await wait(800);startQueue()}
  async function onVisible(reason){lastVisibleAt=Date.now();await resumePending();if(hiddenWasPlaying||health.expectedLive){await wait(isIOS?700:350);recover(reason,{force:hiddenWasPlaying})}}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){hiddenWasPlaying=!!playback?.is_playing||!!health.expectedLive;remember(playback);saveState()}else onVisible('visibility')});
  window.addEventListener('pageshow',()=>setTimeout(()=>onVisible('pageshow'),150));window.addEventListener('focus',()=>setTimeout(()=>onVisible('focus'),180));
  window.addEventListener('online',()=>setTimeout(()=>recover('online'),350));

  const oldRefresh=window.refresh;if(typeof oldRefresh==='function')window.refresh=refresh=async function(...a){
    const out=await oldRefresh.apply(this,a);try{remember(playback);if(playback?.is_playing)setExpectedLive(true);syncStartButton()}catch{}return out
  };
  // Lightweight watchdog: observes state, but never overrides an intentional pause.
  setInterval(async()=>{
    if(watching||document.visibilityState!=='visible'||starting||recovering||djBusy||window.JFMDJTransition?.busy)return;watching=true;
    try{
      const s=await api('/me/player').catch(()=>null);
      if(s?.is_playing){playback=s;remember(s);setExpectedLive(true);syncStartButton(true);return}
      if(s?.item&&!s.is_playing&&!hiddenWasPlaying){setExpectedLive(false);syncStartButton(false);return}
      if(!s&&health.expectedLive&&Date.now()-lastVisibleAt<120000)await recover('watchdog')
    }finally{watching=false}
  },15000);
  setInterval(()=>syncStartButton(),700);setTimeout(()=>syncStartButton(),50);setTimeout(()=>syncStartButton(),1000);
  window.JFMPlayback={version:'recovery-v3',start:startQueue,playUri,hardPlay,recover,ensureDevice,chooseDevice,transfer,storedDevice,syncStartButton,get health(){return{...health,recovering,hiddenWasPlaying}}};
  window.jfmPlayUri=playUri;window.jfmEnsureSpotifyDevice=ensureDevice;
})();