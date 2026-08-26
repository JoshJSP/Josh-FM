// MAIR observability — correlated, bounded and secret-safe production diagnostics.
(()=>{
'use strict';
if(window.MAIRObservability?.version)return;
const MAX_ERRORS=40,MAX_TRACE=160;
let dj=null,lastTransition=null,lastPlayback=null,lastEvent=null,lastTTS=null;
const errors=[],timings={},retries={total:0,byStage:{}};
const runtime=()=>window.MAIRRuntime;
const clean=value=>runtime()?.sanitize?.(value)??sanitize(value);
function sanitize(value,depth=0){
  if(depth>4)return'[depth-limit]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return /bearer\s+[a-z0-9._-]{12,}|(?:token|secret|api[_-]?key)\s*[:=]\s*\S+/i.test(value)?'[redacted]':value.slice(0,1000);
  if(Array.isArray(value))return value.slice(0,30).map(x=>sanitize(x,depth+1));
  if(typeof value==='object'){const out={};for(const[k,v]of Object.entries(value).slice(0,50))out[k]=/token|secret|authorization|cookie|code_verifier|client_secret/i.test(k)?'[redacted]':sanitize(v,depth+1);return out}
  return String(value).slice(0,300)
}
const track=x=>x?{id:String(x.id||x.trackId||'').slice(0,120),name:String(x.name||'').slice(0,180),artists:(x.artists||[]).map(a=>String(a?.name||a)).slice(0,4),uri:String(x.uri||'').slice(0,180)}:null;
const breakId=()=>String(dj?.activeBreak?.breakId||dj?.prepared?.breakId||lastEvent?.correlationId||'');
function trace(id,stage,status='INFO',detail={},durationMs=null){
  id=String(id||breakId()||'station').slice(0,140);const payload={breakId:id,status:String(status).toUpperCase(),...clean(detail)};
  if(Number.isFinite(durationMs)){payload.durationMs=Math.max(0,Math.round(durationMs));timings[stage]=payload.durationMs}
  if(payload.retry||payload.attempt>1){retries.total++;retries.byStage[stage]=(retries.byStage[stage]||0)+1}
  if(['FAIL','ERROR'].includes(payload.status)){errors.push({at:Date.now(),breakId:id,stage,error:String(payload.error||payload.reason||'onbekende fout').slice(0,500)});if(errors.length>MAX_ERRORS)errors.splice(0,errors.length-MAX_ERRORS)}
  return runtime()?.trace?.(id,stage,payload,payload.status==='FAIL'||payload.status==='ERROR'?'error':payload.status==='WARNING'||payload.status==='WARN'?'warn':'info')||null
}
function currentTrack(){return track(window.playback?.item||window.JFMStationHealth?.snapshot?.()?.currentTrack||null)}
function nextTrack(){return track(window.__jfmSpotifyUpcomingTruth?.items?.[0]||window.JFMStationHealth?.snapshot?.()?.nextTrack||null)}
function snapshot(id=breakId()){
  const playback=clean(window.JFMPlaybackState?.get?.()||window.JFMPlayback?.state||lastPlayback||null),audio=clean(window.JFMDJAudio?.status||null),terminal=dj?.terminalBreaks?.at?.(-1)||null,traceRows=id?runtime()?.correlated?.(id,MAX_TRACE)||[]:runtime()?.events?.(40)||[];
  return clean({version:'observability-v1',at:Date.now(),correlationId:id||'',runtimeModules:runtime()?.snapshot?.().modules||[],currentTrack:currentTrack(),nextTrack:nextTrack(),spotifyState:{online:navigator.onLine,deviceId:playback?.deviceId?'[present]':'',deviceName:playback?.deviceName||'',isPlaying:!!playback?.isPlaying,expectedLive:!!playback?.expectedLive,source:playback?.source||'',operation:playback?.operation||null,lastError:window.JFMPlayback?.health?.lastError||''},radioBrain:dj?.brain||null,breakDecision:dj?.brain?{shouldTalk:dj.brain.shouldTalk,breakType:dj.brain.breakType,reason:dj.brain.reason,score:dj.brain.score,threshold:dj.brain.threshold}:null,breakId:id||'',breakState:dj?.activeBreak?.status||dj?.lifecycle||dj?.phase||terminal?.status||'IDLE',llmStatus:dj?.writer?{provider:dj.writer.provider,model:dj.writer.model,requestId:dj.writer.requestId,promptVersion:dj.writer.promptVersion,error:dj.writer.error||'',attempts:dj.writer.attempts||1}:null,script:dj?.writer?.text||dj?.lastAirText||'',validation:dj?.quality||null,ttsStatus:{...(dj?.voice||{provider:audio?.provider||'',model:audio?.model||'',error:audio?.error||'',cacheSize:audio?.cacheSize||0}),speaking:lastTTS?.active??false,lastEvent:lastTTS},audioStatus:audio,transition:lastTransition,playback,resume:{phase:dj?.phase==='RESTORING'?'IN_PROGRESS':terminal?.status?.startsWith?.('COMPLETED')?'PASS':window.JFMPlayback?.health?.lastError?'WARNING':'IDLE',lastError:window.JFMPlayback?.health?.lastError||'',recoveries:window.JFMPlayback?.health?.recoveries||0},retries:{...retries,byStage:{...retries.byStage}},timings:{...timings},errors:[...errors],trace:traceRows});
}
window.addEventListener('mair:dj-v2-state',e=>{dj=clean(e.detail||null)});
window.addEventListener('mair:track-transition',e=>{lastTransition=clean(e.detail||null);trace(e.detail?.breakId||breakId()||'station','transition.detected','PASS',lastTransition)});
window.addEventListener('jfm:playback-state',e=>{lastPlayback=clean(e.detail||null)});
window.addEventListener('mair:dj-speaking',e=>{lastTTS=clean(e.detail||null);const id=e.detail?.breakId||breakId();if(id)trace(id,e.detail?.active?'tts.playback-start':'tts.playback-end','PASS',{provider:e.detail?.provider||''})});
window.addEventListener('mair:timeline',e=>{lastEvent=clean(e.detail||null);const d=e.detail;if(d?.level==='error'){errors.push({at:d.at,breakId:d.correlationId||'',stage:d.type,error:String(d.detail?.error||d.detail?.reason||d.type).slice(0,500)});if(errors.length>MAX_ERRORS)errors.splice(0,errors.length-MAX_ERRORS)}});
window.addEventListener('error',e=>{if(e?.message)trace(breakId()||'station','browser.error','ERROR',{error:e.message,source:String(e.filename||'').split('/').at(-1)||''})});
window.addEventListener('unhandledrejection',e=>trace(breakId()||'station','browser.promise','ERROR',{error:String(e.reason?.message||e.reason||'Unhandled promise rejection')}));
window.MAIRObservability={version:'observability-v1',trace,snapshot,forBreak:id=>snapshot(String(id||'')),sanitize:clean,get breakId(){return breakId()}};
runtime()?.register?.('mair-observability',{version:'observability-v1',owner:'diagnostics'});
})();
