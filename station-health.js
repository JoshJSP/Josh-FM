// Josh FM Station Health — central diagnostics, music-first safe mode and non-destructive self test.
(()=>{
  const $=id=>document.getElementById(id),LOG_MAX=80;
  const log=[];let safe=false,safeReasons=[],lastSnapshot=null,lastTest=null,lastRenderSig='',safeSavedFlags=null;
  const now=()=>Date.now();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  function trace(stage,detail={}){log.unshift({at:now(),stage,...detail});if(log.length>LOG_MAX)log.length=LOG_MAX}
  function playbackState(){try{return window.JFMPlaybackState?.get?.()||null}catch{return null}}
  function queueState(){try{return window.JFMStationQueue?.state?.()||null}catch{return null}}
  function fishState(){try{return window.JFMDJAudioGuard?.state||null}catch{return null}}
  function requestState(){try{return window.JFMRequests?.list?.()||[]}catch{return[]}}
  function clockState(){try{return window.JFMStationClock?.current?.()||null}catch{return null}}
  function runtimeState(){try{return window.JFMRuntimeModes?.state?.()||null}catch{return null}}
  function currentReasons(){
    const reasons=[],q=queueState(),fish=fishState(),p=playbackState();
    if(!navigator.onLine)reasons.push('Geen netwerk');
    if(fish&&!fish.available)reasons.push('Fish Audio tijdelijk in backoff');
    if(q?.lastError&&q.remaining!==null&&q.remaining<4)reasons.push('Queue-aanvulling heeft een fout');
    if(p?.expectedLive&&!p?.isPlaying&&window.JFMPlayback?.health?.failures>=2)reasons.push('Playback-herstel heeft meerdere fouten');
    return reasons
  }
  function applySafeMode(reasons=currentReasons()){
    const next=reasons.length>0,changed=next!==safe||reasons.join('|')!==safeReasons.join('|');
    if(next&&!safe){safeSavedFlags={skipNextTalk:!!window.skipNextTalk,musicRun:!!window.jfmMusicRun}}
    if(!next&&safe&&safeSavedFlags){try{window.skipNextTalk=!!safeSavedFlags.skipNextTalk}catch{};try{window.jfmMusicRun=!!safeSavedFlags.musicRun}catch{};safeSavedFlags=null}
    safe=next;safeReasons=[...reasons];document.body.classList.toggle('jfm-safe-mode',safe);document.body.dataset.safeMode=safe?'1':'0';
    if(safe){try{window.skipNextTalk=true}catch{};try{window.jfmMusicRun=true}catch{}}
    if(changed){trace(safe?'safe-enter':'safe-exit',{reasons:[...safeReasons]});try{window.dispatchEvent(new CustomEvent('jfm:safe-mode',{detail:{active:safe,reasons:[...safeReasons]}}))}catch{};render()}
    return safe
  }
  function snapshot(){
    const p=playbackState(),q=queueState(),f=fishState(),clock=clockState(),runtime=runtimeState(),requests=requestState();
    lastSnapshot={at:now(),online:navigator.onLine,safeMode:safe,safeReasons:[...safeReasons],playback:p?{trackId:p.trackId||'',isPlaying:!!p.isPlaying,expectedLive:!!p.expectedLive,operation:p.operation||null}:null,playbackHealth:window.JFMPlayback?.health||null,queue:q,fish:f,show:clock?.show?{id:clock.show.id,name:clock.show.name}:null,clockPhase:clock?.phase||'',requests:requests.length,runtime,serviceWorker:{supported:'serviceWorker'in navigator,controlled:!!navigator.serviceWorker?.controller},mediaSession:'mediaSession'in navigator};return lastSnapshot
  }
  function testRow(x){const icon=x.level==='PASS'?'✓':x.level==='WARN'?'⚠':'✕';return `<div class="jfm-health-row" data-level="${x.level}"><span>${esc(x.label)}</span><span><b>${icon} ${x.level}</b>${x.detail?`<small>${esc(x.detail)}</small>`:''}</span></div>`}
  async function runSelfTest(){
    const out=$('selfTestResults'),btn=$('selfTest');if(btn){btn.disabled=true;btn.textContent='Test bezig…'}if(out)out.innerHTML='<p class="muted">Niet-destructieve controle bezig…</p>';
    const results=[],add=(lvl,label,detail='')=>results.push({level:lvl,label,detail});
    add(navigator.onLine?'PASS':'FAIL','Internet',navigator.onLine?'Browser is online':'Spotify en Fish hebben internet nodig');
    try{const t=await ensure();add(t?'PASS':'FAIL','Spotify-auth',t?'Token beschikbaar':'Opnieuw koppelen nodig')}catch(e){add('FAIL','Spotify-auth',String(e?.message||e))}
    try{const d=await api('/me/player/devices');const usable=(d?.devices||[]).filter(x=>!x.is_restricted);add(usable.length?'PASS':'WARN','Spotify-device',usable.length?`${usable.length} bruikbaar apparaat${usable.length===1?'':'en'}`:'Open Spotify kort om een device actief te maken')}catch(e){add('WARN','Spotify-device',String(e?.message||e))}
    try{const s=await api('/me/player');add(s?.device?.id?'PASS':'WARN','Spotify playback',s?.item?`${s.is_playing?'Speelt':'Gepauzeerd'} · ${s.item.name}`:'Geen actieve track')}catch(e){add('WARN','Spotify playback',String(e?.message||e))}
    add(window.JFMPlaybackState?'PASS':'FAIL','Playback truth',window.JFMPlaybackState?.version||'Niet geladen');
    const ph=window.JFMPlayback?.health;add(window.JFMPlayback?'PASS':'FAIL','Playback controller',ph?.lastError?`Laatste fout: ${ph.lastError}`:(window.JFMPlayback?.version||'Niet geladen'));
    const q=queueState();add(window.JFMStationQueue?(q?.lastError?'WARN':'PASS'):'FAIL','Station queue',q?`${q.remaining??'—'} tracks resterend · generatie ${q.generation??0}${q.lastError?' · '+q.lastError:''}`:'Niet geladen');
    add(window.JFMProgramDirector?'PASS':'FAIL','Program Director',window.JFMProgramDirector?.version||'Niet geladen');
    add(window.JFMRotation?'PASS':'FAIL','Rotation engine',window.JFMRotation?.version||'Niet geladen');
    add(window.JFMStationClock?'PASS':'FAIL','Station clock',clockState()?.show?.name||'Niet geladen');
    add(window.JFMRequests?'PASS':'WARN','Request manager',window.JFMRequests?.version||'Nog niet geladen');
    add(window.JFMDJContext?'PASS':'WARN','DJ-context',window.JFMDJContext?.version||'Niet geladen');
    const f=fishState();add(window.JFMDJAudioGuard?(f?.available?'PASS':'WARN'):'FAIL','Fish Audio guard',f?(f.available?'Beschikbaar':`Backoff · retry over ${Math.ceil((f.retryInMs||0)/1000)} sec${f.lastError?' · '+f.lastError:''}`):'Niet geladen');
    add(typeof window.makeDJScript==='function'?'PASS':'FAIL','DJ script engine',window.JFMRadioClock?.version||'Scriptfunctie niet geladen');
    try{const r=await fetch('/api/config',{cache:'no-store'});add(r.ok?'PASS':'WARN','Backend/config',r.ok?'Endpoint bereikbaar':`HTTP ${r.status}`)}catch{add('WARN','Backend/config','Niet bereikbaar')}
    try{const r=await fetch('/api/tts',{method:'GET',cache:'no-store'});add(r.ok||[400,405,422].includes(r.status)?'PASS':'WARN','Fish/TTS route',`HTTP ${r.status}`)}catch{add('WARN','Fish/TTS route','Niet bereikbaar')}
    add('serviceWorker'in navigator?(navigator.serviceWorker.controller?'PASS':'WARN'):'WARN','PWA/service worker','serviceWorker'in navigator?(navigator.serviceWorker.controller?'Actief':'Ondersteund, nog niet controlerend'):'Niet ondersteund');
    add('mediaSession'in navigator?'PASS':'WARN','Media Session','mediaSession'in navigator?'Ondersteund':'Browser ondersteunt dit niet');
    add(window.JFMPWA?'PASS':'WARN','PWA platform',window.JFMPWA?.version||'Niet geladen');
    add(window.JFMRuntimeModes?'PASS':'WARN','Runtime modes',window.JFMRuntimeModes?.version||'Niet geladen');
    add(window.JFMTop40?'PASS':'WARN','Personal Top 40',window.JFMTop40?.version||'Niet geladen');
    const contract=window.JFMIntegrationGuards?.sanity?.();add(contract?.missing?.length?'WARN':'PASS','Controller-contracten',contract?.missing?.length?`Ontbreekt: ${contract.missing.join(', ')}`:'Alle kerncontrollers aanwezig');
    const reasons=currentReasons();add(reasons.length?'WARN':'PASS','Safe Mode',reasons.length?reasons.join(' · '):'Geen degradatie actief');
    const rank={FAIL:0,WARN:1,PASS:2};results.sort((a,b)=>rank[a.level]-rank[b.level]);lastTest={at:now(),results};trace('self-test',{pass:results.filter(x=>x.level==='PASS').length,warn:results.filter(x=>x.level==='WARN').length,fail:results.filter(x=>x.level==='FAIL').length});
    if(out)out.innerHTML=results.map(testRow).join('');if(btn){btn.disabled=false;btn.textContent='Test Josh FM opnieuw'}render();return lastTest
  }
  function installSelfTestOwner(){const old=$('selfTest');if(!old)return false;const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',()=>runSelfTest().catch(e=>{trace('self-test-error',{error:String(e?.message||e)});b.disabled=false;b.textContent='Test Josh FM opnieuw'}));window.JFMSelfTest={version:'selftest-v3-contracts',run:runSelfTest};return true}
  function ensureHealthSummary(){let box=$('jfmHealthSummary');if(box)return box;const out=$('selfTestResults');if(!out)return null;box=document.createElement('div');box.id='jfmHealthSummary';box.className='jfm-health-summary';out.insertAdjacentElement('beforebegin',box);return box}
  function render(){const box=ensureHealthSummary();if(!box)return;const s=snapshot(),sig=JSON.stringify({safe:s.safeMode,reasons:s.safeReasons,playing:s.playback?.isPlaying,queue:s.queue?.remaining,fish:s.fish?.available,show:s.show?.id,online:s.online});if(sig===lastRenderSig)return;lastRenderSig=sig;const queueText=s.queue?`${s.queue.remaining??'—'} vooruit`:'—',fishText=s.fish?(s.fish.available?'OK':'BACKOFF'):'—',playText=s.playback?(s.playback.isPlaying?'SPEELT':s.playback.expectedLive?'HERSTEL':'PAUZE'):'—';box.innerHTML=`<div class="jfm-health-head"><b>${safe?'SAFE MODE':'STATION OK'}</b><span>${safe?esc(safeReasons.join(' · ')):'Muziek, queue en DJ worden bewaakt.'}</span></div><div class="jfm-health-grid"><span>Playback <b>${esc(playText)}</b></span><span>Queue <b>${esc(queueText)}</b></span><span>Fish <b>${esc(fishText)}</b></span><span>Show <b>${esc(s.show?.name||'—')}</b></span></div>`}
  function poll(){applySafeMode();render()}
  ['online','offline','jfm:dj-audio-health','jfm:trackchange','jfm:playback-state','jfm:show-change','jfm:requests-change'].forEach(e=>window.addEventListener(e,poll));
  function install(){let tries=0;const own=()=>{if(installSelfTestOwner()){poll();return}if(++tries<20)setTimeout(own,250)};own();setInterval(poll,7000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JFMStationHealth={version:'health-v2-safe-restore',snapshot,runSelfTest,applySafeMode,get safeMode(){return safe},get reasons(){return[...safeReasons]},get lastTest(){return lastTest},log:()=>[...log]};
})();
