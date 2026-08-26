// MAIR reliability runtime — idempotency registry and bounded production timeline.
(()=>{
  'use strict';
  if(window.MAIRRuntime?.version)return;
  const MAX_EVENTS=750,modules=new Map(),events=[],counters=new Map();
  const MODULE_KEYS={
    'spotify-sdk-core':'spotifySdk','playback-state':'playbackState','playback-primary':'playbackController',
    'transition-controller':'transitionController','queue-core':'queue','request-manager':'requestTransport',
    'mair-dj-v2':'djEngine','mair-voice-engine':'voiceEngine','mair-observability':'diagnostics'
  };
  const sessionId=(()=>{try{const key='mair_runtime_session_v1',old=sessionStorage.getItem(key);if(old)return old;const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;sessionStorage.setItem(key,id);return id}catch{return`volatile-${Date.now().toString(36)}`}})();
  const safe=(value,depth=0)=>{
    if(depth>3)return'[depth-limit]';
    if(value==null||typeof value==='boolean'||typeof value==='number')return value;
    if(typeof value==='string'){const x=value.slice(0,500);return /bearer\s+[a-z0-9._~+\/-]{10,}|(?:token|secret|api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+/i.test(x)?'[redacted]':x}
    if(Array.isArray(value))return value.slice(0,20).map(x=>safe(x,depth+1));
    if(typeof value==='object'){const out={};for(const[k,v]of Object.entries(value).slice(0,30)){if(/token|secret|authorization|cookie|code_verifier/i.test(k))out[k]='[redacted]';else out[k]=safe(v,depth+1)}return out}
    return String(value).slice(0,200)
  };
  function record(type,detail={},level='info'){
    const cleanDetail=safe(detail),eventName=String(type||'event').slice(0,100),correlationId=String(cleanDetail?.breakId||cleanDetail?.correlationId||'').slice(0,140),timestamp=Date.now(),event={id:events.length?events.at(-1).id+1:1,timestamp,at:timestamp,sessionId,transitionId:String(cleanDetail?.transitionId||'').slice(0,140),breakId:String(cleanDetail?.breakId||'').slice(0,140),correlationId,module:String(cleanDetail?.module||eventName.split(/[.]/)[0]||'runtime').slice(0,80),event:eventName,type:eventName,level:['info','warn','error'].includes(level)?level:'info',durationMs:Number.isFinite(cleanDetail?.durationMs)?Math.max(0,Number(cleanDetail.durationMs)):undefined,details:cleanDetail,detail:cleanDetail};
    events.push(event);if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
    counters.set(event.type,(counters.get(event.type)||0)+1);
    try{window.dispatchEvent(new CustomEvent('mair:timeline',{detail:event}))}catch{}
    return event
  }
  function trace(correlationId,stage,detail={},level='info'){return record(`trace.${String(stage||'step').toLowerCase().replace(/[^a-z0-9.-]+/g,'-')}`,{...safe(detail),correlationId:String(correlationId||'').slice(0,140)},level)}
  function correlated(correlationId,limit=100){const id=String(correlationId||'');return events.filter(x=>x.correlationId===id).slice(-Math.max(1,Math.min(MAX_EVENTS,Number(limit)||100))).map(x=>({...x,detail:safe(x.detail)}))}
  function register(id,meta={}){
    id=String(id||'').trim();if(!id)return{installed:false,duplicate:false};
    const moduleKey=String(meta.moduleKey||MODULE_KEYS[id]||id),attemptAt=Date.now();
    record('MODULE_INSTALL_ATTEMPT',{module:'runtime',id,moduleKey,owner:String(meta.owner||'')});
    const existing=modules.get(moduleKey);if(existing){existing.attemptCount++;existing.duplicateCount++;existing.lastDuplicateAt=attemptAt;record('MODULE_INSTALL_DUPLICATE_BLOCKED',{module:'runtime',id,moduleKey,owner:existing.owner,installCount:existing.installCount,attemptCount:existing.attemptCount},'warn');return{installed:false,duplicate:true,entry:{...existing}}}
    const entry={id,moduleKey,version:String(meta.version||''),owner:String(meta.owner||''),installed:true,installCount:1,attemptCount:1,duplicateCount:0,installedAt:attemptAt};modules.set(moduleKey,entry);record('MODULE_INSTALL_SUCCESS',{module:'runtime',...entry});return{installed:true,duplicate:false,entry:{...entry}}
  }
  function failed(id,error,meta={}){const moduleKey=String(meta.moduleKey||MODULE_KEYS[id]||id||'unknown');return record('MODULE_INSTALL_FAILED',{module:'runtime',id:String(id||''),moduleKey,owner:String(meta.owner||''),error:String(error?.message||error||'install failed')},'error')}
  const resolve=()=>({spotifySdk:window.JFMSpotifySDK||null,playbackState:window.JFMPlaybackState||null,playbackController:window.JFMPlayback||null,transitionController:window.MAIRTransitionController||null,queue:window.JFMQueue||null,requestTransport:window.JFMRequests||null,djEngine:window.MAIRDJ||null,voiceEngine:window.MAIRVoiceEngine||null,diagnostics:window.MAIRObservability||null});
  function status(){const resolved=resolve();return{owners:Object.fromEntries([...modules].map(([key,value])=>[key,value.owner])),ready:Object.fromEntries(Object.entries(resolved).map(([key,value])=>[key,!!value]))}}
  function refresh(){const detail=status();try{window.dispatchEvent(new CustomEvent('mair:runtime-ready',{detail}))}catch{}return detail}
  function snapshot(){return{version:'runtime-v3-deterministic',sessionId,modules:[...modules.values()].map(x=>({...x})),events:events.map(x=>({...x,details:safe(x.details),detail:safe(x.detail)})),counters:Object.fromEntries(counters),status:status()}}
  window.MAIRRuntime={version:'runtime-v3-deterministic',sessionId,register,failed,record,trace,correlated,sanitize:safe,snapshot,resolve,status,refresh,events:(limit=100)=>events.slice(-Math.max(1,Math.min(MAX_EVENTS,Number(limit)||100))).map(x=>({...x,details:safe(x.details),detail:safe(x.detail)})),clear:()=>{events.length=0;counters.clear()}};
  register('mair-runtime',{version:'runtime-v3-deterministic',owner:'reliability-core'});
})();
