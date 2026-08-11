// Josh FM Spotify playback/recovery — all transport actions coordinated by JFMPlaybackState.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const Truth=window.JFMPlaybackState;
  if(!Truth){console.error('Josh FM playback truth layer missing');return}
  const DEVICE_KEY='jfm_spotify_device_id',PENDING='jfm_start_after_spotify';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let starting=false,recovering=false,watching=false,hiddenWasPlaying=false,lastVisibleAt=Date.now();
  const health={recoveries:0,failures:0,lastReason:'',lastDevice:'',lastGoodAt:0,lastError:''};

  function info(text,bad=false){const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}}
  function storedDevice(){return localStorage.getItem(DEVICE_KEY)||''}
  function stationQueue(){try{return Array.isArray(queue)?queue.filter(t=>t?.id&&t?.uri):[]}catch{return[]}}
  function render(remote,source='spotify'){
    if(!remote)return Truth.get();
    const s=Truth.ingest(remote,source);if(remote?.device?.id){localStorage.setItem(DEVICE_KEY,remote.device.id);health.lastDevice=remote.device.id}
    if(s.isPlaying)health.lastGoodAt=Date.now();
    try{renderPlayback(remote)}catch{}
    syncStartButton();return s
  }
  function syncStartButton(){
    const b=$('start');if(!b)return;const s=Truth.get(),live=s.isPlaying||s.expectedLive;
    b.classList.toggle('hidden',live);b.style.display=live?'none':'';
    if(!live&&!starting){b.disabled=false;b.textContent='Start Josh FM'}
  }
  async function remoteState(source='api'){
    const s=await api('/me/player').catch(()=>null);if(s)render(s,source);return s
  }
  async function devices(){try{return(await api('/me/player/devices'))?.devices||[]}catch{return[]}}
  function scoreDevice(d,stored){
    if(!d||d.is_restricted)return-9999;let n=0;
    if(d.is_active)n+=120;if(d.id===stored)n+=55;if(d.type==='Smartphone')n+=30;if(d.type==='Computer')n+=15;if(d.volume_percent!==null)n+=2;return n
  }
  async function chooseDevice({preferActive=true}={}){
    const live=await remoteState('device-probe');
    if(live?.device?.id&&!live.device.is_restricted&&(preferActive||live.is_playing)){localStorage.setItem(DEVICE_KEY,live.device.id);return live.device.id}
    const list=await devices(),stored=storedDevice();
    const ranked=list.filter(d=>d&&!d.is_restricted).sort((a,b)=>scoreDevice(b,stored)-scoreDevice(a,stored));
    const chosen=ranked[0];if(chosen?.id){localStorage.setItem(DEVICE_KEY,chosen.id);health.lastDevice=chosen.id;return chosen.id}
    return stored
  }
  async function transfer(id,play=false){
    if(!id)return false;const op=Truth.begin('device-transfer',{timeoutMs:4500});
    try{
      const current=await remoteState('transfer-probe');
      if(current?.device?.id===id){Truth.end(op);return true}
      await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(300);
      localStorage.setItem(DEVICE_KEY,id);health.lastDevice=id;Truth.end(op);return true
    }catch(e){Truth.end(op,{error:e?.message||e});throw e}
  }
  async function ensureDevice(play=false){const id=await chooseDevice({preferActive:false});if(!id)return'';await transfer(id,play);return id}

  function queueIndex(id){return stationQueue().findIndex(t=>t.id===id)}
  function batchFromIndex(index,max=30){const q=stationQueue();return index>=0?q.slice(index,index+max).map(t=>t.uri).filter(Boolean):[]}
  function batchFromTrack(id,max=30){return batchFromIndex(queueIndex(id),max)}
  function expectedNext(id,delta=1){const q=stationQueue(),i=q.findIndex(t=>t.id===id);return i>=0?q[i+delta]||null:null}
  async function waitFor(predicate,{tries=9,base=170}={}){
    for(let i=0;i<tries;i++){
      await wait(base+i*45);const s=await remoteState('verify');if(s&&predicate(s))return s
    }
    return null
  }
  async function playBatch(uris,{deviceId='',positionMs=0,type='play-track',expectedTrackId=''}={}){
    const list=(uris||[]).filter(Boolean);if(!list.length)return false;
    let id=deviceId||await chooseDevice({preferActive:false});if(!id)return false;
    const op=Truth.begin(type,{expectedTrackId,expectedUri:list[0],timeoutMs:8000});Truth.setExpectedLive(true,type);
    try{
      await transfer(id,false);
      await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris:list,position_ms:Math.max(0,Number(positionMs)||0)}});
      const verified=await waitFor(s=>s.is_playing&&s.item?.uri===list[0],{tries:10,base:140});
      if(!verified)throw Error('Spotify bevestigde de gestarte track niet.');
      Truth.end(op);return true
    }catch(e){Truth.end(op,{error:e?.message||e});health.failures++;health.lastError=String(e?.message||e);return false}
  }
  async function playUri(uri){
    if(!uri){return resume()}
    const id=String(uri).split(':').pop(),batch=batchFromTrack(id);return playBatch(batch.length?batch:[uri],{expectedTrackId:id})
  }
  async function resume(){
    const op=Truth.begin('resume',{timeoutMs:6500});Truth.setExpectedLive(true,'resume');
    try{
      const live=await remoteState('resume-probe'),id=live?.device?.id||await chooseDevice({preferActive:false});if(!id)throw Error('Geen Spotify-device gevonden.');
      await transfer(id,false);await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});
      const ok=await waitFor(s=>!!s.is_playing,{tries:8,base:140});if(!ok)throw Error('Spotify hervatte niet.');Truth.end(op);return true
    }catch(e){Truth.end(op,{error:e?.message||e});return false}
  }
  async function pause(){
    const op=Truth.begin('pause',{timeoutMs:5000});Truth.setExpectedLive(false,'pause');hiddenWasPlaying=false;
    try{
      const live=await remoteState('pause-probe'),id=live?.device?.id||storedDevice();
      await api('/me/player/pause'+(id?'?device_id='+encodeURIComponent(id):''),{method:'PUT'});
      await waitFor(s=>!s.is_playing,{tries:6,base:120});Truth.end(op);syncStartButton();return true
    }catch(e){Truth.end(op,{error:e?.message||e});return false}
  }

  async function startQueue(){
    if(starting)return false;starting=true;const b=$('start');if(b){b.disabled=true;b.textContent='Josh FM start…';b.classList.remove('hidden');b.style.display=''}
    const op=Truth.begin('start',{timeoutMs:12000});Truth.setExpectedLive(true,'start');
    try{
      const linked=await window.JFMAuth?.reconcile?.();if(linked===false)throw Error('Spotify is niet gekoppeld.');
      if(!stationQueue().length){info('Radioset wordt gemaakt…');await buildSet()}
      const q=stationQueue();if(!q.length)throw Error('Geen nummers gevonden voor je radioset.');
      let id=await chooseDevice({preferActive:false});
      if(!id&&isIOS){sessionStorage.setItem(PENDING,'1');info('Open Spotify kort om je iPhone als afspeelapparaat te activeren. Ga daarna terug naar Josh FM.');location.assign('spotify:');Truth.end(op);return false}
      if(!id)throw Error('Geen Spotify-afspeelapparaat gevonden. Open Spotify één keer en probeer opnieuw.');
      if($('jingles')?.checked&&typeof speakText==='function'){
        info('Josh FM-jingle…');try{await Promise.race([speakText('Josh FM. Your music, your radio show.',true),wait(4500)])}catch{};id=await chooseDevice({preferActive:false})||id
      }
      const uris=q.slice(0,30).map(t=>t.uri).filter(Boolean);info('Muziek wordt gestart…');
      const ok=await playBatch(uris,{deviceId:id,positionMs:0,type:'start',expectedTrackId:q[0]?.id||''});if(!ok)throw Error('Spotify reageert niet betrouwbaar op Start.');
      session=[];try{renderHistory()}catch{};try{scheduleTalk()}catch{};try{startPolling()}catch{};
      Truth.end(op);Truth.setExpectedLive(true,'radio-live');info(`Josh FM is live · ${q.length} tracks klaar.`);syncStartButton();return true
    }catch(e){Truth.end(op,{error:e?.message||e});Truth.setExpectedLive(false,'start-failed');health.lastError=String(e?.message||e);info('Starten lukte niet: '+health.lastError,true);syncStartButton();return false}
    finally{starting=false;if(b&&!Truth.get().expectedLive){b.disabled=false;b.textContent='Start Josh FM';syncStartButton()}}
  }
  async function playPause(){const live=await remoteState('toggle-probe');return live?.is_playing?pause():resume()}
  async function next(){
    const live=await remoteState('next-probe'),beforeId=live?.item?.id||Truth.get().trackId||'',fallback=expectedNext(beforeId,1);
    if(beforeId)try{recordSkip(beforeId)}catch{}
    const op=Truth.begin('next',{expectedTrackId:fallback?.id||'',timeoutMs:7000});Truth.setExpectedLive(true,'next');
    try{
      const id=live?.device?.id||await chooseDevice();await api('/me/player/next'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});
      let changed=await waitFor(s=>!!s.item?.id&&s.item.id!==beforeId,{tries:8,base:130});
      if(!changed&&fallback?.uri){const idx=queueIndex(fallback.id),batch=batchFromIndex(idx);const ok=await playBatch(batch.length?batch:[fallback.uri],{deviceId:id,type:'next',expectedTrackId:fallback.id});if(!ok)throw Error('De volgende track kon niet worden gestart.');changed=await remoteState('next-fallback')}
      if(!changed)throw Error('Spotify heeft geen volgende track bevestigd.');
      if(!changed.is_playing)await resume();Truth.end(op);return true
    }catch(e){Truth.end(op,{error:e?.message||e});health.lastError=String(e?.message||e);info('Volgende nummer lukte niet: '+health.lastError,true);return false}
  }
  async function previous(){
    const live=await remoteState('previous-probe'),beforeId=live?.item?.id||Truth.get().trackId||'',fallback=expectedNext(beforeId,-1);
    const op=Truth.begin('previous',{expectedTrackId:fallback?.id||'',timeoutMs:7000});Truth.setExpectedLive(true,'previous');
    try{
      const id=live?.device?.id||await chooseDevice();await api('/me/player/previous'+(id?'?device_id='+encodeURIComponent(id):''),{method:'POST'});
      let changed=await waitFor(s=>!!s.item?.id&&s.item.id!==beforeId,{tries:7,base:130});
      if(!changed&&fallback?.uri){const idx=queueIndex(fallback.id),batch=batchFromIndex(idx);const ok=await playBatch(batch.length?batch:[fallback.uri],{deviceId:id,type:'previous',expectedTrackId:fallback.id});if(!ok)throw Error('De vorige track kon niet worden gestart.');changed=await remoteState('previous-fallback')}
      Truth.end(op);return!!changed
    }catch(e){Truth.end(op,{error:e?.message||e});info('Vorige nummer lukte niet: '+String(e?.message||e),true);return false}
  }

  async function recover(reason='unknown',{force=false}={}){
    if(recovering||starting||Truth.blocksRecovery()||djBusy||window.JFMDJTransition?.busy)return false;
    recovering=true;health.lastReason=reason;
    try{
      const live=await remoteState('recovery-probe');if(live?.is_playing){Truth.setExpectedLive(true,'playing');return true}
      const truth=Truth.get();if(!force&&!truth.expectedLive&&!hiddenWasPlaying)return false;
      const trackId=live?.item?.id||truth.trackId,uri=live?.item?.uri||truth.uri,position=Number(live?.progress_ms??truth.progressMs??0);
      let id=live?.device?.id||await chooseDevice({preferActive:false});
      if(!id&&isIOS){info('Spotify is niet actief. Open Spotify kort en ga daarna terug naar Josh FM.',true);return false}
      if(!id||!uri)return false;
      const batch=batchFromTrack(trackId),ok=await playBatch(batch.length?batch:[uri],{deviceId:id,positionMs:position,type:'resume',expectedTrackId:trackId});
      if(ok){health.recoveries++;health.lastGoodAt=Date.now();hiddenWasPlaying=false;info('Spotify-verbinding hersteld · Josh FM speelt verder.');return true}
      health.failures++;return false
    }catch(e){health.failures++;health.lastError=String(e?.message||e);return false}
    finally{recovering=false}
  }

  function own(id,fn){const old=$(id);if(!old)return;const b=old.cloneNode(true);old.replaceWith(b);if(id==='start'){b.disabled=false;b.classList.remove('hidden');b.style.display=''}b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()})}
  own('start',startQueue);own('play',playPause);own('next',next);own('prev',previous);

  async function resumePending(){if(document.visibilityState!=='visible'||sessionStorage.getItem(PENDING)!=='1')return;sessionStorage.removeItem(PENDING);info('Spotify is actief · Josh FM start…');await wait(700);startQueue()}
  async function onVisible(reason){lastVisibleAt=Date.now();await resumePending();if(hiddenWasPlaying||Truth.shouldRecover()){await wait(isIOS?650:300);recover(reason,{force:hiddenWasPlaying})}}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){const s=Truth.get();hiddenWasPlaying=!!s.isPlaying||!!s.expectedLive}else onVisible('visibility')});
  window.addEventListener('pageshow',()=>setTimeout(()=>onVisible('pageshow'),150));window.addEventListener('focus',()=>setTimeout(()=>onVisible('focus'),180));window.addEventListener('online',()=>setTimeout(()=>recover('online'),300));

  const oldRefresh=window.refresh;if(typeof oldRefresh==='function')window.refresh=refresh=async function(...args){
    const out=await oldRefresh.apply(this,args);try{if(playback?.item)render(playback,'legacy-refresh')}catch{}return out
  };
  setInterval(async()=>{
    if(watching||document.visibilityState!=='visible'||starting||recovering||Truth.blocksRecovery()||djBusy||window.JFMDJTransition?.busy)return;watching=true;
    try{
      const s=await remoteState('watchdog');if(s?.is_playing)return;
      const truth=Truth.get();if(truth.expectedLive&&Date.now()-lastVisibleAt<120000)await recover('watchdog')
    }finally{watching=false}
  },12000);
  Truth.subscribe(()=>syncStartButton());setTimeout(()=>remoteState('startup').catch(()=>{}),500);setTimeout(syncStartButton,80);

  window.JFMPlayback={
    version:'playback-v5-truth',start:startQueue,next,previous,playPause,pause,resume,playUri,
    recover,ensureDevice,chooseDevice,transfer,storedDevice,syncStartButton,
    get state(){return Truth.get()},get health(){return{...health,recovering,hiddenWasPlaying,operation:Truth.activeOperation()}}
  };
  window.jfmPlayUri=playUri;window.jfmEnsureSpotifyDevice=ensureDevice;window.jfmWebResume=resume;window.jfmWebPause=pause;window.jfmWebNext=next;window.jfmWebPrevious=previous;
})();
