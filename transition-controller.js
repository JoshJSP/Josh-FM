// MAIR canonical track-transition classifier. DJ scheduling consumes only this stream.
(()=>{
  'use strict';
  if(window.MAIRTransitionController?.version)return;
  const ACTION_TTL=10000,NATURAL_TTL=12000,DEDUP_TTL=30000;
  let actionSeq=0,transitionSeq=0,lastState=null;
  const actions=[],naturalEnds=new Map(),seen=new Map();
  const now=()=>Date.now(),idOf=s=>String(s?.trackId||s?.item?.id||s?.track_window?.current_track?.id||'');
  const record=(type,detail,level)=>window.MAIRRuntime?.record?.(type,detail,level);
  function prune(){const at=now();for(let i=actions.length-1;i>=0;i--)if(Number(actions[i].expiresAt||actions[i].at+ACTION_TTL)<=at)actions.splice(i,1);for(const[k,v]of naturalEnds)if(at-v.at>NATURAL_TTL)naturalEnds.delete(k);for(const[k,v]of seen)if(at-v>DEDUP_TTL)seen.delete(k)}
  function mark(type,detail={}){prune();const at=now(),action={id:`a${++actionSeq}`,type:String(type||'UNKNOWN').toUpperCase(),at,expiresAt:at+Math.max(1000,Math.min(10*60*1000,Number(detail.ttlMs||ACTION_TTL))),fromTrackId:String(detail.fromTrackId||idOf(lastState)||''),expectedTrackId:String(detail.expectedTrackId||''),source:String(detail.source||'ui')};actions.push(action);record('transition.action',action);return action.id}
  function cancel(actionId,reason='cancelled'){const index=actions.findIndex(x=>x.id===actionId);if(index<0)return false;const[action]=actions.splice(index,1);record('transition.action-cancelled',{...action,reason},'warn');return true}
  function natural(detail={}){const trackId=String(detail.trackId||detail.endedTrackId||''),positionMs=Number(detail.positionMs||0),durationMs=Number(detail.durationMs||0),nearEnd=durationMs>0&&positionMs>=Math.max(0,durationMs-3500);if(!trackId||!nearEnd){record('transition.natural-evidence-rejected',{trackId,positionMs,durationMs,source:String(detail.source||'playback')},'warn');return false}naturalEnds.set(trackId,{at:now(),positionMs,durationMs,source:String(detail.source||'playback')});record('transition.natural-evidence',{trackId,...naturalEnds.get(trackId)});return true}
  function matchingAction(from,to){for(let i=actions.length-1;i>=0;i--){const a=actions[i];if(a.expectedTrackId&&to&&a.expectedTrackId!==to)continue;if(!a.expectedTrackId&&a.fromTrackId&&from&&a.fromTrackId!==from)continue;actions.splice(i,1);return a}return null}
  function classify(from,to,meta={}){prune();const action=matchingAction(from,to);if(action){const map={NEXT:'USER_NEXT',USER_NEXT:'USER_NEXT',PREVIOUS:'USER_PREVIOUS',USER_PREVIOUS:'USER_PREVIOUS',STATION_CHANGE:'STATION_CHANGE',REQUEST:'REQUEST',RECOVERY:'RECOVERY'};return{cause:map[action.type]||'UNKNOWN',confidence:map[action.type]?1:.2,userActionId:action.id,evidence:{actionId:action.id,actionType:action.type,source:action.source}}}const end=naturalEnds.get(from);if(end){naturalEnds.delete(from);return{cause:'NATURAL_END',confidence:.98,evidence:{source:end.source,positionMs:end.positionMs,durationMs:end.durationMs}}}const source=String(meta.source||'').trim();return source?{cause:'EXTERNAL_CHANGE',confidence:.65,evidence:{source}}:{cause:'UNKNOWN',confidence:.15,evidence:{source:'insufficient-evidence'}}}
  function accept(next,meta={}){
    const previous=lastState;lastState=next?{...next}:next;
    const from=idOf(previous),to=idOf(next);if(!from||!to||from===to)return null;
    const fingerprint=`${from}>${to}:${Number(next?.sequence||next?.revision||0)}`;prune();if(seen.has(fingerprint))return null;seen.set(fingerprint,now());
    const source=String(meta.source||next?.source||''),result=classify(from,to,{source}),transitionId=`t${++transitionSeq}`,transition={transitionId,id:transitionId,sessionId:window.MAIRRuntime?.sessionId||'',observedAt:now(),at:now(),fromTrack:previous?{...previous}:null,toTrack:next?{...next}:null,fromTrackId:from,toTrackId:to,sequence:Number(next?.sequence||next?.revision||0),source,...result};
    record('transition.classified',transition,result.cause==='UNKNOWN'?'warn':'info');
    try{window.dispatchEvent(new CustomEvent('mair:track-transition',{detail:transition}))}catch{}
    return transition
  }
  function onState(event){const detail=event.detail||{},next=detail.state||detail.snapshot;if(next)accept(next,{source:next.source||detail.source||detail.reason})}
  window.addEventListener('jfm:transport-action',e=>mark(e.detail?.type,e.detail||{}));
  window.addEventListener('jfm:natural-track-end',e=>natural(e.detail||{}));
  window.addEventListener('jfm:playback-state',onState);
  const initial=window.JFMPlaybackState?.get?.();if(initial)lastState=initial;
  window.MAIRTransitionController={version:'transition-v1',mark,cancel,natural,accept,classify,state:()=>({lastState:lastState?{...lastState}:null,pendingActions:actions.map(x=>({...x})),naturalEvidence:[...naturalEnds].map(([trackId,x])=>({trackId,...x})),transitions:transitionSeq})};
  window.MAIRRuntime?.register?.('transition-controller',{version:'transition-v1',owner:'canonical-transition'});
})();
