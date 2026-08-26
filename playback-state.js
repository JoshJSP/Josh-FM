// Josh FM playback truth — one state/operation layer shared by playback, recovery and UI.
(()=>{
  if(window.JFMPlaybackState?.version)return;
  const KEY='jfm_playback_truth_v1';
  const listeners=new Set();
  const now=()=>Date.now();
  const empty=()=>({
    revision:0,sequence:0,updatedAt:0,source:'boot',trackId:'',uri:'',progressMs:0,durationMs:0,
    isPlaying:false,deviceId:'',deviceName:'',expectedLive:false,intent:'idle',
    operation:null,lastGoodAt:0,lastError:'',lastTransitionAt:0
  });
  // A page reload always disconnects the browser player. Preserve intent and
  // metadata for recovery/UX, but never trust a persisted playing operation.
  let state={...empty(),...load(),isPlaying:false,operation:null};
  let operationSeq=0;

  function load(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch{return{}}}
  function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(state))}catch{}}
  function emit(reason='update',previous=null){
    const snapshot=get();
    for(const fn of listeners){try{fn(snapshot,reason)}catch{}}
    try{window.dispatchEvent(new CustomEvent('jfm:playback-state',{detail:{state:snapshot,previous:previous?{...previous}:null,reason,sequence:snapshot.sequence}}))}catch{}
  }
  function get(){return{...state,operation:state.operation?{...state.operation}:null}}
  function normalize(remote={}){
    const hasApiItem=Object.prototype.hasOwnProperty.call(remote,'item');
    const hasSdkWindow=Object.prototype.hasOwnProperty.call(remote,'track_window');
    const item=remote?.item||remote?.track_window?.current_track||null;
    const explicitlyEmpty=(hasApiItem&&remote.item==null)||(hasSdkWindow&&!remote?.track_window?.current_track);
    const paused=remote?.paused;
    const playing=typeof remote?.is_playing==='boolean'?remote.is_playing:(typeof paused==='boolean'?!paused:(explicitlyEmpty?false:state.isPlaying));
    const progress=remote?.progress_ms ?? remote?.position ?? (explicitlyEmpty?0:state.progressMs);
    return{
      trackId:item?.id||(explicitlyEmpty?'':state.trackId||''),
      uri:item?.uri||(explicitlyEmpty?'':state.uri||''),
      progressMs:Number.isFinite(Number(progress))?Math.max(0,Number(progress)):(explicitlyEmpty?0:state.progressMs),
      durationMs:item?Number(item?.duration_ms||0):(explicitlyEmpty?0:state.durationMs),
      isPlaying:!!playing,
      deviceId:remote?.device?.id||state.deviceId||'',
      deviceName:remote?.device?.name||state.deviceName||''
    }
  }
  function ingest(remote,source='spotify'){
    if(!remote)return get();
    const previous=get();
    const previousTrack=state.trackId;
    const next=normalize(remote);
    const changedTrack=next.trackId!==previousTrack&&(!!next.trackId||!!previousTrack);
    state={...state,...next,source,updatedAt:now(),revision:state.revision+1,sequence:Number(state.sequence||0)+1,lastError:''};
    if(next.isPlaying)state.lastGoodAt=now();
    if(changedTrack)state.lastTransitionAt=now();
    if(state.operation&&['next','previous','play-track','start'].includes(state.operation.type)){
      const expected=state.operation.expectedTrackId||'';
      if((expected&&next.trackId===expected)||(!expected&&changedTrack))state.operation=null;
    }
    try{playback=remote}catch{}
    persist();emit(changedTrack?'track-change':'state',previous);
    if(changedTrack)try{window.dispatchEvent(new CustomEvent('jfm:trackchange',{detail:{trackId:next.trackId,previousTrackId:previousTrack,source,sequence:state.sequence}}))}catch{}
    return get()
  }
  function patch(values={},reason='patch'){
    state={...state,...values,updatedAt:now(),revision:state.revision+1};persist();emit(reason);return get()
  }
  function setExpectedLive(on,intent=on?'play':'pause'){
    return patch({expectedLive:!!on,intent:String(intent||'idle')},'intent');
  }
  function begin(type,{expectedTrackId='',expectedUri='',timeoutMs=6500}={}){
    const id=++operationSeq,startedAt=now();
    state.operation={id,type,expectedTrackId,expectedUri,startedAt,expiresAt:startedAt+timeoutMs};
    state.intent=type;state.updatedAt=startedAt;state.revision++;
    persist();emit('operation-begin');return id
  }
  function end(id,{error=''}={}){
    if(state.operation&&(!id||state.operation.id===id))state.operation=null;
    if(error)state.lastError=String(error).slice(0,240);
    state.updatedAt=now();state.revision++;persist();emit(error?'operation-error':'operation-end');return get()
  }
  function activeOperation(){
    if(state.operation&&state.operation.expiresAt<=now()){state.operation=null;persist()}
    return state.operation?{...state.operation}:null
  }
  function blocksRecovery(){
    const op=activeOperation();
    return !!op&&['start','next','previous','play-track','pause','resume','device-transfer','dj-handoff'].includes(op.type)
  }
  function shouldRecover(){
    activeOperation();
    return !!state.expectedLive&&!state.isPlaying&&!blocksRecovery()
  }
  function error(message){return patch({lastError:String(message||'').slice(0,240)},'error')}
  function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn)}
  function reset(){state=empty();persist();emit('reset')}

  window.JFMPlaybackState={
    version:'truth-v3-sequenced',get,ingest,patch,setExpectedLive,begin,end,activeOperation,blocksRecovery,shouldRecover,error,subscribe,reset
  };
  window.MAIRRuntime?.register?.('playback-state',{version:'truth-v3-sequenced',owner:'playback-truth'});
})();
