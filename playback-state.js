// Josh FM playback truth — one state/operation layer shared by playback, recovery and UI.
(()=>{
  const KEY='jfm_playback_truth_v1';
  const listeners=new Set();
  const now=()=>Date.now();
  const empty=()=>({
    revision:0,updatedAt:0,source:'boot',trackId:'',uri:'',progressMs:0,durationMs:0,
    isPlaying:false,deviceId:'',deviceName:'',expectedLive:false,intent:'idle',
    operation:null,lastGoodAt:0,lastError:'',lastTransitionAt:0
  });
  let state={...empty(),...load()};
  let operationSeq=0;

  function load(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch{return{}}}
  function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(state))}catch{}}
  function emit(reason='update'){
    const snapshot=get();
    for(const fn of listeners){try{fn(snapshot,reason)}catch{}}
    try{window.dispatchEvent(new CustomEvent('jfm:playback-state',{detail:{state:snapshot,reason}}))}catch{}
  }
  function get(){return{...state,operation:state.operation?{...state.operation}:null}}
  function normalize(remote={}){
    const item=remote?.item||remote?.track_window?.current_track||null;
    const paused=remote?.paused;
    const playing=typeof remote?.is_playing==='boolean'?remote.is_playing:(typeof paused==='boolean'?!paused:state.isPlaying);
    const progress=remote?.progress_ms ?? remote?.position ?? state.progressMs;
    return{
      trackId:item?.id||state.trackId||'',
      uri:item?.uri||state.uri||'',
      progressMs:Number.isFinite(Number(progress))?Math.max(0,Number(progress)):state.progressMs,
      durationMs:Number(item?.duration_ms||state.durationMs||0),
      isPlaying:!!playing,
      deviceId:remote?.device?.id||state.deviceId||'',
      deviceName:remote?.device?.name||state.deviceName||''
    }
  }
  function ingest(remote,source='spotify'){
    if(!remote)return get();
    const next=normalize(remote);
    const changedTrack=!!next.trackId&&next.trackId!==state.trackId;
    state={...state,...next,source,updatedAt:now(),revision:state.revision+1,lastError:''};
    if(next.isPlaying)state.lastGoodAt=now();
    if(changedTrack)state.lastTransitionAt=now();
    // A verified track change completes next/previous/explicit play operations.
    if(state.operation&&['next','previous','play-track','start'].includes(state.operation.type)){
      const expected=state.operation.expectedTrackId||'';
      if((expected&&next.trackId===expected)||(!expected&&changedTrack))state.operation=null;
    }
    try{playback=remote}catch{}
    persist();emit(changedTrack?'track-change':'state');
    if(changedTrack)try{window.dispatchEvent(new CustomEvent('jfm:trackchange',{detail:{trackId:next.trackId,source}}))}catch{}
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
    version:'truth-v1',get,ingest,patch,setExpectedLive,begin,end,activeOperation,blocksRecovery,shouldRecover,error,subscribe,reset
  };
})();
