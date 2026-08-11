// Josh FM station queue continuity — keeps the authored radioset ahead of Spotify playback.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const BATCH_SIZE=10,INITIAL_LOADED=30,LOW_WATER=8;
  let busy=false,lastTrackId='',lastRun=0,appended=new Set(),lastError='';
  const log=[];

  function trace(stage,extra={}){
    const item={at:Date.now(),stage,...extra};log.unshift(item);if(log.length>60)log.length=60;
    window.JFMStationQueueLog=log;
  }
  function status(text,bad=false){
    const e=document.getElementById('queueInfo');if(!e)return;e.textContent=text;if(bad)e.style.color='#ffb4b4';else if(e.style.color)e.style.color='';
  }
  function stationQueue(){try{return Array.isArray(queue)?queue.filter(t=>t?.id&&t?.uri):[]}catch{return[]}}
  function currentId(){try{return playback?.item?.id||''}catch{return''}}
  function currentIndex(q,id){return id?q.findIndex(t=>t.id===id):-1}
  function managed(q,id){return q.length>0&&currentIndex(q,id)>=0}
  function signature(q){return q.length?`${q.length}:${q.slice(0,3).map(t=>t.id).join('.')}:${q.slice(-2).map(t=>t.id).join('.')}`:''}

  function restore(q){
    const sig=signature(q);if(!sig)return;
    try{const x=JSON.parse(sessionStorage.getItem('jfm_station_queue_v1')||'{}');if(x.signature===sig&&Array.isArray(x.appended))appended=new Set(x.appended)}catch{}
  }
  function persist(q){
    try{sessionStorage.setItem('jfm_station_queue_v1',JSON.stringify({signature:signature(q),appended:[...appended],at:Date.now()}))}catch{}
  }
  async function remoteQueueUris(){
    try{const d=await api('/me/player/queue');return new Set((d?.queue||[]).map(x=>x?.uri).filter(Boolean))}catch(e){trace('remote-queue-unavailable',{message:String(e?.message||e)});return new Set()}
  }
  function desiredWindow(q,index){
    if(index<0||q.length<=INITIAL_LOADED)return[];
    const loadedEstimate=Math.max(INITIAL_LOADED,...[...appended].map(id=>q.findIndex(t=>t.id===id)+1).filter(n=>n>0));
    if(loadedEstimate-index>LOW_WATER)return[];
    return q.slice(loadedEstimate,Math.min(q.length,loadedEstimate+BATCH_SIZE));
  }
  async function appendTracks(q,tracks){
    if(!tracks.length)return 0;
    const remote=await remoteQueueUris();let added=0;
    for(const track of tracks){
      if(appended.has(track.id)||remote.has(track.uri)){appended.add(track.id);continue}
      try{
        const device=window.JFMSpotify?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'';
        const path='/me/player/queue?uri='+encodeURIComponent(track.uri)+(device?'&device_id='+encodeURIComponent(device):'');
        await api(path,{method:'POST'});appended.add(track.id);remote.add(track.uri);added++;trace('track-appended',{id:track.id,name:track.name});await wait(90);
      }catch(e){lastError=String(e?.message||e);trace('append-error',{id:track.id,message:lastError});break}
    }
    persist(q);return added
  }
  async function maintain(reason='poll'){
    if(busy||Date.now()-lastRun<900)return false;
    const q=stationQueue(),id=currentId();if(!managed(q,id))return false;
    const index=currentIndex(q,id),wanted=desiredWindow(q,index);if(!wanted.length)return false;
    busy=true;lastRun=Date.now();trace('maintain-start',{reason,index,wanted:wanted.length});
    try{
      const added=await appendTracks(q,wanted);
      if(added){status(`Josh FM bewaakt de wachtrij · ${added} volgende track${added===1?'':'s'} toegevoegd.`);trace('maintain-end',{reason,index,added})}
      return added>0;
    }finally{busy=false}
  }
  function resetForNewSet(){const q=stationQueue();appended=new Set();restore(q);trace('set-detected',{tracks:q.length,signature:signature(q)})}

  window.addEventListener('jfm:trackchange',e=>{const id=e?.detail?.trackId||currentId();if(id&&id!==lastTrackId){lastTrackId=id;maintain('trackchange').catch(()=>{})}});
  setInterval(()=>maintain('watchdog').catch(()=>{}),5000);
  setInterval(()=>{const q=stationQueue(),sig=signature(q);if(sig&&sig!==window.__jfmStationQueueSig){window.__jfmStationQueueSig=sig;resetForNewSet()}},2000);
  setTimeout(()=>{resetForNewSet();maintain('startup').catch(()=>{})},1400);

  window.JFMStationQueue={version:'continuity-v1',maintain,log:()=>[...log],state:()=>{const q=stationQueue(),id=currentId(),index=currentIndex(q,id);return{managed:managed(q,id),trackId:id,index,tracks:q.length,appended:[...appended],busy,lastError}}};
})();
