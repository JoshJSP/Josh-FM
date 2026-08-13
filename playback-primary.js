// Josh FM primary playback controller — the only active owner of transport controls.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id';
  let bound=false,busy=false,lastError='',recoveries=0,failures=0,endGuardBusy=false,lastNaturalEnd='';
  const info=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const player=()=>{const p=window.jfmSpotifyPlayer;return p&&typeof p.getCurrentState==='function'?p:null};
  const sdkDeviceId=()=>String(window.JFMSpotifySDK?.deviceId||'').trim();
  const deviceId=()=>sdkDeviceId()||String(localStorage.getItem(DEVICE_KEY)||'').trim();
  const truth=()=>window.JFMPlaybackState||null;
  const transportIds=new Set(['start','play','next','prev']);
  const djOwnsTransport=()=>!!(window.JFMDJAuthoritative?.busy||window.JFMDJTransition?.busy||window.djBusy||truth()?.blocksRecovery?.());

  function activateNow(){try{player()?.activateElement?.()}catch{}}
  async function ensurePlayer(){for(let i=0;i<70;i++){const p=player();if(p&&deviceId())return p;await wait(120)}throw Error('Josh FM-player is nog niet klaar. Koppel Spotify opnieuw of vernieuw de app.')}
  async function remote(){try{return await api('/me/player')}catch{return null}}
  async function freshDevice(){
    await ensurePlayer();let id='';
    try{id=await window.JFMSpotifySDK?.ensureDevice?.()}catch{}
    id=String(id||sdkDeviceId()||deviceId()).trim();if(!id)throw Error('Spotify-device is niet beschikbaar.');
    if(localStorage.getItem(DEVICE_KEY)!==id)localStorage.setItem(DEVICE_KEY,id);return id
  }
  async function transfer(id,play){await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(220);return remote()}
  async function ensureActive({preserve=true}={}){const p=await ensurePlayer(),id=await freshDevice();let s=await remote();if(s?.device?.id!==id)s=await transfer(id,preserve&&!!s?.is_playing);return{p,id,state:s}}
  async function verify(predicate,tries=10){for(let i=0;i<tries;i++){await wait(140+i*45);const s=await remote();if(s&&predicate(s))return s}return null}
  function setBusy(on){busy=!!on;['start','play','next','prev'].forEach(id=>{const b=$(id);if(b)b.disabled=busy})}
  async function withBusy(fn){if(busy)return false;setBusy(true);try{return await fn()}finally{setBusy(false)}}
  function ingest(s,source='primary'){if(!s)return;const confirmed=String(s?.device?.id||'').trim();if(confirmed&&localStorage.getItem(DEVICE_KEY)!==confirmed)localStorage.setItem(DEVICE_KEY,confirmed);try{playback=s;renderPlayback(s)}catch{};try{truth()?.ingest?.(s,source)}catch{}}
  function rememberError(e,prefix){lastError=String(e?.message||e);failures++;try{truth()?.error?.(lastError)}catch{};info(prefix+lastError,true);return false}
  function stationQueue(){try{return Array.isArray(queue)?queue.filter(t=>t?.uri):[]}catch{return[]}}
  function stationIndex(stateOrUri){const q=stationQueue(),uri=typeof stateOrUri==='string'?stateOrUri:stateOrUri?.item?.uri,id=typeof stateOrUri==='string'?'':stateOrUri?.item?.id;let i=uri?q.findIndex(t=>t?.uri===uri):-1;if(i<0&&id)i=q.findIndex(t=>t?.id===id);return i}
  function stationContext(uri,max=30){const q=stationQueue(),i=stationIndex(uri);if(i<0)return uri?[uri]:[];return [...new Set(q.slice(i,i+max).map(t=>t?.uri).filter(Boolean))]}
  function stationNeighbor(state,delta){const q=stationQueue(),i=stationIndex(state);if(i<0)return'';return q[i+delta]?.uri||''}
  async function playContextDirect(uri,id,source='primary-uri'){
    const uris=stationContext(uri);if(!uris.length)throw Error('De track staat niet meer in de Josh FM-radioset.');
    await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:0}});
    const s=await verify(x=>x.device?.id===id&&x.is_playing&&x.item?.uri===uri,10);if(!s)throw Error('Spotify bevestigde de track niet.');
    ingest(s,source);truth()?.setExpectedLive?.(true,'play-track');return s
  }
  async function startDirect(){
    const id=await freshDevice();let before=await remote();
    if(before?.device?.id!==id)before=await transfer(id,false);else if(before?.is_playing){await api('/me/player/pause?device_id='+encodeURIComponent(id),{method:'PUT'});await verify(x=>x.device?.id===id&&!x.is_playing,6)}
    if(!Array.isArray(queue)||!queue.length){info('Radioset wordt gemaakt…');await buildSet()}
    const uris=(queue||[]).slice(0,30).map(x=>x?.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare nummers in de radioset.');
    if($('jingles')?.checked&&typeof speakText==='function'){info('Josh FM-jingle…');await speakText('Josh FM. Your music, your radio show.',true).catch(()=>false)}
    info('Muziek wordt gestart…');await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:0}});
    const s=await verify(x=>x.device?.id===id&&x.is_playing&&!!x.item?.id);if(!s)throw Error('Spotify bevestigde het starten niet.');
    try{session=[];lastTrackId=null;renderHistory();scheduleTalk();startPolling()}catch{};ingest(s,'primary-start');truth()?.setExpectedLive?.(true,'radio-live');info(`Josh FM is live · ${queue.length} tracks klaar.`);return true
  }
  async function start(){activateNow();return withBusy(async()=>{try{return await startDirect()}catch(e){truth()?.setExpectedLive?.(false,'start-failed');return rememberError(e,'Starten lukte niet: ')}})}

  async function pauseDirect(){const{id,state}=await ensureActive();if(!state?.is_playing){truth()?.setExpectedLive?.(false,'pause');return true}await api('/me/player/pause?device_id='+encodeURIComponent(id),{method:'PUT'});let s=await verify(x=>x.device?.id===id&&!x.is_playing,8);if(!s){await player()?.pause?.();s=await verify(x=>x.device?.id===id&&!x.is_playing,6)}if(!s)throw Error('Spotify bevestigde pauzeren niet.');ingest(s,'primary-pause');truth()?.setExpectedLive?.(false,'pause');info('Josh FM staat gepauzeerd.');return true}
  async function resumeDirect(){const{id,state}=await ensureActive();if(state?.is_playing){ingest(state,'primary-resume-already');truth()?.setExpectedLive?.(true,'resume');return true}if(!state?.item){truth()?.setExpectedLive?.(true,'restart-empty');return startDirect()}await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});let s=await verify(x=>x.device?.id===id&&x.is_playing,8);if(!s){await player()?.resume?.();s=await verify(x=>x.device?.id===id&&x.is_playing,6)}if(!s)throw Error('Spotify bevestigde hervatten niet.');ingest(s,'primary-resume');truth()?.setExpectedLive?.(true,'resume');info('Josh FM speelt.');return true}
  async function playPause(){activateNow();return withBusy(async()=>{try{const s=await remote();return s?.is_playing?pauseDirect():resumeDirect()}catch(e){return rememberError(e,'Play/pauze mislukt: ')}})}
  async function pause(){return withBusy(async()=>{try{return await pauseDirect()}catch(e){return rememberError(e,'Pauzeren mislukt: ')}})}
  async function resume(){return withBusy(async()=>{try{return await resumeDirect()}catch(e){return rememberError(e,'Hervatten mislukt: ')}})}

  async function advance({record=false,source='primary-next'}={}){
    const{id,state}=await ensureActive();const before=state?.item?.id||'';if(!before)throw Error('Er speelt nog geen nummer.');if(record)try{recordSkip(before)}catch{};
    const fallbackUri=stationNeighbor(state,1);
    try{await api('/me/player/next?device_id='+encodeURIComponent(id),{method:'POST'})}catch{}
    let s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,6);
    if(!s){try{await player()?.nextTrack?.()}catch{};s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,4)}
    if(!s&&fallbackUri)s=await playContextDirect(fallbackUri,id,source+'-fallback');
    if(!s)throw Error('Spotify bevestigde volgende niet.');
    if(!s.is_playing){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing,5)||s}
    ingest(s,source);truth()?.setExpectedLive?.(true,'radio-live');return s
  }
  async function skip(delta){
    activateNow();return withBusy(async()=>{
      try{
        if(delta>0){await advance({record:true,source:'primary-next'});info('Josh FM speelt.');return true}
        const{id,state}=await ensureActive();const before=state?.item?.id||'';if(!before)throw Error('Er speelt nog geen nummer.');const fallbackUri=stationNeighbor(state,-1);
        await api('/me/player/previous?device_id='+encodeURIComponent(id),{method:'POST'});let s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,8);
        if(!s){try{await player()?.previousTrack?.()}catch{};s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,5)}
        if(!s&&fallbackUri)s=await playContextDirect(fallbackUri,id,'primary-prev-fallback');if(!s)throw Error('Spotify bevestigde vorige niet.');if(!s.is_playing){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing,6)||s}ingest(s,'primary-prev');truth()?.setExpectedLive?.(true,'previous');info('Josh FM speelt.');return true
      }catch(e){return rememberError(e,(delta>0?'Volgende':'Vorige')+' mislukt: ')}
    })
  }

  async function handleNaturalEnd(detail={}){
    const endedId=String(detail.trackId||'');if(!endedId||endGuardBusy||lastNaturalEnd===endedId||busy||djOwnsTransport())return false;
    endGuardBusy=true;lastNaturalEnd=endedId;
    try{
      await wait(450);if(djOwnsTransport())return false;let s=await remote();
      if(s?.item?.id&&s.item.id!==endedId){if(!s.is_playing){if(djOwnsTransport())return false;const id=await freshDevice();await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.item?.id!==endedId&&x.is_playing,4)||s}ingest(s,'primary-natural-auto');try{window.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:endedId,newTrackId:s.item?.id||'',auto:true}}))}catch{};return true}
      if(djOwnsTransport())return false;s=await advance({record:false,source:'primary-natural-end'});recoveries++;info('Josh FM gaat automatisch door.');
      try{window.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:endedId,newTrackId:s?.item?.id||'',auto:false}}))}catch{};return true
    }catch(e){return rememberError(e,'Automatisch doorgaan mislukt: ')}finally{endGuardBusy=false;setTimeout(()=>{if(lastNaturalEnd===endedId)lastNaturalEnd=''},2500)}
  }

  async function playUri(uri){activateNow();if(!uri)return resume();return withBusy(async()=>{try{const{id}=await ensureActive();await playContextDirect(uri,id,'primary-uri');return true}catch(e){return rememberError(e,'Track starten mislukt: ')}})}
  async function recover(reason='watchdog'){if(busy||endGuardBusy||djOwnsTransport())return false;const t=truth()?.get?.();if(!t?.expectedLive)return false;if(truth()?.shouldRecover&&!truth().shouldRecover())return !!t.isPlaying;try{await freshDevice();if(djOwnsTransport())return false;const s=await remote();if(s?.is_playing){ingest(s,'primary-recovery-already');return true}if(djOwnsTransport())return false;const ok=await resume();if(ok){recoveries++;info('Spotify-verbinding hersteld.')}return ok}catch(e){return rememberError(e,'Playback-herstel mislukt: ')}}

  function actionFor(id){return id==='start'?start:id==='play'?playPause:id==='next'?()=>skip(1):id==='prev'?()=>skip(-1):null}
  function bind(){if(bound||!player()||!deviceId())return false;bound=true;const own=(id,fn)=>{const old=$(id);if(!old)return;const b=old.cloneNode(true);old.replaceWith(b);b.disabled=false;b.dataset.jfmOwner='primary';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();activateNow();Promise.resolve(fn()).catch(()=>{})},true)};own('start',start);own('play',playPause);own('next',()=>skip(1));own('prev',()=>skip(-1));info('Josh FM-player klaar.');return true}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#start,#play,#next,#prev,#djNow');if(!b)return;activateNow();if(transportIds.has(b.id)&&!bound){e.preventDefault();e.stopImmediatePropagation();const fn=actionFor(b.id);if(bind()&&fn)Promise.resolve(fn()).catch(()=>{});else info('Josh FM-player wordt nog voorbereid. Tik over een moment opnieuw.',true)}},true);
  window.addEventListener('jfm:natural-track-end',e=>handleNaturalEnd(e.detail||{}).catch(()=>{}));

  let tries=0;const boot=()=>{if(bind())return;if(++tries<100)setTimeout(boot,120)};boot();
  window.addEventListener('pageshow',()=>setTimeout(()=>{bound=false;tries=0;boot();recover('pageshow')},450));window.addEventListener('online',()=>setTimeout(()=>recover('online'),450));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>recover('visible'),450)});setInterval(()=>recover('watchdog'),12000);

  window.JFMPlayback={primary:true,version:'primary-v7-reentrant-safe',start,next:()=>skip(1),previous:()=>skip(-1),playPause,pause,resume,playUri,recover,handleNaturalEnd,ensureDevice:freshDevice,stationContext,get state(){return truth()?.get?.()||null},get health(){return{failures,recoveries,lastError,busy,endGuardBusy,djBusy:djOwnsTransport(),deviceId:deviceId(),bound}}};
  window.JFMPlaybackPrimary='playback-primary';window.jfmPlayUri=playUri;window.jfmWebResume=resume;window.jfmWebPause=pause;window.jfmWebNext=()=>skip(1);window.jfmWebPrevious=()=>skip(-1);
})();