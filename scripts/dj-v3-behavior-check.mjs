import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../mair-dj-v2.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

class FakeEventTarget{
  constructor(){this.listeners=new Map()}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
}
class FakeCustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
function makeElement(extra={}){return{value:'',textContent:'',dataset:{},checked:false,addEventListener(){},querySelector(){return null},cloneNode(){return makeElement({...this})},replaceWith(){},...extra}}

function createHarness({speakSucceeds=true,hidden=false,sdkTransport=true,writerSucceeds=true,writerText='Dit is een voorbereide MAIR DJ-break.'}={}){
  const bus=new FakeEventTarget();
  const elements={talk:makeElement({value:'1'}),talkValue:makeElement(),djBreakTime:makeElement(),djText:makeElement()};
  const document={readyState:'complete',visibilityState:hidden?'hidden':'visible',getElementById:id=>elements[id]||null,addEventListener(){}};
  const storage=new Map([['jfm_spotify_device_id','device-test']]);
  const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const remote={id:'A',uri:'spotify:track:A',playing:true,progress:4000};
  const metrics={genericPause:0,genericResume:0,djPause:0,djResume:0,djRewind:0,speak:0,prepare:0,seekApi:0,begin:0,end:0,writer:0,queueCalls:0,playerCalls:0};
  let operation=null,expectedLive=true;
  const playbackTruth={
    get:()=>({trackId:remote.id,uri:remote.uri,isPlaying:remote.playing,expectedLive,operation}),
    begin:(type,data={})=>{metrics.begin++;operation={id:metrics.begin,type,...data};return operation.id},
    end:()=>{metrics.end++;operation=null},
    setExpectedLive:on=>{expectedLive=!!on},
  };
  const liveObject=()=>({item:{id:remote.id,uri:remote.uri,name:`Track ${remote.id}`,artists:[{name:'Artist'}],album:{release_date:'2026-01-01'}},is_playing:remote.playing,progress_ms:remote.progress,device:{id:'device-test',name:'Test device'}});
  const api=async path=>{
    if(path==='/me/player'){metrics.playerCalls++;return liveObject()}
    if(path==='/me/player/queue'){metrics.queueCalls++;return{queue:[{id:String.fromCharCode(remote.id.charCodeAt(0)+1),uri:`spotify:track:${String.fromCharCode(remote.id.charCodeAt(0)+1)}`,name:'Next',artists:[{name:'Artist'}],album:{release_date:'2026-01-01'}}]}}
    if(path.startsWith('/me/player/seek?')){metrics.seekApi++;remote.progress=0;return null}
    throw new Error(`Unexpected API call ${path}`);
  };
  const fetch=async url=>{if(url==='/api/dj-writer'){metrics.writer++;if(!writerSucceeds)throw new Error('writer offline');return{ok:true,status:200,json:async()=>({text:writerText,provider:'groq',model:'test-model'})}}throw new Error(`Unexpected fetch ${url}`)};
  const audioStatus={provider:'fish',model:'test-fish',voiceId:'voice',cacheSize:0,audioUnlocked:true,playbackMode:'html-audio'};
  const JFMDJAudio={status:audioStatus,unlock:async()=>true};
  const prepareSpeech=async()=>{metrics.prepare++;audioStatus.cacheSize=1;return true};
  const speakText=async()=>{metrics.speak++;audioStatus.cacheSize=0;return speakSucceeds};
  const JFMPlayback={
    pause:async()=>{metrics.genericPause++;remote.playing=false;return true},
    resume:async()=>{metrics.genericResume++;remote.playing=true;return true},
    health:{lastError:''}
  };
  if(sdkTransport){
    JFMPlayback.djPause=async uri=>{assert.equal(uri,remote.uri);metrics.djPause++;remote.playing=false;return true};
    JFMPlayback.djResume=async uri=>{assert.equal(uri,remote.uri);metrics.djResume++;remote.playing=true;return true};
    JFMPlayback.djRewind=async uri=>{assert.equal(uri,remote.uri);metrics.djRewind++;remote.progress=0;return true};
  }
  const window={addEventListener:(...a)=>bus.addEventListener(...a),dispatchEvent:(...a)=>bus.dispatchEvent(...a),JFMPlaybackState:playbackTruth,JFMDJAudio,JFMPlayback,JFMSpotifySDK:{deviceId:'device-test'},MAIRDJProfiles:{current:{id:'josh',name:'Josh',role:'MAIR DJ'}}};
  const math=Object.create(Math);math.random=()=>0;
  const context={window,document,localStorage,CustomEvent:FakeCustomEvent,api,fetch,prepareSpeech,speakText,setTimeout,clearTimeout,AbortController,Promise,Date,Math:math,console};
  Object.assign(window,{window,document,localStorage,CustomEvent:FakeCustomEvent,api,fetch,prepareSpeech,speakText});Object.assign(context,window);
  vm.createContext(context);vm.runInContext(source,context,{filename:'mair-dj-v2.js'});
  const setTrack=(id,{playing=true,progress=4000}={})=>{remote.id=id;remote.uri=`spotify:track:${id}`;remote.playing=playing;remote.progress=progress};
  const natural=(ended,newId)=>{setTrack(newId);bus.dispatchEvent(new FakeCustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:ended,newTrackId:newId,auto:true,fast:true}}))};
  const changed=(previous,newId,sourceName='primary-next')=>{setTrack(newId);bus.dispatchEvent(new FakeCustomEvent('jfm:trackchange',{detail:{trackId:newId,previousTrackId:previous,source:sourceName}}))};
  const setProfile=id=>{window.MAIRDJProfiles.current={id,name:id,role:'MAIR DJ'}};
  return{window,document,metrics,setTrack,setProfile,natural,changed,state:()=>window.MAIRDJ.state()};
}

