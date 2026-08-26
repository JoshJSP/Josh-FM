// Josh FM primary playback controller — the only active owner of transport controls.
(()=>{
  if(window.__jfmPlaybackPrimaryInstalled)return;window.__jfmPlaybackPrimaryInstalled=true;
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id';
  const TRUTH_KEY='jfm_playback_truth_v1',TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/;
  function readReloadIntent(){try{const x=JSON.parse(sessionStorage.getItem(TRUTH_KEY)||'{}'),age=Date.now()-Number(x.updatedAt||0);if(x.expectedLive&&TRACK_URI.test(String(x.uri||''))&&age>=0&&age<5*60*1000)return{uri:String(x.uri),trackId:String(x.trackId||''),progressMs:Math.max(0,Number(x.progressMs||0)),durationMs:Math.max(0,Number(x.durationMs||0)),deviceId:String(x.deviceId||''),updatedAt:Number(x.updatedAt||0)}}catch{}return null}
  let reloadIntent=readReloadIntent(),reloadNeedsGesture=false,bound=false,busy=false,lastError='',recoveries=0,failures=0,deviceHandovers=0,reloadRestores=0,endGuardBusy=false,lastNaturalEnd='',recoveryFailures=0,recoveryCooldownUntil=0,startPending=false;
  const info=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const player=()=>{const p=window.jfmSpotifyPlayer;return p&&typeof p.getCurrentState==='function'?p:null};
  const sdkDeviceId=()=>String(window.JFMSpotifySDK?.deviceId||'').trim();
  const deviceId=()=>sdkDeviceId()||String(localStorage.getItem(DEVICE_KEY)||'').trim();
  const truth=()=>window.JFMPlaybackState||null;
  function markTransitionAction(type,detail={}){const payload={type,fromTrackId:String(detail.fromTrackId||truth()?.get?.()?.trackId||''),expectedTrackId:String(detail.expectedTrackId||''),source:String(detail.source||'playback-primary'),at:Date.now()};if(window.MAIRTransitionController?.mark)return window.MAIRTransitionController.mark(type,payload);try{window.dispatchEvent(new CustomEvent('jfm:transport-action',{detail:payload}))}catch{}return''}
  const transportIds=new Set(['start','play','next','prev']);
  const djOwnsTransport=()=>!!(window.JFMDJAuthoritative?.busy||window.JFMDJTransition?.busy||window.djBusy||truth()?.blocksRecovery?.());
  const backgrounded=()=>document.visibilityState==='hidden'||document.body?.getAttribute('data-mair-background')==='1';
  function showReloadPrompt(){reloadNeedsGesture=true;const artist=$('artist'),play=$('play');if(artist)artist.textContent='Tik op Play om na het vernieuwen verder te luisteren.';if(play)play.setAttribute('aria-label','Hervat MAIR na vernieuwen');info('Tik op Play om MAIR hoorbaar te hervatten.',true)}
  function clearReloadPrompt(){reloadNeedsGesture=false;try{$('play')?.removeAttribute?.('aria-label')}catch{}}

  function activateNow(){try{player()?.activateElement?.()}catch{}}
  async function ensurePlayer(){for(let i=0;i<70;i++){const p=player();if(p)return p;await wait(120)}throw Error('Josh FM-player is nog niet klaar. Koppel Spotify opnieuw of vernieuw de app.')}
  async function remote(){try{return await api('/me/player')}catch{return null}}
  async function freshDevice(){
    await ensurePlayer();let id='';
    if(window.JFMSpotifySDK?.ensureDevice)id=await window.JFMSpotifySDK.ensureDevice();
    id=String(id||sdkDeviceId()||deviceId()).trim();if(!id)throw Error('Spotify-device is niet beschikbaar.');
    if(localStorage.getItem(DEVICE_KEY)!==id)localStorage.setItem(DEVICE_KEY,id);return id
  }
  async function transfer(id,play){await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(220);return remote()}
  async function ensureActive({preserve=true}={}){const p=await ensurePlayer(),id=await freshDevice();let s=await remote();if(s?.device?.id!==id){s=await transfer(id,preserve&&!!s?.is_playing);deviceHandovers++}return{p,id,state:s}}
  async function restoreReloadPlayback(){
    const intent=reloadIntent;if(!intent)return null;const p=await ensurePlayer(),id=await freshDevice();let s=await remote(),elapsed=Math.max(0,Date.now()-intent.updatedAt),remaining=intent.durationMs?Math.max(0,intent.durationMs-intent.progressMs):Infinity,naturalAdvanceDue=remaining<=elapsed+3000;
    if(s?.is_playing&&s.item?.uri!==intent.uri&&naturalAdvanceDue){if(s.device?.id!==id){s=await transfer(id,true);deviceHandovers++}reloadIntent=null;return{p,id,state:s}}
    if(s?.device?.id!==id){await transfer(id,false);deviceHandovers++}
    const position=Math.min(Math.max(0,intent.progressMs+elapsed),Math.max(0,(intent.durationMs||Infinity)-1500));await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris:[intent.uri],position_ms:position}});
    s=await verify(x=>x.device?.id===id&&x.is_playing&&x.item?.uri===intent.uri,10);if(!s)throw Error('Spotify bevestigde de track na vernieuwen niet.');let local=false;for(let i=0;i<3&&!local;i++){try{await p.seek(position);await p.resume();local=!!(await verifySdk(x=>!x.paused&&sdkUri(x)===intent.uri&&Math.abs(Number(x.position||0)-position)<6000,8))}catch{}if(!local)await wait(180)}await wait(700);try{const stable=await p.getCurrentState();local=!!(stable&&!stable.paused&&sdkUri(stable)===intent.uri&&Math.abs(Number(stable.position||0)-position)<8000)}catch{local=false}if(!local){showReloadPrompt();const error=Error('De browser wacht op een tik om audio na vernieuwen te hervatten.');error.code='RELOAD_GESTURE';throw error}clearReloadPrompt();window.__jfmReloadContextUri=intent.uri;try{window.dispatchEvent(new CustomEvent('jfm:reload-context-restored',{detail:{uri:intent.uri}}))}catch{}reloadRestores++;reloadIntent=null;return{p,id,state:s}
  }
  async function verify(predicate,tries=10){for(let i=0;i<tries;i++){await wait(140+i*45);const s=await remote();if(s&&predicate(s))return s}return null}
  async function verifySdk(predicate,tries=8){const p=player();if(!p)return null;for(let i=0;i<tries;i++){try{const s=await p.getCurrentState();if(s&&predicate(s))return s}catch{}await wait(45+i*25)}return null}
  async function nudgeSdkPlayback(){if(await verifySdk(s=>!!s?.track_window?.current_track&&!s.paused,4))return true;try{await player()?.resume?.()}catch{}return!!(await verifySdk(s=>!!s?.track_window?.current_track&&!s.paused,6))}
  const sdkUri=s=>String(s?.track_window?.current_track?.uri||'');
  async function observedPlaying(){
    try{const sdk=await player()?.getCurrentState?.();if(sdk?.track_window?.current_track)return!sdk.paused}catch{}
    const s=await remote();if(s?.item)return!!s.is_playing;
    const t=truth()?.get?.();if(t?.trackId||t?.uri)return!!t.isPlaying;
    return null
  }
  function setBusy(on){busy=!!on;const ready=!!player()&&!!deviceId();['play','next','prev','start'].forEach(id=>{const b=$(id);if(b)b.disabled=busy||!ready})}
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
    const s=await verify(x=>x.device?.id===id&&x.is_playing&&uris.includes(x.item?.uri),10);if(!s)throw Error('Spotify bevestigde geen afspeelbare track uit de radioset.');
    await nudgeSdkPlayback();ingest(s,source);truth()?.setExpectedLive?.(true,'play-track');return s
  }
  async function startDirect(){
    const id=await freshDevice();let before=await remote();
    if(before?.device?.id!==id)before=await transfer(id,false);else if(before?.is_playing){await api('/me/player/pause?device_id='+encodeURIComponent(id),{method:'PUT'});await verify(x=>x.device?.id===id&&!x.is_playing,6)}
    if(!Array.isArray(queue)||!queue.length){info('Radioset wordt gemaakt…');await buildSet()}
    const uris=(queue||[]).slice(0,30).map(x=>x?.uri).filter(Boolean);if(!uris.length)throw Error('Geen afspeelbare nummers in de radioset.');
    if($('jingles')?.checked&&typeof speakText==='function'){info('Josh FM-jingle…');await speakText('Josh FM. Your music, your radio show.',true).catch(()=>false)}
    info('Muziek wordt gestart…');await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:0}});
    const s=await verify(x=>x.device?.id===id&&x.is_playing&&!!x.item?.id);if(!s)throw Error('Spotify bevestigde het starten niet.');await nudgeSdkPlayback();
    try{session=[];lastTrackId=null;renderHistory();scheduleTalk();startPolling()}catch{};ingest(s,'primary-start');truth()?.setExpectedLive?.(true,'radio-live');recoveryFailures=0;recoveryCooldownUntil=0;info(`Josh FM is live · ${queue.length} tracks klaar.`);return true
  }
  async function start(){
    activateNow();
    if(busy||djOwnsTransport()){
      if(startPending)return false;
      startPending=true;info('Start wordt klaargezet…');
      try{for(let i=0;i<24&&(busy||djOwnsTransport());i++)await wait(150)}finally{startPending=false}
      if(busy||djOwnsTransport()){info('Josh FM is nog bezig. Tik Start nog een keer.',true);return false}
    }
    return withBusy(async()=>{try{return await startDirect()}catch(e){truth()?.setExpectedLive?.(false,'start-failed');return rememberError(e,'Starten lukte niet: ')}})
  }

  async function pauseDirect(){
    const{p,id,state}=await ensureActive(),wasExpected=!!truth()?.get?.()?.expectedLive;
    let sdk=null;try{sdk=await p.getCurrentState()}catch{}
    const playing=sdk?.track_window?.current_track?!sdk.paused:(state?.item?!!state.is_playing:!!truth()?.get?.()?.isPlaying);
    if(!playing){truth()?.setExpectedLive?.(false,'pause');return true}
    truth()?.setExpectedLive?.(false,'pause');
    try{
      let local=false;try{await p.pause();local=!!(await verifySdk(x=>x.paused,8))}catch{}
      let s=await verify(x=>x.device?.id===id&&!x.is_playing,3);
      if(!local&&!s){await api('/me/player/pause?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&!x.is_playing,8)}
      if(!local&&!s)throw Error('Spotify bevestigde pauzeren niet.');if(s)ingest(s,'primary-pause');info('Josh FM staat gepauzeerd.');return true
    }catch(e){truth()?.setExpectedLive?.(wasExpected,'pause-failed');throw e}
  }
  async function resumeDirect(){
    const{p,id,state}=await ensureActive();let sdk=null;try{sdk=await p.getCurrentState()}catch{}
    const hasTrack=!!(state?.item||sdk?.track_window?.current_track||truth()?.get?.()?.trackId),playing=sdk?.track_window?.current_track?!sdk.paused:(state?.item?!!state.is_playing:!!truth()?.get?.()?.isPlaying);
    if(playing){if(state)ingest(state,'primary-resume-already');truth()?.setExpectedLive?.(true,'resume');recoveryFailures=0;recoveryCooldownUntil=0;info('Josh FM speelt.');return true}
    if(!hasTrack){truth()?.setExpectedLive?.(true,'restart-empty');return startDirect()}
    truth()?.setExpectedLive?.(true,'resume');let local=false;try{await p.resume();local=!!(await verifySdk(x=>!x.paused,8))}catch{}
    let s=await verify(x=>x.device?.id===id&&x.is_playing,3);if(!local&&!s){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing,8)}
    if(!local&&!s)throw Error('Spotify bevestigde hervatten niet.');if(s)ingest(s,'primary-resume');recoveryFailures=0;recoveryCooldownUntil=0;info('Josh FM speelt.');return true
  }
  async function playPause(){activateNow();if(window.MAIRDJ?.busy&&window.MAIRDJ?.userOverride?.('PLAY_PAUSE')){info('DJ-break wordt afgerond; MAIR blijft daarna gepauzeerd.');return true}return withBusy(async()=>{try{if(reloadIntent&&reloadNeedsGesture){const{state}=await restoreReloadPlayback();if(state)ingest(state,'primary-reload-gesture');truth()?.setExpectedLive?.(true,'reload-gesture');info('Josh FM speelt.');return true}const playing=await observedPlaying();if(playing===null)return startDirect();return playing?pauseDirect():resumeDirect()}catch(e){return rememberError(e,'Play/pauze mislukt: ')}})}
  async function pause(){return withBusy(async()=>{try{return await pauseDirect()}catch(e){return rememberError(e,'Pauzeren mislukt: ')}})}
  async function resume(){return withBusy(async()=>{try{return await resumeDirect()}catch(e){return rememberError(e,'Hervatten mislukt: ')}})}

  // DJ-only transport uses the local Web Playback SDK first. This keeps the critical
  // handoff short and ordered; device-qualified Web API calls remain the fallback.
  async function djPauseDirect(expectedUri=''){
    const id=await freshDevice(),p=await ensurePlayer();
    const t=truth()?.get?.();if(expectedUri&&t?.uri&&t.uri!==expectedUri)throw Error('DJ-pauze hoort niet meer bij de huidige track.');
    let local=false;try{await p.pause();local=!!(await verifySdk(s=>s.paused&&(!expectedUri||sdkUri(s)===expectedUri),8))}catch{}
    let s=await verify(x=>x.device?.id===id&&!x.is_playing&&(!expectedUri||x.item?.uri===expectedUri),3);
    if(!local&&!s){await api('/me/player/pause?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&!x.is_playing&&(!expectedUri||x.item?.uri===expectedUri),6)}
    if(!local&&!s)throw Error('Spotify bevestigde DJ-pauze niet.');if(s)ingest(s,'primary-dj-pause');truth()?.setExpectedLive?.(true,'dj-handoff');return true
  }
  async function djResumeDirect(expectedUri=''){
    const id=await freshDevice(),p=await ensurePlayer();
    const t=truth()?.get?.();if(expectedUri&&t?.uri&&t.uri!==expectedUri)throw Error('DJ-resume hoort niet meer bij de huidige track.');
    let local=false;try{await p.resume();local=!!(await verifySdk(s=>!s.paused&&(!expectedUri||sdkUri(s)===expectedUri),8))}catch{}
    let s=await verify(x=>x.device?.id===id&&x.is_playing&&(!expectedUri||x.item?.uri===expectedUri),3);
    if(!local&&!s){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing&&(!expectedUri||x.item?.uri===expectedUri),6)}
    if(!local&&!s)throw Error('Spotify bevestigde DJ-resume niet.');if(s)ingest(s,'primary-dj-resume');truth()?.setExpectedLive?.(true,'radio-live');recoveryFailures=0;recoveryCooldownUntil=0;return true
  }
  async function djRewindDirect(expectedUri=''){
    const id=await freshDevice(),p=await ensurePlayer();
    let local=false;try{await p.seek(0);local=!!(await verifySdk(s=>(!expectedUri||sdkUri(s)===expectedUri)&&Number(s.position||0)<1400,8))}catch{}
    if(!local){await api('/me/player/seek?position_ms=0&device_id='+encodeURIComponent(id),{method:'PUT'});const s=await verify(x=>(!expectedUri||x.item?.uri===expectedUri)&&Number(x.progress_ms||0)<1800,5);if(!s)throw Error('Spotify bevestigde DJ-rewind niet.')}return true
  }
  async function djPause(uri=''){return withBusy(async()=>{try{return await djPauseDirect(uri)}catch(e){lastError=String(e?.message||e);return false}})}
  async function djResume(uri=''){return withBusy(async()=>{try{return await djResumeDirect(uri)}catch(e){lastError=String(e?.message||e);return false}})}
  async function djRewind(uri=''){return withBusy(async()=>{try{return await djRewindDirect(uri)}catch(e){lastError=String(e?.message||e);return false}})}

  async function advance({record=false,source='primary-next'}={}){
    const{id,state}=await ensureActive();const before=state?.item?.id||'';if(!before)throw Error('Er speelt nog geen nummer.');if(record)try{recordSkip(before)}catch{};
    const fallbackUri=stationNeighbor(state,1);
    try{await api('/me/player/next?device_id='+encodeURIComponent(id),{method:'POST'})}catch{}
    let s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,6);
    if(!s){try{await player()?.nextTrack?.()}catch{};s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,4)}
    if(!s&&fallbackUri)s=await playContextDirect(fallbackUri,id,source+'-fallback');
    if(!s)throw Error('Spotify bevestigde volgende niet.');
    if(!s.is_playing){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing,5)||s}
    ingest(s,source);truth()?.setExpectedLive?.(true,'radio-live');recoveryFailures=0;recoveryCooldownUntil=0;return s
  }
  async function fastNaturalAdvance(endedId){
    let s=await remote();
    if(s?.item?.id&&s.item.id!==endedId){
      if(!s.is_playing){const id=await freshDevice();await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.item?.id!==endedId&&x.is_playing,4)||s}
      ingest(s,'primary-natural-auto');return s
    }
    const fallbackUri=stationNeighbor(s,1);
    if(fallbackUri){
      const id=await freshDevice(),uris=stationContext(fallbackUri);
      await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:0}});
      s=await verify(x=>x.device?.id===id&&x.is_playing&&uris.includes(x.item?.uri),6);
      if(s){ingest(s,'primary-natural-fast');truth()?.setExpectedLive?.(true,'radio-live');return s}
    }
    return advance({record:false,source:'primary-natural-end'})
  }
  async function skip(delta){
    activateNow();return withBusy(async()=>{
      try{
        if(delta>0){markTransitionAction('NEXT');await advance({record:true,source:'primary-next'});info('Josh FM speelt.');return true}
        const{p,id,state}=await ensureActive();const before=state?.item?.id||'';if(!before)throw Error('Er speelt nog geen nummer.');markTransitionAction('PREVIOUS',{fromTrackId:before});const fallbackUri=stationNeighbor(state,-1);let position=Number(state?.progress_ms||0);if(!position)try{position=Number((await p.getCurrentState())?.position||0)}catch{}
        await api('/me/player/previous?device_id='+encodeURIComponent(id),{method:'POST'});if(position>3000){await wait(180);try{await p.previousTrack()}catch{await api('/me/player/previous?device_id='+encodeURIComponent(id),{method:'POST'})}}let s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,8);
        if(!s){try{await player()?.previousTrack?.()}catch{};s=await verify(x=>x.device?.id===id&&x.item?.id&&x.item.id!==before,5)}
        if(!s&&fallbackUri)s=await playContextDirect(fallbackUri,id,'primary-prev-fallback');if(!s)throw Error('Spotify bevestigde vorige niet.');if(!s.is_playing){await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT'});s=await verify(x=>x.device?.id===id&&x.is_playing,6)||s}ingest(s,'primary-prev');truth()?.setExpectedLive?.(true,'previous');recoveryFailures=0;recoveryCooldownUntil=0;info('Josh FM speelt.');return true
      }catch(e){return rememberError(e,(delta>0?'Volgende':'Vorige')+' mislukt: ')}
    })
  }

  async function handleNaturalEnd(detail={}){
    const endedId=String(detail.trackId||'');if(!endedId||endGuardBusy||lastNaturalEnd===endedId||busy||djOwnsTransport())return false;
    endGuardBusy=true;lastNaturalEnd=endedId;
    try{
      await wait(120);if(djOwnsTransport())return false;const s=await fastNaturalAdvance(endedId);if(!s)throw Error('Volgende track kon niet snel worden gestart.');recoveries++;recoveryFailures=0;recoveryCooldownUntil=0;info('Josh FM gaat automatisch door.');
      try{window.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:endedId,newTrackId:s?.item?.id||'',auto:true,fast:true}}))}catch{};return true
    }catch(e){return rememberError(e,'Automatisch doorgaan mislukt: ')}finally{endGuardBusy=false;setTimeout(()=>{if(lastNaturalEnd===endedId)lastNaturalEnd=''},1800)}
  }

  async function playUri(uri){activateNow();if(!uri)return resume();return withBusy(async()=>{let actionId='';try{actionId=markTransitionAction('STATION_CHANGE',{expectedTrackId:String(uri).split(':').pop(),source:'playback-primary-play-uri'});const{id}=await ensureActive();await playContextDirect(uri,id,'primary-uri');recoveryFailures=0;recoveryCooldownUntil=0;return true}catch(e){window.MAIRTransitionController?.cancel?.(actionId,'play-uri-failed');return rememberError(e,'Track starten mislukt: ')}})}
  async function recover(reason='watchdog'){if(backgrounded()||reloadNeedsGesture)return false;if(Date.now()<recoveryCooldownUntil||busy||endGuardBusy||djOwnsTransport())return false;const t=truth()?.get?.();if(!t?.expectedLive)return false;const reloadPending=!!reloadIntent;if(!reloadPending&&truth()?.shouldRecover&&!truth().shouldRecover())return !!t.isPlaying;try{const{state:s}=reloadPending?await restoreReloadPlayback():await ensureActive({preserve:true});if(djOwnsTransport())return false;if(s?.is_playing){ingest(s,reloadPending?'primary-reload-restored':'primary-recovery-already');recoveryFailures=0;recoveryCooldownUntil=0;return true}if(djOwnsTransport())return false;const ok=await resume();if(ok){recoveryFailures=0;recoveryCooldownUntil=0;recoveries++;info('Spotify-verbinding hersteld.')}return ok}catch(e){if(e?.code==='RELOAD_GESTURE')return false;recoveryFailures++;if(recoveryFailures>=3){recoveryCooldownUntil=Date.now()+30000;recoveryFailures=0;info('Spotify-herstel wacht 30 seconden na meerdere fouten.',true)}return rememberError(e,'Playback-herstel mislukt: ')}}

  function actionFor(id){return id==='start'?start:id==='play'?playPause:id==='next'?()=>skip(1):id==='prev'?()=>skip(-1):null}
  function controlsOwned(){return['start','play','next','prev'].every(id=>$(id)?.dataset?.jfmOwner==='primary')}
  function bind(){if(bound&&controlsOwned())return true;if(!player()||!deviceId())return false;if(controlsOwned()){bound=true;setBusy(false);return true}bound=true;const own=(id,fn)=>{const old=$(id);if(!old)return;const b=old.cloneNode(true);old.replaceWith(b);b.disabled=false;b.dataset.jfmOwner='primary';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();activateNow();Promise.resolve(fn()).catch(()=>{})},true)};own('start',start);own('play',playPause);own('next',()=>skip(1));own('prev',()=>skip(-1));info('Josh FM-player klaar.');return true}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#start,#play,#next,#prev,#djNow');if(!b)return;activateNow();if(transportIds.has(b.id)&&!bound){e.preventDefault();e.stopImmediatePropagation();const fn=actionFor(b.id);if(bind()&&fn)Promise.resolve(fn()).catch(()=>{});else info('Josh FM-player wordt nog voorbereid. Tik over een moment opnieuw.',true)}},true);
  window.addEventListener('jfm:natural-track-end',e=>handleNaturalEnd(e.detail||{}).catch(()=>{}));

  let tries=0;const boot=()=>{if(bind())return;if(++tries<100)setTimeout(boot,120)};boot();
  window.addEventListener('pageshow',()=>setTimeout(()=>{bound=controlsOwned();tries=0;boot();recover('pageshow')},450));window.addEventListener('online',()=>setTimeout(()=>recover('online'),450));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>recover('visible'),450)});setInterval(()=>recover('watchdog'),12000);

  window.JFMPlayback={primary:true,version:'primary-v15-reload-gesture-safe',start,next:()=>skip(1),previous:()=>skip(-1),playPause,pause,resume,djPause,djResume,djRewind,playUri,recover,handleNaturalEnd,ensureDevice:freshDevice,stationContext,get state(){return truth()?.get?.()||null},get health(){return{installed:!!window.__jfmPlaybackPrimaryInstalled,failures,recoveries,deviceHandovers,reloadRestores,reloadNeedsGesture,lastError,busy,endGuardBusy,djBusy:djOwnsTransport(),backgrounded:backgrounded(),deviceId:deviceId(),bound,startPending,recoveryFailures,recoveryCooldownMs:Math.max(0,recoveryCooldownUntil-Date.now())}}};
  window.JFMPlaybackPrimary='playback-primary';window.jfmPlayUri=playUri;window.jfmWebResume=resume;window.jfmWebPause=pause;window.jfmWebNext=()=>skip(1);window.jfmWebPrevious=()=>skip(-1);
  window.MAIRRuntime?.register?.('playback-primary',{version:'primary-v15-reload-gesture-safe',owner:'transport'});
})();
