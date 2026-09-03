(()=>{
'use strict';
const VERSION='1.0.0';
const TYPES=['INTRO','OUTRO','BACK_ANNOUNCE','FORWARD_ANNOUNCE','REQUEST','ARTIST_FACT','TRACK_FACT','TWO_SONG_LINK','STATION_ID','TIME_CHECK','HOUR_OPENER','HOUR_CLOSER','SESSION_LINK'];
const CONFIG={INTRO:[14,10],OUTRO:[12,9],BACK_ANNOUNCE:[16,10],FORWARD_ANNOUNCE:[17,11],REQUEST:[16,10],ARTIST_FACT:[28,15],TRACK_FACT:[28,15],TWO_SONG_LINK:[24,14],STATION_ID:[8,5],TIME_CHECK:[14,10],HOUR_OPENER:[32,18],HOUR_CLOSER:[26,15],SESSION_LINK:[24,14]};
const validTrack=t=>!!String(t?.id||t?.uri||'').trim();
const clean=v=>String(v??'').trim();
function no(reason,extra={}){return{shouldTalk:false,breakType:'NO_BREAK',maxDurationSeconds:0,targetWordCount:0,priority:0,permittedTopics:[],prohibitedTopics:['weather','news','sport','traffic'],mustMention:[],mayMention:[],reason, fallbackType:null,...extra}}
function recentCount(history,type,ms,now){return(history||[]).filter(x=>x.type===type&&now-Number(x.timestamp)<ms).length}
function decide(input={}){
  const now=Number(input.now)||Date.now(),memory=input.memory||{},history=memory.history||[],recent=memory.recentBreaks||[],cause=clean(input.transitionCause||'').toUpperCase(),manual=!!input.manual,globalMode=typeof window!=='undefined'?window.MAIRModeManager?.djContext?.()||{}:{},specialMode=clean(input.specialMode?.mode||globalMode.mode||'normal').toLowerCase(),specialLabel=clean(input.specialMode?.label||globalMode.label);
  if(input.djEnabled===false)return no('dj-disabled');
  if(input.audioLockBusy)return no('audio-lock-busy');
  if(input.recoveryActive||input.spotifyUncertain)return no('playback-uncertain');
  if(input.ttsReady===false)return no('tts-unavailable');
  if(!manual&&!['NATURAL_END','APPROVED_NATURAL_OPPORTUNITY'].includes(cause))return no('transition-not-approved');
  if(input.justSkipped||['USER_NEXT','USER_PREVIOUS'].includes(cause))return no('user-skip');
  if(!validTrack(input.currentTrack)||(!manual&&!validTrack(input.nextTrack)))return no('missing-track-context');
  const skipCount=(memory.skipTimes||[]).filter(x=>now-Number(x)<300000).length;
  const rapidSuppressed=Object.hasOwn(memory,'rapidSkipTracksRemaining')?Number(memory.rapidSkipTracksRemaining)>0:skipCount>=3;if(!manual&&rapidSuppressed)return no('rapid-skip-suppression',{suppressedTracks:Number(memory.rapidSkipTracksRemaining)||2});
  const tracks=Number(memory.tracksSinceLastBreak)||0,minutes=Number(memory.minutesSinceLastBreak);
  if(!manual&&(tracks<2||minutes<5))return no('minimum-separation');
  const talk=clean(input.userTalkativeness||'NORMAL').toUpperCase(),maxHour=talk==='LESS'?2:talk==='MORE'?5:4;
  if(!manual&&(memory.recentHour||[]).length>=maxHour)return no('hourly-cap');
  const clock=input.clock||{},minute=Number.isFinite(Number(clock.minute))?Number(clock.minute):new Date(now).getMinutes(),hour=Number.isFinite(Number(clock.hour))?Number(clock.hour):new Date(now).getHours();
  const hourKey=`${new Date(now).toISOString().slice(0,10)}-${hour}`;
  const facts=(input.availableFacts||[]).filter(f=>f&&f.factId&&Number(f.confidence)>=.8&&!(memory.usedFactIds||[]).includes(String(f.factId)));
  const relationship=input.relationship||null,sessionMinutes=Number(memory.narrative?.sessionMinutes)||Number(input.sessionDuration||0)/60000;
  let score=manual?99:0,type='FORWARD_ANNOUNCE',reason=[];
  if(tracks>=3){score+=tracks>=5?3:tracks>=4?2:1;reason.push('cadence')}
  if(minutes>=14){score+=2;reason.push('time-since-break')}else if(minutes>=9){score+=1;reason.push('time-since-break')}
  if(relationship){score+=2;reason.push('defensible-music-link')}
  if(validTrack(input.nextTrack)){score+=1;reason.push('next-track-known')}
  if(facts.length&&recentCount(history,'ARTIST_FACT',2700000,now)+recentCount(history,'TRACK_FACT',2700000,now)===0){score+=2;reason.push('verified-fact')}
  if(input.nextTrack?.discovery||input.currentTrack?.discovery){score+=1;reason.push('discovery')}if(specialMode==='roadtrip'&&specialLabel.includes('Final Stretch')){score+=1;reason.push('roadtrip-finale')}
  const recentTypes=recent.slice(0,3).map(x=>x.type),recentArtists=new Set(recent.slice(0,3).flatMap(x=>x.artists||[]).map(x=>String(x).toLowerCase()));
  const artists=[...(input.currentTrack?.artists||[]),...(input.nextTrack?.artists||[])];if(artists.some(a=>recentArtists.has(String(a).toLowerCase()))){score-=2;reason.push('recent-artist-penalty')}
  if(recentTypes[0]&&recentTypes[0]===recentTypes[1])score-=2;
  const threshold=talk==='LESS'?7:talk==='MORE'?4:6;if(!manual&&score<threshold)return no('score-below-threshold',{score,threshold});
  if(input.nextTrack?.request||input.currentTrack?.request){const requestTrack=input.nextTrack?.request?input.nextTrack:input.currentTrack,[target,maxDuration]=CONFIG.REQUEST;return{shouldTalk:true,breakType:'REQUEST',maxDurationSeconds:maxDuration,targetWordCount:target,priority:10,permittedTopics:['music','request'],prohibitedTopics:['weather','news','sport','traffic','unverified-facts','technical-details'],mustMention:[],mayMention:[...(requestTrack?.artists||[]),requestTrack?.name].filter(Boolean).slice(0,4),reason:input.nextTrack?.request?'next-track-request':'current-track-request',fallbackType:'REQUEST',score:10,threshold:0,hourKey}}
  const hourAlready=history.some(x=>x.hourKey===hourKey||x.type==='HOUR_OPENER'&&now-Number(x.timestamp)<3000000);
  if(!hourAlready&&minute<=8&&tracks>=2)type='HOUR_OPENER';
  else if(minute>=52&&recentCount(history,'HOUR_CLOSER',3000000,now)===0&&tracks>=3)type='HOUR_CLOSER';
  else if(facts.length&&recentCount(history,'ARTIST_FACT',2700000,now)+recentCount(history,'TRACK_FACT',2700000,now)===0)type=facts[0].subjectType==='track'?'TRACK_FACT':'ARTIST_FACT';
  else if(relationship&&!recentTypes.slice(0,2).includes('TWO_SONG_LINK'))type='TWO_SONG_LINK';
  else if(sessionMinutes>=45&&memory.narrative?.dominantGenre&&!recentTypes.includes('SESSION_LINK'))type='SESSION_LINK';
  else if((minute<=3||minute>=27&&minute<=33)&&recentCount(history,'TIME_CHECK',1800000,now)===0)type='TIME_CHECK';
  else if(input.nextTrack?.discovery)type='INTRO';
  else if(input.currentTrack?.notable)type='OUTRO';
  else if(!recentTypes.includes('STATION_ID')&&sessionMinutes<10)type='STATION_ID';
  else if(input.currentTrack?.discovery)type='BACK_ANNOUNCE';
  else type='FORWARD_ANNOUNCE';
  if(recentTypes[0]===type&&recentTypes[1]===type)type=relationship?'TWO_SONG_LINK':'FORWARD_ANNOUNCE';
  const [target,maxDuration]=CONFIG[type]||CONFIG.SESSION_LINK,fact=type.endsWith('_FACT')?facts[0]:null;
  return{shouldTalk:true,breakType:type,maxDurationSeconds:maxDuration,targetWordCount:target,priority:manual?10:Math.max(1,Math.min(9,score)),permittedTopics:['music','station','local-time','session-context'],prohibitedTopics:['weather','news','sport','traffic','unverified-facts','technical-details'],mustMention:fact?[fact.factId]:[],mayMention:artists.slice(0,4),reason:manual?'manual-approved':reason.join(','),fallbackType:['STATION_ID','TIME_CHECK','INTRO','OUTRO','BACK_ANNOUNCE','FORWARD_ANNOUNCE'].includes(type)?type:'STATION_ID',score,threshold,hourKey}
}
const api={version:VERSION,types:TYPES,decide,noBreak:no,config:CONFIG};if(typeof window!=='undefined')window.MAIRRadioBrain=api;else globalThis.MAIRRadioBrain=api;
})();
