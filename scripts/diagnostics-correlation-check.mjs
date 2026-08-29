import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Bus{constructor(){this.rows=new Map()}addEventListener(n,f){if(!this.rows.has(n))this.rows.set(n,[]);this.rows.get(n).push(f)}dispatchEvent(e){for(const f of this.rows.get(e.type)||[])f(e);return true}}
class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
const bus=new Bus();
const window={
  addEventListener:(...a)=>bus.addEventListener(...a),
  dispatchEvent:e=>bus.dispatchEvent(e),
  playback:{item:{id:'track-a',name:'Track A',artists:[{name:'Artist A'}],uri:'spotify:track:a'}},
  __jfmSpotifyUpcomingTruth:{items:[{id:'track-b',name:'Track B',artists:[{name:'Artist B'}]}]},
  JFMPlaybackState:{get:()=>({trackId:'track-a',deviceId:'device-private',deviceName:'Browser',isPlaying:true,expectedLive:true,source:'test'})},
  JFMPlayback:{health:{recoveries:1,lastError:''}},
  JFMDJAudio:{status:{provider:'fish',model:'s1',cacheSize:1}}
};
const sessionStorage={getItem:()=>null,setItem:()=>{}},navigator={onLine:true};const context={window,sessionStorage,navigator,CustomEvent,Date,Math,Map,Object,Array,String,Number,JSON,Set};vm.createContext(context);
for(const file of ['mair-runtime.js','mair-observability.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context,{filename:file});
bus.dispatchEvent(new CustomEvent('mair:dj-v2-state',{detail:{phase:'ARMED',activeBreak:{breakId:'break-42',status:'ARMED'},lastHandoff:{breakId:'break-42',scheduledReason:'cadence',originTrackId:'track-a',targetTrackId:'track-b',pauseAt:10,playbackStartedAt:20,playbackEndedAt:30,resumeAt:40,terminalStatus:'COMPLETED',totalHandoffMs:30},brain:{shouldTalk:true,breakType:'INTRO',reason:'cadence'},writer:{provider:'groq',model:'model',requestId:'request-safe',text:'Veilige testtekst'},quality:{status:'PASS',score:96}}}));
bus.dispatchEvent(new CustomEvent('mair:dj-speaking',{detail:{active:true,breakId:'break-42',provider:'fish',route:'html-audio',playbackStartedAt:20,success:true}}));
bus.dispatchEvent(new CustomEvent('mair:dj-speaking',{detail:{active:false,breakId:'break-42',provider:'fish',route:'html-audio',playbackStartedAt:20,playbackEndedAt:30,success:true}}));
window.MAIRObservability.trace('break-42','llm.response','PASS',{authorization:'Bearer should-never-appear',apiToken:'secret-value'},123);
const snap=window.MAIRObservability.snapshot('break-42'),serialized=JSON.stringify(snap);
for(const key of ['runtimeModules','currentTrack','nextTrack','spotifyState','radioBrain','breakDecision','breakId','breakState','handoff','llmStatus','script','validation','ttsStatus','audioStatus','transition','playback','resume','retries','timings','errors','trace'])assert.ok(Object.hasOwn(snap,key),`snapshot mist ${key}`);
assert.equal(snap.breakId,'break-42');assert.equal(snap.breakState,'ARMED');assert.equal(snap.handoff.breakId,'break-42');assert.equal(snap.handoff.playbackStartedAt,20);assert.equal(snap.handoff.playbackEndedAt,30);assert.ok(snap.trace.some(x=>x.type==='trace.tts.playback-start'&&x.correlationId==='break-42'));assert.ok(snap.trace.some(x=>x.type==='trace.tts.playback-end'&&x.correlationId==='break-42'));assert.ok(!serialized.includes('should-never-appear'));assert.ok(!serialized.includes('secret-value'));assert.equal(snap.spotifyState.deviceId,'[present]');
console.log('MAIR correlated diagnostics: schema + break trace + secret redaction PASS');
