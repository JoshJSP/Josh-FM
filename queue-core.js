// MAIR Queue Core — one authored queue, serialized builds and exact Spotify request insertion.
(()=>{
  'use strict';
  if(window.__jfmQueueCoreInstalled)return;window.__jfmQueueCoreInstalled=true;
  const TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/,MAX_CONTEXT=30;
  let revision=0,source='boot',station='',lastReason='',lastError='',buildTail=Promise.resolve(),transportTail=Promise.resolve(),building=0,transporting=0;
  const events=[];
  const trace=(stage,detail={})=>{events.unshift({at:Date.now(),stage,...detail});if(events.length>120)events.length=120};
  const artist=t=>String(t?.artists?.[0]?.name||t?.artists?.[0]||'').toLowerCase().trim();
  const key=t=>String(t?.uri||t?.id||'');
  function valid(t){return!!t?.id&&TRACK_URI.test(String(t?.uri||''))}
  function normalize(list,context=[]){
    const seen=new Set(),pool=[];
    for(const track of Array.isArray(list)?list:[]){const k=key(track);if(!valid(track)||seen.has(k))continue;seen.add(k);pool.push(track)}
    const out=[],prefix=(Array.isArray(context)?context:[]).filter(valid).slice(-2);
    while(pool.length){const recent=[...prefix,...out].slice(-2).map(artist).filter(Boolean);let index=pool.findIndex(t=>{const a=artist(t);return!a||!recent.includes(a)});if(index<0)index=0;out.push(pool.splice(index,1)[0])}
    return out
  }
  function current(){try{return normalize(Array.isArray(queue)?queue:[])}catch{return[]}}
  function emit(reason){try{window.dispatchEvent(new CustomEvent('jfm:queue-change',{detail:{revision,reason,station,tracks:current().length}}))}catch{}}
  function commit(list,meta={}){
    const next=normalize(list);if(!next.length)throw Error('De radioset bevat geen geldige Spotify-tracks.');
    queue=next;revision++;source=String(meta.source||source||'unknown');station=String(meta.station||localStorage.getItem('jfm_music_channel_v1')||'mix');lastReason=String(meta.reason||'commit');lastError='';
    try{window.__jfmStationQueueSig=''}catch{};trace('commit',{revision,source,station,reason:lastReason,tracks:next.length});emit(lastReason);return next
  }
  function serialize(kind,work){
    const isTransport=kind==='transport',previous=isTransport?transportTail:buildTail;
    const run=previous.catch(()=>{}).then(async()=>{if(isTransport)transporting++;else building++;try{return await work()}finally{if(isTransport)transporting--;else building--}});
    if(isTransport)transportTail=run;else buildTail=run;
    return run.catch(e=>{lastError=String(e?.message||e);trace(kind+'-error',{error:lastError});throw e})
  }
  function build(reason,work){return serialize('build',async()=>{trace('build-start',{reason});const value=await work();trace('build-end',{reason,tracks:Array.isArray(value)?value.length:Number(value?.tracks?.length||0)});return value})}
  async function buildActive(reason='rotation'){
    return build(reason,async()=>{
      const id=localStorage.getItem('jfm_music_channel_v1')||'mix';
      if(id==='mix'){
        if(window.MAIRPersonalSourceSync?.buildPersonal)return window.MAIRPersonalSourceSync.buildPersonal({commit:false,announce:false,activate:false});
        if(typeof window.buildSet==='function'){const before=current();const made=await window.buildSet();const result=normalize(Array.isArray(made)?made:current());queue=before;return result}
        throw Error('Persoonlijke muziekbron is nog niet beschikbaar.');
      }
      const built=await window.MAIRStationController?.buildPool?.(id);if(!built?.tracks?.length)throw Error('Het actieve station leverde geen nieuwe tracks.');return normalize(built.tracks)
    })
  }
  function authoredAfter(uri){const q=current(),i=q.findIndex(t=>t.uri===uri);return i>=0?q.slice(i+1):q}
  function deviceId(state){return String(state?.device?.id||window.JFMPlaybackState?.get?.()?.deviceId||window.JFMPlayback?.storedDevice?.()||localStorage.getItem('jfm_spotify_device_id')||'')}
  async function programNext(track,reason='request'){
    if(!valid(track))throw Error('Ongeldige request-track.');
    return serialize('transport',async()=>{
      const state=await api('/me/player');if(!state?.item?.uri)throw Error('Spotify heeft geen actieve track.');if(!state.is_playing)throw Error('Spotify staat gepauzeerd; request wordt ingepland zodra MAIR speelt.');
      const id=deviceId(state);if(!id)throw Error('Geen actief Spotify-device.');
      const currentUri=String(state.item.uri),rest=authoredAfter(currentUri).filter(t=>t.uri!==track.uri),uris=[currentUri,track.uri,...rest.map(t=>t.uri)].filter((uri,i,a)=>TRACK_URI.test(uri)&&a.indexOf(uri)===i).slice(0,MAX_CONTEXT);
      if(uris.length<2)throw Error('Geen veilige Spotify-context voor het request.');
      const position=Math.max(0,Number(state.progress_ms||0));
      await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:position}});
      const remote=await api('/me/player/queue'),next=(remote?.queue||[]).find(t=>t?.uri!==currentUri);
      if(next?.uri!==track.uri)throw Error('Spotify bevestigde het request niet als eerstvolgende track.');
      trace('program-next',{reason,uri:track.uri,currentUri,position,context:uris.length});
      try{window.JFMSpotifyUpcomingTruth?.sync?.(true)}catch{};return true
    })
  }
  function state(){return{version:'queue-core-v1',revision,source,station,lastReason,lastError,tracks:current().length,building:building>0,transporting:transporting>0,events:events.length}}
  window.JFMQueue={version:'queue-core-v1-single-truth',valid,normalize,current,commit,build,buildActive,programNext,authoredAfter,state,log:()=>[...events]};
  try{if(Array.isArray(queue)&&queue.length)commit(queue,{source:'bootstrap',station:localStorage.getItem('jfm_music_channel_v1')||'mix',reason:'core-bootstrap'})}catch(e){lastError=String(e?.message||e);trace('bootstrap-error',{error:lastError})}
})();