async function prepareAutomaticDue(h){h.natural('A','B');await sleep(20);h.natural('B','C');await sleep(80);assert.equal(h.state().phase,'ARMED','DJ should be fully prepared one song before air')}

async function testSuccessfulAutomaticBreak(){
  const h=createHarness();await prepareAutomaticDue(h);const queuesBeforeAir=h.metrics.queueCalls;h.natural('C','D');await sleep(700);
  assert.equal(h.metrics.djPause,1,'successful break uses SDK-first DJ pause exactly once');
  assert.equal(h.metrics.speak,1,'successful break speaks exactly once');
  assert.equal(h.metrics.djRewind,1,'successful break rewinds exactly once');
  assert.equal(h.metrics.djResume,1,'successful break resumes exactly once');
  assert.equal(h.metrics.genericPause,0,'generic pause must not own DJ handoff');
  assert.equal(h.metrics.genericResume,0,'generic resume must not own DJ handoff');
  assert.equal(h.metrics.queueCalls,queuesBeforeAir,'critical on-air handoff must not fetch Spotify queue');
  assert.equal(h.state().transport,'sdk-first');assert.equal(h.state().played,1);assert.equal(h.state().missed,0);assert.equal(h.state().phase,'COUNTING');
}
async function testDuplicateNaturalEventCannotDoubleAir(){
  const h=createHarness();await prepareAutomaticDue(h);h.natural('C','D');h.natural('C','D');await sleep(700);
  assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1)
}
async function testVoiceFailureRestoresOnceAndNeverRetries(){
  const h=createHarness({speakSucceeds:false});await prepareAutomaticDue(h);h.natural('C','D');await sleep(800);const first={...h.metrics};
  assert.equal(first.djPause,1);assert.equal(first.speak,1);assert.equal(first.djResume,1,'failed voice restores music once');assert.equal(first.djRewind,0,'failed voice must not rewind before restore');assert.equal(h.state().missed,1);
  await sleep(1900);assert.equal(h.metrics.djPause,first.djPause);assert.equal(h.metrics.speak,first.speak);assert.equal(h.metrics.djResume,first.djResume)
}
async function testManualSkipCancelsPreparedBreakWithoutTouchingMusic(){
  const h=createHarness();h.window.MAIRDJ.armManual();await sleep(80);assert.equal(h.state().phase,'ARMED');h.changed('A','B','primary-next');await sleep(1900);
  assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().phase,'COUNTING');assert.equal(h.state().lastMissReason,'manual-or-unexpected-track-change')
}
async function testBackgroundedBreakNeverPausesMusic(){
  const h=createHarness();await prepareAutomaticDue(h);h.document.visibilityState='hidden';h.natural('C','D');await sleep(600);
  assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1)
}
async function testManualDJAtNextNaturalTransition(){
  const h=createHarness();assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(80);assert.equal(h.state().phase,'ARMED');h.natural('A','B');await sleep(700);
  assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1);assert.equal(h.state().played,1)
}
async function testWebApiFallbackStillWorks(){
  const h=createHarness({sdkTransport:false});await prepareAutomaticDue(h);h.natural('C','D');await sleep(1300);
  assert.equal(h.metrics.genericPause,1,'fallback uses generic primary pause');assert.equal(h.metrics.genericResume,1,'fallback uses generic primary resume');assert.equal(h.metrics.speak,1);assert.equal(h.state().played,1);assert.equal(h.state().transport,'web-api-fallback')
}
async function testWriterFailureUsesSafeDutchFallback(){
  const h=createHarness({writerSucceeds:false});await prepareAutomaticDue(h);assert.equal(h.state().writer.provider,'local-fallback');assert.match(h.state().writer.text,/^Dat was .* Nu hoor je .* MAIR\.$/);h.natural('C','D');await sleep(700);assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1);assert.equal(h.state().played,1)
}
async function testChangedNextTrackDropsStaleCopyBeforePause(){
  const h=createHarness();await prepareAutomaticDue(h);h.natural('C','X');await sleep(650);assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1);assert.match(h.state().lastMissReason,/break-missed/)
}
async function testChangedVoiceProfileDropsPreparedBreakBeforePause(){
  const h=createHarness();await prepareAutomaticDue(h);h.setProfile('maya');h.natural('C','D');await sleep(650);assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1);assert.match(h.state().error,/DJ-profiel wijzigde/)
}
const tests=[
  ['automatic break uses SDK-first critical path',testSuccessfulAutomaticBreak],
  ['duplicate natural event is idempotent',testDuplicateNaturalEventCannotDoubleAir],
  ['voice failure restores once without retry',testVoiceFailureRestoresOnceAndNeverRetries],
  ['manual skip cancels stale prepared break',testManualSkipCancelsPreparedBreakWithoutTouchingMusic],
  ['backgrounded break never pauses music',testBackgroundedBreakNeverPausesMusic],
  ['manual DJ airs on next natural transition',testManualDJAtNextNaturalTransition],
  ['generic primary transport remains fallback',testWebApiFallbackStillWorks],
  ['writer failure uses safe Dutch fallback',testWriterFailureUsesSafeDutchFallback],
  ['changed next track drops stale DJ copy before pause',testChangedNextTrackDropsStaleCopyBeforePause],
  ['changed DJ profile drops prepared voice before pause',testChangedVoiceProfileDropsPreparedBreakBeforePause],
];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,'—',e?.stack||e);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`MAIR DJ v3 behavioral simulation: ${passed}/${tests.length} PASS`);
