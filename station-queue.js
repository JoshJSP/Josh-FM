// Josh FM station queue continuity — keeps the authored radioset ahead of Spotify playback.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const BATCH_SIZE=10,INITIAL_LOADED=30,LOW_WATER=8,ROTATION_TRIGGER=12,ROTATION_ADD=30,ROLL_KEEP_BEHIND=8,ROLL_AT_INDEX=24;
  let busy=false,building=false,lastTrackId='',lastRun=0,appended=new Set(),lastError='',generation=0,loadedThrough=INITIAL_LOADED;
  const log=[];

  function trace(stage,extra={}){
    const item={at:Date.now(),stage,...extra};log.unshift(item);if(log.length>80)log.length=80;
    window.JFMStationQueueLog=log;
  }
  function status(text,bad=false){
    const e=document.getElementById('queueInfo');if(!e)return;e.textContent=text;if(bad)e.style.color='#ffb4b4';else if(e.style.color)e.style.color='';
  }
  function stationQueue(){try{return Array.isArray(queue)?queue.filter(t=>t?.id&&t?.uri):[]}catch{return[]}}
  function currentId(){try{return playback?.item?.id||''}catch{return''}}
  function currentIndex(q,id){return id?q.findIndex(t=>t.id===id):-1}
  function managed(q,id){return q.length>0&&currentIndex(q,id)>=0}
  function signature(q){return q.length?q.slice(0,3).map(t=>t.id).join('.') :''}

  function restore(q){
    const sig=signature(q);if(!sig)return;
    try{const x=JSON.parse(sessionStorage.getItem('jfm_station_queue_v3')||'{}');if(x.signature===sig){if(Array.isArray(x.appended))appended=new Set(x.appended);generation=Number(x.generation||0);loadedThrough=Math.max(1,Number(x.loadedThrough||Math.min(INITIAL_LOADED,q.length)))}}catch{}
  }
  function persist(q){
    try{sessionStorage.setItem('jfm_station_queue_v3',JSON.stringify({signature:signature(q),appended:[...appended],generation,loadedThrough,at:Date.now()}))}catch{}
  }
  async function remoteQueueUris(){
    try{const d=await api('/me/player/queue');return new Set((d?.queue||[]).map(x=>x?.uri).filter(Boolean))}catch(e){trace('remote-queue-unavailable',{message:String(e?.message||e)});return new Set()}
  }
  function desiredWindow(q,index){
    if(index<0)return[];
    loadedThrough=Math.max(Math.min(q.length,loadedThrough),Math.min(INITIAL_LOADED,q.length));
    if(loadedThrough-index>LOW_WATER)return[];
    return q.slice(loadedThrough,Math.min(q.length,loadedThrough+BATCH_SIZE));
  }
  async function appendTracks(q,tracks){
    if(!tracks.length)return 0;
    const remote=await remoteQueueUris();let added=0;
    for(const track of tracks){
      const pos=q.findIndex(t=>t.id===track.id);
      if(appended.has(track.id)||remote.has(track.uri)){appended.add(track.id);if(pos>=0)loadedThrough=Math.max(loadedThrough,pos+1);continue}
      try{
        const device=window.JFMSpotify?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'';
        const path='/me/player/queue?uri='+encodeURIComponent(track.uri)+(device?'&device_id='+encodeURIComponent(device):'');
        await api(path,{method:'POST'});appended.add(track.id);remote.add(track.uri);if(pos>=0)loadedThrough=Math.max(loadedThrough,pos+1);added++;trace('track-appended',{id:track.id,name:track.name,loadedThrough});await wait(90);
      }catch(e){lastError=String(e?.message||e);trace('append-error',{id:track.id,message:lastError});break}
    }
    persist(q);return added
  }
  function recentHistoryIds(){
    const ids=new Set();try{const s=window.JFMRadioSuite?.state?.();for(const id of (s?.lastIds||[]).slice(0,20))ids.add(id)}catch{}return ids
  }
  function recentlyUsedArtists(q){
    const names=[];for(const t of q.slice(-8)){const a=String(t?.artists?.[0]||'').toLowerCase().trim();if(a)names.push(a)}
    try{const s=window.JFMRadioSuite?.state?.();for(const a of (s?.lastArtists||[]).slice(0,8)){const x=String(a||'').toLowerCase().trim();if(x)names.push(x)}}catch{}
    return new Set(names)
  }
  function rollWindow(q,index){
    if(index<ROLL_AT_INDEX)return{q,index};
    const cut=Math.max(0,index-ROLL_KEEP_BEHIND),next=q.slice(cut),keep=new Set(next.map(t=>t.id));
    queue=next;loadedThrough=Math.max(1,loadedThrough-cut);appended=new Set([...appended].filter(id=>keep.has(id)));
    window.__jfmStationQueueSig=signature(next);persist(next);trace('window-rolled',{cut,kept:next.length,loadedThrough});
    return{q:next,index:index-cut}
  }
  async function prepareNextRotation(reason='low-buffer'){
    if(building||busy||typeof buildSet!=='function')return false;
    let active=stationQueue(),id=currentId(),index=currentIndex(active,id);if(!managed(active,id))return false;
    const remaining=active.length-index-1;if(remaining>ROTATION_TRIGGER)return false;
    ({q:active,index}=rollWindow(active,index));
    building=true;const previousInfo=document.getElementById('queueInfo')?.textContent||'';trace('rotation-build-start',{reason,index,remaining:active.length-index-1,tracks:active.length});
    try{
      const old=[...active],recentIds=recentHistoryIds(),recentArtists=recentlyUsedArtists(old),oldIds=new Set(old.map(t=>t.id));
      await buildSet();
      const generated=stationQueue();queue=old;
      let candidates=generated.filter(t=>t?.id&&t?.uri&&!oldIds.has(t.id)&&!recentIds.has(t.id));
      if(candidates.length<10){const relaxed=generated.filter(t=>t?.id&&t?.uri&&!oldIds.has(t.id)&&!candidates.some(x=>x.id===t.id));candidates=[...candidates,...relaxed]}
      candidates.sort((a,b)=>{const aa=String(a?.artists?.[0]||'').toLowerCase().trim(),ba=String(b?.artists?.[0]||'').toLowerCase().trim();return Number(recentArtists.has(aa))-Number(recentArtists.has(ba))});
      const context=old.slice(-6),director=window.JFMProgramDirector;if(director?.directWithContext)candidates=director.directWithContext(candidates,context);
      const next=candidates.slice(0,ROTATION_ADD);
      if(next.length){queue=[...old,...next];generation++;persist(queue);window.__jfmStationQueueSig=signature(queue);trace('rotation-build-ready',{reason,added:next.length,generation,total:queue.length});try{window.jfmRenderNext?.()}catch{};status(`Josh FM programmeert vooruit · ${next.length} nieuwe tracks klaar.`);setTimeout(()=>maintain('rotation-ready').catch(()=>{}),80);return true}
      trace('rotation-build-empty',{reason,generated:generated.length});if(previousInfo)status(previousInfo);return false
    }catch(e){lastError=String(e?.message||e);trace('rotation-build-error',{reason,message:lastError});queue=active;window.__jfmStationQueueSig=signature(active);if(previousInfo)status(previousInfo,true);return false}
    finally{building=false}
  }
  async function maintain(reason='poll'){
    if(busy||building||Date.now()-lastRun<900)return false;
    const q=stationQueue(),id=currentId();if(!managed(q,id))return false;
    const index=currentIndex(q,id),wanted=desiredWindow(q,index);if(!wanted.length){prepareNextRotation(reason).catch(()=>{});return false}
    busy=true;lastRun=Date.now();trace('maintain-start',{reason,index,wanted:wanted.length,loadedThrough});
    try{
      const added=await appendTracks(q,wanted);
      if(added){status(`Josh FM bewaakt de wachtrij · ${added} volgende track${added===1?'':'s'} toegevoegd.`);trace('maintain-end',{reason,index,added,loadedThrough})}
      return added>0;
    }finally{busy=false;prepareNextRotation(reason).catch(()=>{})}
  }
  function resetForNewSet(){const q=stationQueue();appended=new Set();generation=0;loadedThrough=Math.min(INITIAL_LOADED,q.length);restore(q);trace('set-detected',{tracks:q.length,signature:signature(q),loadedThrough})}

  window.addEventListener('jfm:trackchange',e=>{const id=e?.detail?.trackId||currentId();if(id&&id!==lastTrackId){lastTrackId=id;maintain('trackchange').catch(()=>{});prepareNextRotation('trackchange').catch(()=>{})}});
  setInterval(()=>maintain('watchdog').catch(()=>{}),5000);
  setInterval(()=>prepareNextRotation('rotation-watchdog').catch(()=>{}),9000);
  setInterval(()=>{if(building)return;const q=stationQueue(),sig=signature(q);if(sig&&sig!==window.__jfmStationQueueSig){window.__jfmStationQueueSig=sig;resetForNewSet()}},2000);
  setTimeout(()=>{resetForNewSet();window.__jfmStationQueueSig=signature(stationQueue());maintain('startup').catch(()=>{});prepareNextRotation('startup').catch(()=>{})},1400);

  window.JFMStationQueue={version:'continuity-v3-rolling',maintain,prepareNextRotation,log:()=>[...log],state:()=>{const q=stationQueue(),id=currentId(),index=currentIndex(q,id);return{managed:managed(q,id),trackId:id,index,tracks:q.length,remaining:index>=0?q.length-index-1:null,loadedThrough,appended:[...appended],generation,busy,building,lastError}}};
})();
