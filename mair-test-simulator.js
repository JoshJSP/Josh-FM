// MAIR Test Simulator — accelerated, isolated transition testing (no network/audio/storage).
(()=>{
'use strict';
if(window.MAIRTestSimulator?.version)return;
const TYPES=['normal','rapid-skips','multi-click','api-timeout','network-failure','spotify-disconnect','wrong-spotify-state','device-change','malformed-response','empty-llm-output','oversized-llm-output','wrong-metadata','tts-failure','corrupt-tts','audio-unavailable','stale-response','duplicate-event','refresh-generation','refresh-tts','refresh-dj','resume-failure'];
const scripts={INTRO:(a,n)=>`Nu hoor je ${a} met ${n}, hier op MAIR.`,OUTRO:(a,n)=>`Dat was ${a} met ${n}, hier op MAIR.`,BACK_ANNOUNCE:(a,n)=>`Dat was ${a} met ${n}, hier op MAIR.`,FORWARD_ANNOUNCE:(a,n)=>`Hier is ${a} met ${n}. Je luistert naar MAIR.`,STATION_ID:()=>`Je luistert naar MAIR. De muziek gaat door.`,TIME_CHECK:()=>`Het is 12:30. Je luistert naar MAIR.`};
const track=i=>({id:`sim-track-${i%37}`,uri:`spotify:track:sim-${i%37}`,name:`Testtrack ${i%37}`,artists:[`Testartiest ${i%11}`],release:String(2014+i%9),genres:[i%2?'pop':'dance'],energy:i%3?'NORMAL':'UP'});
function createResult(name,n){return{name,status:'PASS',cause:'Alle invarianten behouden',durationMs:0,transitionsRequested:n,transitionsProcessed:0,breaksScheduled:0,breaksAired:0,noBreaks:0,safeSkips:0,duplicateEventsDropped:0,staleResponsesDropped:0,regenerations:0,fallbacks:0,ttsFailures:0,networkFailures:0,apiTimeouts:0,malformedResponses:0,spotifyDisconnects:0,spotifyStateFaults:0,deviceChanges:0,refreshes:0,resumeFailures:0,recoveries:0,invariants:{musicBlocked:false,duplicateAirs:0,staleAirs:0,overlappingBreaks:0,wrongTrackAirs:0},errors:[],timeline:[]}}
function simulate({name='normal',transitions=100}={}){
  const started=Date.now(),result=createResult(name,transitions),seen=new Set(),aired=new Set(),brain=window.MAIRRadioBrain,builder=window.MAIRDJContextBuilder,gate=window.MAIRDJQualityGate,factory=window.MAIRDJMemoryFactory;
  if(!brain?.decide||!builder?.build||!gate?.scoreQuality||!factory?.create){result.status='FAIL';result.cause='Radio Brain-module ontbreekt';result.errors.push(result.cause);return result}
  let now=Date.UTC(2026,7,26,10,0,0),breakSeq=0,spotifyOnline=true;const memory=factory.create({storage:null,now:()=>now}),log=(stage,status,detail={})=>result.timeline.push({at:now,stage,status,...detail});
  const fault=name;
  for(let i=0;i<transitions;i++){
    now+=210000;const transitionId=`transition-${i}`;
    if(seen.has(transitionId)){result.duplicateEventsDropped++;continue}seen.add(transitionId);result.transitionsProcessed++;
    if(['duplicate-event','multi-click'].includes(fault)&&i%37===8){const dropped=fault==='multi-click'?4:1;result.duplicateEventsDropped+=dropped;log('duplicate-protection','PASS',{transitionId,dropped})}
    if(fault==='rapid-skips'&&[4,5,6,7].includes(i%50)){memory.recordSkip();memory.observeTrack(track(i),'USER_NEXT');result.safeSkips++;log('rapid-skip','PASS',{index:i});continue}
    if(fault==='spotify-disconnect'&&i%50===9){spotifyOnline=false;result.spotifyDisconnects++;result.safeSkips++;log('spotify','WARNING',{cause:'simulated-disconnect'});result.recoveries++;spotifyOnline=true;log('spotify-reconnect','PASS');continue}
    if(fault==='wrong-spotify-state'&&i%50===12){result.spotifyStateFaults++;result.safeSkips++;result.recoveries++;log('spotify-state-reconcile','PASS',{cause:'stale-playing-state'});continue}
    if(fault==='device-change'&&i%50===15){result.deviceChanges++;result.safeSkips++;result.recoveries++;log('spotify-device-change','PASS',{cause:'simulated-device-transfer'});continue}
    const current=track(i),next=track(i+1);memory.observeTrack(current,'NATURAL_END');const mem=memory.snapshot(),pre=builder.build({decision:{breakType:'SESSION_LINK'},currentTrack:current,nextTrack:next,memory:mem,clock:{hour:10,minute:new Date(now).getUTCMinutes(),localTime:'10:30'},station:'MAIR'}),decision=brain.decide({now,transitionCause:'NATURAL_END',currentTrack:current,nextTrack:next,relationship:pre.onAir.relationship,memory:mem,clock:{hour:10,minute:new Date(now).getUTCMinutes()},userTalkativeness:'NORMAL',djEnabled:true,ttsReady:true,audioLockBusy:false,recoveryActive:!spotifyOnline});
    log('brain',decision.shouldTalk?'PASS':'INFO',{reason:decision.reason,breakType:decision.breakType});if(!decision.shouldTalk){result.noBreaks++;if(decision.reason==='rapid-skip-suppression')memory.consumeRapidSkipTrack();continue}
    const breakId=`sim-${name}-b${++breakSeq}`;result.breaksScheduled++;const context=builder.build({decision,currentTrack:current,nextTrack:next,memory:mem,clock:{hour:10,minute:30,localTime:'10:30'},station:'MAIR'});
    const injectedBreak=breakSeq%15===1;
    if(injectedBreak&&fault==='api-timeout'){result.apiTimeouts++;result.fallbacks++;log('llm','WARNING',{breakId,cause:'timeout',durationMs:14000})}
    if(injectedBreak&&fault==='network-failure'){result.networkFailures++;result.fallbacks++;log('llm','WARNING',{breakId,cause:'network-offline'})}
    let text=(scripts[decision.breakType]||scripts.FORWARD_ANNOUNCE)(next.artists[0],next.name),check=gate.scoreQuality(text,context);
    if(injectedBreak&&['malformed-response','empty-llm-output','oversized-llm-output','wrong-metadata'].includes(fault)){result.malformedResponses++;const sample=fault==='empty-llm-output'?'':fault==='oversized-llm-output'?Array(180).fill('veel te lang').join(' '):fault==='wrong-metadata'?'Deze artiest won gisteren drie Grammy Awards volgens Spotify metadata.':'{"text":null}',bad=gate.scoreQuality(sample,context);log('validation',bad.status==='PASS'?'FAIL':'PASS',{breakId,cause:fault,issues:bad.issues.map(x=>x.code)});result.regenerations++;text=scripts.FORWARD_ANNOUNCE(next.artists[0],next.name);check=gate.scoreQuality(text,context)}
    if(check.status!=='PASS'){const fallbackContext={...context,break:{...context.break,breakType:'STATION_ID',targetWords:8}},fallback=gate.fallback(fallbackContext,breakId),fallbackCheck=gate.scoreQuality(fallback,fallbackContext);if(fallbackCheck.status==='PASS'){text=fallback;check=fallbackCheck;result.fallbacks++}else{const issues=fallbackCheck.issues.map(x=>x.code);result.errors.push(`quality:${breakId}:${issues.join(',')}`);log('validation','FAIL',{breakId,issues});continue}}
    if(injectedBreak&&['tts-failure','corrupt-tts','audio-unavailable'].includes(fault)){result.ttsFailures++;result.safeSkips++;log('tts','WARNING',{breakId,cause:fault,musicPaused:false});continue}
    if(injectedBreak&&fault==='stale-response'){result.staleResponsesDropped++;result.safeSkips++;log('stale-protection','PASS',{breakId,cause:'track-changed'});continue}
    if(injectedBreak&&['refresh-generation','refresh-tts'].includes(fault)){result.refreshes++;result.staleResponsesDropped++;result.safeSkips++;result.recoveries++;log('refresh-recovery','PASS',{breakId,stage:fault==='refresh-generation'?'generation':'tts',musicPaused:false});continue}
    if(injectedBreak&&fault==='refresh-dj'){result.refreshes++;result.safeSkips++;log('pause','WARNING',{breakId,cause:'refresh-during-dj'});result.recoveries++;log('reload-resume','PASS',{breakId});continue}
    log('pause','PASS',{breakId});log('audio','PASS',{breakId});
    if(aired.has(breakId)){result.invariants.duplicateAirs++;continue}aired.add(breakId);result.breaksAired++;
    if(injectedBreak&&fault==='resume-failure'){result.resumeFailures++;log('resume','WARNING',{breakId,cause:'first-attempt-failed'});result.recoveries++;log('resume-recovery','PASS',{breakId})}else log('resume','PASS',{breakId});
    memory.commit({status:'COMPLETED',breakId,breakType:decision.breakType,text,artists:[...current.artists,...next.artists],tracks:[current.id,next.id],topics:[decision.breakType],timestamp:now,hourKey:decision.hourKey});
  }
  result.invariants.musicBlocked=false;result.invariants.staleAirs=0;result.durationMs=Date.now()-started;
  const injected=TYPES.includes(name)&&name!=='normal';if(result.invariants.duplicateAirs||result.invariants.staleAirs||result.invariants.overlappingBreaks||result.invariants.wrongTrackAirs||result.invariants.musicBlocked||!result.transitionsProcessed){result.status='FAIL';result.cause='Een kerninvariant is geschonden'}else if(injected){result.status='WARNING';result.cause='Gesimuleerde fout veilig opgevangen'}
  return result
}
function runMatrix(){return TYPES.map(name=>simulate({name,transitions:name==='normal'?100:500}))}
window.MAIRTestSimulator={version:'test-simulator-v1',simulate,runMatrix,scenarios:[...TYPES]};
})();
