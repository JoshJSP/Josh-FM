// Single stable Spotify Connect controller for Josh FM. No Web Playback SDK.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id',PENDING='jfm_start_after_spotify';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let starting=false,resuming=false;
  function info(t){const q=$('queueInfo');if(q)q.textContent=t}
  function storedDevice(){return localStorage.getItem(DEVICE_KEY)||''}
  function remember(s){const id=s?.device?.id;if(id)localStorage.setItem(DEVICE_KEY,id);return id||''}
  function radioIsLive(){return !!playback?.is_playing}
  function syncStartButton(forceLive=null){
    const b=$('start');if(!b)return;
    const live=forceLive===null?radioIsLive():!!forceLive;
    b.classList.toggle('hidden',live);
    b.style.display=live?'none':'';
    if(!live&&!starting){b.disabled=false;b.textContent='Start Josh FM'}
  }
  async function devices(){try{return (await api('/me/player/devices'))?.devices||[]}catch{return[]}}
  async function chooseDevice(){
    try{const s=await api('/me/player');if(s?.device?.id){playback=s;remember(s);syncStartButton(!!s.is_playing);return s.device.id}}catch{}
    const list=await devices(),stored=storedDevice();
    const d=list.find(x=>x.is_active)||list.find(x=>x.id===stored)||list.find(x=>x.type==='Smartphone')||list[0];
    if(d?.id)localStorage.setItem(DEVICE_KEY,d.id);
    return d?.id||stored;
  }
  async function transfer(id,play=false){if(!id)return false;try{await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(300);return true}catch{return false}}
  async function ensureDevice(play=false){const id=await chooseDevice();if(!id)return'';await transfer(id,play);return id}

  async function hardPlay(uri,preferredId=''){
    let id=preferredId||storedDevice()||await chooseDevice();if(!id)return false;
    for(let i=0;i<5;i++){
      await transfer(id,false);
      try{await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:uri?{uris:[uri]}:undefined})}catch{}
      await wait(420+i*220);
      const s=await api('/me/player').catch(()=>null);
      if(s?.device?.id)remember(s);
      if(s?.is_playing&&(!uri||s.item?.uri===uri)){playback=s;try{renderPlayback(s)}catch{};syncStartButton(true);return true}
      const fresh=await chooseDevice();if(fresh)id=fresh;
    }
    return false;
  }

  async function playUri(uri){if(resuming)return false;resuming=true;try{return await hardPlay(uri)}finally{resuming=false}}
  async function startQueue(){
    if(starting)return;starting=true;
    const b=$('start');if(b){b.disabled=true;b.textContent='Josh FM start…';b.classList.remove('hidden');b.style.display=''}
    try{
      const linked=await window.JFMAuth?.reconcile?.();if(linked===false)throw Error('Spotify is niet gekoppeld.');
      if(!queue?.length){info('Radioset wordt gemaakt…');await buildSet()}
      if(!queue?.length)throw Error('Geen nummers gevonden voor je radioset.');
      let id=await chooseDevice();
      if(!id&&isIOS){sessionStorage.setItem(PENDING,'1');info('Spotify wordt kort geopend om je iPhone als afspeelapparaat te activeren. Ga daarna terug naar Josh FM.');location.assign('spotify:');return}
      if(!id)throw Error('Geen Spotify-afspeelapparaat gevonden. Open Spotify één keer en probeer opnieuw.');
      await transfer(id,false);
      if($('jingles')?.checked&&typeof speakText==='function'){
        info('Josh FM-jingle…');
        try{await Promise.race([speakText('Josh FM. Your music, your radio show.',true),wait(5000)])}catch{}
        await wait(250);id=await chooseDevice()||id;
      }
      const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare Spotify-tracks gevonden.');
      info('Muziek wordt gestart…');
      const ok=await hardPlay(uris[0],id);if(!ok)throw Error('Spotify reageert niet op afspelen. Open Spotify kort en probeer opnieuw.');
      const s=await api('/me/player').catch(()=>null);if(s){playback=s;remember(s);try{renderPlayback(s)}catch{}}
      session=[];try{renderHistory()}catch{};try{scheduleTalk()}catch{};try{startPolling()}catch{};
      info(`Josh FM is live · ${queue.length} tracks klaar.`);syncStartButton(true);
    }catch(e){info('Starten lukte niet: '+String(e?.message||e));syncStartButton(false)}
    finally{starting=false;if(b&&!radioIsLive()){b.disabled=false;b.textContent='Start Josh FM';syncStartButton(false)}}
  }
  async function playPause(){
    try{const s=await api('/me/player').catch(()=>playback);if(s?.is_playing){await api('/me/player/pause',{method:'PUT'});setTimeout(()=>{refresh().catch(()=>{});syncStartButton(false)},250);return}
      const ok=await playUri(null);if(!ok)info('Spotify is niet actief. Open Spotify één keer en probeer opnieuw.');setTimeout(()=>refresh().catch(()=>{}),300)
    }catch(e){info('Afspelen lukte niet: '+String(e?.message||e))}
  }
  async function next(){try{if(playback?.item?.id)recordSkip(playback.item.id);const id=await chooseDevice();await api('/me/player/next'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});await wait(250);await hardPlay(null,id);setTimeout(()=>refresh().catch(()=>{}),300)}catch(e){info('Volgende nummer lukte niet: '+String(e?.message||e))}}
  async function prev(){try{const id=await chooseDevice();await api('/me/player/previous'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});await wait(250);await hardPlay(null,id);setTimeout(()=>refresh().catch(()=>{}),300)}catch(e){info('Vorige nummer lukte niet: '+String(e?.message||e))}}
  function own(id,fn){const old=$(id);if(!old)return;const b=old.cloneNode(true);old.replaceWith(b);if(id==='start'){b.disabled=false;b.classList.remove('hidden');b.style.display=''}b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()})}
  own('start',startQueue);own('play',playPause);own('next',next);own('prev',prev);
  async function resumePending(){if(document.visibilityState!=='visible'||sessionStorage.getItem(PENDING)!=='1')return;sessionStorage.removeItem(PENDING);info('Spotify is actief · Josh FM start…');await wait(800);startQueue()}
  document.addEventListener('visibilitychange',resumePending);window.addEventListener('pageshow',()=>setTimeout(resumePending,150));window.addEventListener('focus',()=>setTimeout(resumePending,150));
  const oldRefresh=window.refresh;if(typeof oldRefresh==='function')window.refresh=refresh=async function(...a){const out=await oldRefresh.apply(this,a);try{remember(playback);syncStartButton()}catch{}return out};
  // app.js can still change disabled state after this controller loads; keep ownership of the Start button here.
  setInterval(()=>syncStartButton(),700);setTimeout(()=>syncStartButton(),50);setTimeout(()=>syncStartButton(),1000);
  window.JFMPlayback={start:startQueue,playUri,hardPlay,ensureDevice,chooseDevice,transfer,storedDevice,syncStartButton};window.jfmPlayUri=playUri;window.jfmEnsureSpotifyDevice=ensureDevice;
})();