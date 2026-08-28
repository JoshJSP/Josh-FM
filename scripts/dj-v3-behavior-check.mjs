import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const moduleSources=['dj-memory.js','radio-brain.js','dj-context-builder.js','dj-quality-gate.js'].map(name=>[name,fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')]);
const source=fs.readFileSync(new URL('../mair-dj-v2.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

class FakeEventTarget{
  constructor(){this.listeners=new Map()}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
}
class FakeCustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-08-26T10:30:00Z']))}static now(){return Date.now()}}
function makeElement(extra={}){return{value:'',textContent:'',dataset:{},checked:false,addEventListener(){},querySelector(){return null},cloneNode(){return makeElement({...this})},replaceWith(){},...extra}}

function createHarness({speakSucceeds=true,speakDelay=0,hidden=false,sdkTransport=true,writerSucceeds=true,writerDelay=0,prepareDelay=0,prepareFailures=0,playerFailures=0,writerText='Dit is een voorbereide MAIR DJ-break.',writerTexts=null,factsEnabled=false,requestTrackId=''}={}){
  const bus=new FakeEventTarget();
  const elements={talk:makeElement({value:'1'}),facts:makeElement({checked:factsEnabled}),talkValue:makeElement(),djBreakTime:makeElement(),djText:makeElement()};
  const document={readyState:'complete',visibilityState:hidden?'hidden':'visible',getElementById:id=>elements[id]||null,addEventListener(){}};
  const storage=new Map([['jfm_spotify_device_id','device-test']]);
  const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},sessionStorage=localStorage;
  const remote={id:'A',uri:'spotify:track:A',playing:true,progress:4000};
  const metrics={genericPause:0,genericResume:0,djPause:0,djResume:0,djRewind:0,speak:0,speakAborted:0,playbackActions:0,prepare:0,prepareAborted:0,writerAborted:0,seekApi:0,begin:0,end:0,writer:0,queueCalls:0,playerCalls:0,requestConsume:0};
  let operation=null,expectedLive=true;
  const playbackTruth={
    get:()=>({trackId:remote.id,uri:remote.uri,isPlaying:remote.playing,expectedLive,operation}),
    begin:(type,data={})=>{metrics.begin++;operation={id:metrics.begin,type,...data};return operation.id},
    end:()=>{metrics.end++;operation=null},
    setExpectedLive:on=>{expectedLive=!!on},
  };
  const liveObject=()=>({item:{id:remote.id,uri:remote.uri,name:`Track ${remote.id}`,artists:[{name:'Artist'}],album:{release_date:'2026-01-01'}},is_playing:remote.playing,progress_ms:remote.progress,device:{id:'device-test',name:'Test device'}});
  const api=async path=>{
    if(path==='/me/player'){metrics.playerCalls++;if(playerFailures-->0)throw new Error('temporary Spotify context failure');return liveObject()}
    if(path==='/me/player/queue'){metrics.queueCalls++;return{queue:[{id:String.fromCharCode(remote.id.charCodeAt(0)+1),uri:`spotify:track:${String.fromCharCode(remote.id.charCodeAt(0)+1)}`,name:'Next',artists:[{name:'Artist'}],album:{release_date:'2026-01-01'}}]}}
    if(path.startsWith('/me/player/seek?')){metrics.seekApi++;remote.progress=0;return null}
    throw new Error(`Unexpected API call ${path}`);
  };
  const fetch=async(url,opt={})=>{if(url!=='/api/dj-writer')throw new Error(`Unexpected fetch ${url}`);metrics.writer++;if(!writerSucceeds)throw new Error('writer offline');if(writerDelay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,writerDelay);opt.signal?.addEventListener('abort',()=>{clearTimeout(timer);metrics.writerAborted++;reject(Object.assign(new Error('aborted'),{name:'AbortError'}))},{once:true})});const text=Array.isArray(writerTexts)?writerTexts[Math.min(metrics.writer-1,writerTexts.length-1)]:writerText;return{ok:true,status:200,json:async()=>({text,provider:'groq',model:'test-model'})}};
  const audioStatus={provider:'fish',model:'test-fish',voiceId:'voice',cacheSize:0,audioUnlocked:true,playbackMode:'html-audio'};
  const JFMDJAudio={status:audioStatus,unlock:async()=>true};
  const prepareSpeech=async(_text,_jingle,meta={})=>{metrics.prepare++;if(prepareDelay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,prepareDelay);meta.signal?.addEventListener('abort',()=>{clearTimeout(timer);metrics.prepareAborted++;reject(Object.assign(new Error('aborted'),{name:'AbortError'}))},{once:true})});if(prepareFailures-->0){audioStatus.error='temporary Fish Audio failure';return false}audioStatus.error='';audioStatus.cacheSize=1;return true};
  const speakText=async(_text,_jingle,meta={})=>{metrics.speak++;audioStatus.cacheSize=0;if(speakDelay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,speakDelay),abort=()=>{clearTimeout(timer);metrics.speakAborted++;reject(Object.assign(new Error('voice cancelled'),{name:'AbortError'}))};if(meta.signal?.aborted)return abort();meta.signal?.addEventListener?.('abort',abort,{once:true})});return speakSucceeds};
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
  const window={addEventListener:(...a)=>bus.addEventListener(...a),dispatchEvent:(...a)=>bus.dispatchEvent(...a),JFMPlaybackState:playbackTruth,JFMDJAudio,JFMPlayback,JFMSpotifySDK:{deviceId:'device-test'},MAIRDJProfiles:{current:{id:'josh',name:'Josh',role:'MAIR DJ'}},jfmIsRequest:t=>!!requestTrackId&&String(t?.id||'')===String(requestTrackId),JFMRequests:{consumeCurrentRequest:t=>{if(requestTrackId&&String(t?.id||'')===String(requestTrackId)){metrics.requestConsume++;return{requestId:'test-request',trackId:requestTrackId}}return null}}};
  const math=Object.create(Math);math.random=()=>0;
  const context={window,document,localStorage,sessionStorage,CustomEvent:FakeCustomEvent,api,fetch,prepareSpeech,speakText,setTimeout,clearTimeout,AbortController,Promise,Date:FixedDate,Math:math,console};
  Object.assign(window,{window,document,localStorage,sessionStorage,CustomEvent:FakeCustomEvent,api,fetch,prepareSpeech,speakText});Object.assign(context,window);
  vm.createContext(context);for(const[name,moduleSource]of moduleSources)vm.runInContext(moduleSource,context,{filename:name});vm.runInContext(source,context,{filename:'mair-dj-v2.js'});
  const setTrack=(id,{playing=true,progress=4000}={})=>{remote.id=id;remote.uri=`spotify:track:${id}`;remote.playing=playing;remote.progress=progress};
  let transition=0;
  const natural=(ended,newId)=>{setTrack(newId);bus.dispatchEvent(new FakeCustomEvent('mair:track-transition',{detail:{id:`t${++transition}`,fromTrackId:ended,toTrackId:newId,cause:'NATURAL_END',source:'canonical'}}))};
  const changed=(previous,newId,sourceName='primary-next')=>{metrics.playbackActions++;setTrack(newId);bus.dispatchEvent(new FakeCustomEvent('mair:track-transition',{detail:{id:`t${++transition}`,fromTrackId:previous,toTrackId:newId,cause:sourceName.includes('prev')?'USER_PREVIOUS':'USER_NEXT',source:sourceName}}))};
  const setProfile=id=>{window.MAIRDJProfiles.current={id,name:id,role:'MAIR DJ'}};
  return{window,document,metrics,setTrack,setProfile,natural,changed,state:()=>window.MAIRDJ.state()};
}

async function prepareAutomaticDue(h){h.natural('A','B');await sleep(20);h.natural('B','C');await sleep(20);h.natural('C','D');await sleep(80);assert.equal(h.state().phase,'ARMED',`DJ should be fully prepared one song before air: ${JSON.stringify(h.state())}`)}

async function testSuccessfulAutomaticBreak(){
  const h=createHarness();await prepareAutomaticDue(h);const queuesBeforeAir=h.metrics.queueCalls;h.natural('D','E');await sleep(700);
  assert.equal(h.metrics.djPause,1,`successful break uses SDK-first DJ pause exactly once: ${JSON.stringify(h.state())}`);
  assert.equal(h.metrics.speak,1,'successful break speaks exactly once');
  assert.equal(h.metrics.djRewind,1,'successful break rewinds exactly once');
  assert.equal(h.metrics.djResume,1,'successful break resumes exactly once');
  assert.equal(h.metrics.genericPause,0,'generic pause must not own DJ handoff');
  assert.equal(h.metrics.genericResume,0,'generic resume must not own DJ handoff');
  assert.equal(h.metrics.queueCalls,queuesBeforeAir,'critical on-air handoff must not fetch Spotify queue');
  assert.equal(h.state().transport,'sdk-first');assert.equal(h.state().played,1);assert.equal(h.state().missed,0);assert.equal(h.state().phase,'COUNTING');
}
async function testDuplicateNaturalEventCannotDoubleAir(){
  const h=createHarness();await prepareAutomaticDue(h);h.natural('D','E');h.natural('D','E');await sleep(700);
  assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1);assert.equal(new Set(h.state().terminalBreaks.map(x=>x.breakId)).size,h.state().terminalBreaks.length,'ieder breakId bereikt exact één terminal state');assert.equal(h.state().terminalBreaks.filter(x=>x.status==='COMPLETED').length,1)
}
async function testVoiceFailureRestoresOnceAndNeverRetries(){
  const h=createHarness({speakSucceeds:false});await prepareAutomaticDue(h);h.natural('D','E');await sleep(800);const first={...h.metrics};
  assert.equal(first.djPause,1);assert.equal(first.speak,1);assert.equal(first.djResume,1,'failed voice restores music once');assert.equal(first.djRewind,0,'failed voice must not rewind before restore');assert.equal(h.state().missed,1);
  await sleep(1900);assert.equal(h.metrics.djPause,first.djPause);assert.equal(h.metrics.speak,first.speak);assert.equal(h.metrics.djResume,first.djResume)
}
async function testManualSkipCancelsPreparedBreakWithoutTouchingMusic(){
  const h=createHarness();h.window.MAIRDJ.armManual();await sleep(80);assert.equal(h.state().phase,'ARMED');h.changed('A','B','primary-next');await sleep(1900);
  assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().phase,'COUNTING');assert.equal(h.state().lastMissReason,'transition-user_next');assert.equal(h.state().terminalBreaks.at(-1).status,'ABORTED_USER_ACTION');assert.equal(new Set(h.state().terminalBreaks.map(x=>x.breakId)).size,h.state().terminalBreaks.length,'geen break heeft twee terminal states')
}
async function testBackgroundedBreakNeverPausesMusic(){
  const h=createHarness();await prepareAutomaticDue(h);h.document.visibilityState='hidden';h.natural('D','E');await sleep(600);
  assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1)
}
async function testManualDJAtNextNaturalTransition(){
  const h=createHarness();assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(80);assert.equal(h.state().phase,'ARMED');h.natural('A','B');await sleep(700);
  assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1);assert.equal(h.state().played,1)
}
async function testWebApiFallbackStillWorks(){
  const h=createHarness({sdkTransport:false});await prepareAutomaticDue(h);h.natural('D','E');await sleep(1300);
  assert.equal(h.metrics.genericPause,1,'fallback uses generic primary pause');assert.equal(h.metrics.genericResume,1,'fallback uses generic primary resume');assert.equal(h.metrics.speak,1);assert.equal(h.state().played,1);assert.equal(h.state().transport,'web-api-fallback')
}
async function testLateManualPreparationRebasesSafely(){
  const h=createHarness({writerDelay:180});assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(25);h.natural('A','B');await sleep(40);assert.equal(h.metrics.writerAborted,1,'oude writer hoort bij track A en wordt geannuleerd');assert.equal(h.metrics.djPause,0);await sleep(430);assert.equal(h.state().phase,'ARMED',`manual break should re-arm for B: ${JSON.stringify(h.state())}`);assert.equal(h.state().retries.prepareRebases,1);h.natural('B','C');await sleep(700);assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.state().played,1)
}
async function testLateAutomaticPreparationIsNotLost(){
  const h=createHarness({writerDelay:180});h.natural('A','B');await sleep(25);h.natural('B','C');await sleep(25);h.natural('C','D');await sleep(25);h.natural('D','E');await sleep(40);assert.equal(h.metrics.writerAborted,1,'oude automatische writer wordt bij de overgang geannuleerd');await sleep(430);assert.equal(h.state().phase,'ARMED',`automatic break should be prepared for E: ${JSON.stringify(h.state())}`);assert.equal(h.state().retries.prepareRebases,1);h.natural('E','F');await sleep(700);assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.state().played,1)
}
async function testWriterFailureUsesSafeDutchFallback(){
  const h=createHarness({writerSucceeds:false});await prepareAutomaticDue(h);assert.equal(h.state().writer.provider,'local-fallback');assert.match(h.state().writer.text,/MAIR/);assert.doesNotMatch(h.state().writer.text,/\bAI\b|Groq|Spotify API/i);h.natural('D','E');await sleep(700);assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.djResume,1);assert.equal(h.state().played,1)
}
async function testChangedNextTrackDropsStaleCopyBeforePause(){
  const h=createHarness();await prepareAutomaticDue(h);h.natural('D','X');await sleep(650);assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1);assert.match(h.state().lastMissReason,/break-missed/)
}
async function testChangedVoiceProfileDropsPreparedBreakBeforePause(){
  const h=createHarness();await prepareAutomaticDue(h);h.setProfile('maya');h.natural('D','E');await sleep(650);assert.equal(h.metrics.djPause,0);assert.equal(h.metrics.speak,0);assert.equal(h.metrics.djResume,0);assert.equal(h.state().missed,1);assert.match(h.state().error,/DJ-profiel wijzigde/)
}
async function testStaleWriterResponseIsCancelled(){
  const h=createHarness({writerDelay:220});h.window.MAIRDJ.armManual();await sleep(30);h.changed('A','B');await sleep(300);assert.equal(h.metrics.writerAborted,1);assert.equal(h.metrics.prepare,0);assert.equal(h.metrics.djPause,0);assert.equal(h.state().prepared,null);assert.equal(h.state().phase,'COUNTING')
}
async function testStaleTTSResponseIsCancelled(){
  const h=createHarness({prepareDelay:220});h.window.MAIRDJ.armManual();await sleep(30);h.changed('A','B');await sleep(300);assert.equal(h.metrics.prepareAborted,1);assert.equal(h.metrics.djPause,0);assert.equal(h.state().prepared,null);assert.equal(h.state().phase,'COUNTING')
}
async function testUserOverrideDuringBreakWins(){
  const h=createHarness({speakDelay:350});await prepareAutomaticDue(h);h.natural('D','E');await sleep(260);h.changed('E','X');await sleep(700);assert.equal(h.metrics.djPause,1);assert.equal(h.metrics.speak,1);assert.equal(h.metrics.speakAborted,1);assert.equal(h.metrics.djResume,0,'DJ mag de door de gebruiker gekozen track niet vervangen');assert.equal(h.state().played,0);assert.equal(h.state().phase,'COUNTING');assert.equal(h.state().terminalBreaks.at(-1).status,'ABORTED_USER_ACTION')
}
async function testSkipCancelsVoiceAtRaceBoundaries(){
  for(const delay of [0,120,480]){const h=createHarness({speakDelay:650});await prepareAutomaticDue(h);h.natural('D','E');for(let i=0;i<30&&h.state().phase!=='SPEAKING';i++)await sleep(10);assert.equal(h.state().phase,'SPEAKING',`voice did not start for delay ${delay}`);if(delay)await sleep(delay);await h.window.MAIRDJ.cancelActive('USER_NEXT');h.changed('E',`X-${delay}`);await sleep(220);assert.equal(h.metrics.speak,1,`delay ${delay}: one voice started`);assert.equal(h.metrics.speakAborted,1,`delay ${delay}: active voice stopped once`);assert.equal(h.metrics.playbackActions,1,`delay ${delay}: exactly one playback action`);assert.equal(h.metrics.djResume,0,`delay ${delay}: no stale DJ resume`);assert.equal(h.state().played,0,`delay ${delay}: cancelled voice is not committed as aired`);assert.equal(h.state().terminalBreaks.at(-1).status,'ABORTED_USER_ACTION',`delay ${delay}: terminal cancel state`);assert.equal(new Set(h.state().terminalBreaks.map(x=>x.breakId)).size,h.state().terminalBreaks.length,`delay ${delay}: one terminal state per break`)}
}
async function testPauseIntentDuringBreakWins(){
  const h=createHarness({speakDelay:350});await prepareAutomaticDue(h);h.natural('D','E');await sleep(260);assert.equal(h.window.MAIRDJ.userOverride('PLAY_PAUSE'),true);await sleep(700);assert.equal(h.metrics.djResume,0,'een expliciete pauzeactie tijdens de DJ-break mag niet worden teruggedraaid');assert.equal(h.state().terminalBreaks.at(-1).reason,'user-override')
}
async function testMalformedWriterRegeneratesOnce(){
  const h=createHarness({writerTexts:['{"text":"Als AI gebruik ik metadata."}','Artist met Track D, en nu Artist met Next.']});await prepareAutomaticDue(h);assert.equal(h.metrics.writer,2,'malformed output gets exactly one regeneration');assert.equal(h.state().phase,'ARMED');assert.equal(h.state().quality.status,'PASS');assert.equal(h.state().memory.metrics.qualityRegenerations,1)
}
async function testTrustedMetadataFactAirsAndCommitsOnce(){
  const h=createHarness({factsEnabled:true,writerText:'Track C staat op een release uit 2026. Nu gaat de muziek door.'});h.natural('A','B');await sleep(20);h.natural('B','C');await sleep(100);assert.equal(h.state().phase,'ARMED');assert.equal(h.state().brain.breakType,'TRACK_FACT');h.natural('C','D');await sleep(700);assert.equal(h.state().played,1);assert.equal(h.state().memory.usedFacts,1,'fact ID is committed only after air')
}
async function testRequestMarkerConsumedOnlyAfterSuccessfulRequestAir(){
const success=createHarness({requestTrackId:'E',writerText:'Deze is aangevraagd: Artist met Track E.'});await prepareAutomaticDue(success);assert.equal(success.state().brain.breakType,'REQUEST','request must create explicit REQUEST break');assert.equal(success.metrics.requestConsume,0,'request marker must survive preparation');success.natural('D','E');await sleep(700);assert.equal(success.state().played,1);assert.equal(success.metrics.requestConsume,1,'successful REQUEST air consumes marker exactly once');

const failed=createHarness({requestTrackId:'E',speakSucceeds:false,writerText:'Deze is aangevraagd: Artist met Track E.'});await prepareAutomaticDue(failed);assert.equal(failed.state().brain.breakType,'REQUEST');failed.natural('D','E');await sleep(800);assert.equal(failed.state().played,0);assert.equal(failed.metrics.requestConsume,0,'failed REQUEST air must preserve marker');

const ordinary=createHarness();await prepareAutomaticDue(ordinary);ordinary.natural('D','E');await sleep(700);assert.equal(ordinary.state().played,1);assert.equal(ordinary.metrics.requestConsume,0,'ordinary completed break must not consume request marker')
}
async function testTransientSpotifyContextRetriesBeforeDroppingBreak(){
  const h=createHarness({playerFailures:2});assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(650);assert.equal(h.state().phase,'ARMED',`temporary Spotify context failures should heal: ${JSON.stringify(h.state())}`);assert.equal(h.state().retries.spotifyContext,2);assert.ok(h.metrics.writer>=1,'writer wordt pas na herstelde Spotify-context aangeroepen');h.natural('A','B');await sleep(700);assert.equal(h.state().played,1)
}
async function testTransientTTSPreparationRetriesOnce(){
  const h=createHarness({prepareFailures:1});assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(500);assert.equal(h.state().phase,'ARMED',`temporary TTS failure should heal: ${JSON.stringify(h.state())}`);assert.equal(h.metrics.prepare,2);assert.equal(h.state().retries.tts,1);h.natural('A','B');await sleep(700);assert.equal(h.state().played,1)
}
async function testTrackChangeCancelsSpotifyContextBackoff(){
  const h=createHarness({playerFailures:3});assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(40);h.changed('A','B');await sleep(500);assert.equal(h.metrics.writer,0,'cancelled context must never reach writer');assert.equal(h.metrics.djPause,0);assert.equal(h.state().phase,'COUNTING')
}
async function testBfcacheReloadAbortsPreparedBreak(){
  const h=createHarness({writerDelay:220});assert.equal(h.window.MAIRDJ.armManual(),true);await sleep(30);h.window.dispatchEvent({type:'pageshow',persisted:true});await sleep(320);assert.equal(h.metrics.writerAborted,1,'bfcache/reload moet de oude writer annuleren');assert.equal(h.metrics.djPause,0);assert.equal(h.state().prepared,null);assert.equal(h.state().terminalBreaks.at(-1).status,'ABORTED_RELOAD')
}
const tests=[
  ['automatic break uses SDK-first critical path',testSuccessfulAutomaticBreak],
  ['duplicate natural event is idempotent',testDuplicateNaturalEventCannotDoubleAir],
  ['voice failure restores once without retry',testVoiceFailureRestoresOnceAndNeverRetries],
  ['manual skip cancels stale prepared break',testManualSkipCancelsPreparedBreakWithoutTouchingMusic],
  ['backgrounded break never pauses music',testBackgroundedBreakNeverPausesMusic],
  ['manual DJ airs on next natural transition',testManualDJAtNextNaturalTransition],
  ['late manual preparation rebases without stale audio',testLateManualPreparationRebasesSafely],
  ['late automatic preparation is not silently lost',testLateAutomaticPreparationIsNotLost],
  ['generic primary transport remains fallback',testWebApiFallbackStillWorks],
  ['writer failure uses safe Dutch fallback',testWriterFailureUsesSafeDutchFallback],
  ['changed next track drops stale DJ copy before pause',testChangedNextTrackDropsStaleCopyBeforePause],
  ['changed DJ profile drops prepared voice before pause',testChangedVoiceProfileDropsPreparedBreakBeforePause],
  ['stale writer response is cancelled on track change',testStaleWriterResponseIsCancelled],
  ['stale TTS response is cancelled on track change',testStaleTTSResponseIsCancelled],
  ['user override during DJ break wins over stale resume',testUserOverrideDuringBreakWins],
  ['skip cancels voice at beginning/middle/end with one playback action',testSkipCancelsVoiceAtRaceBoundaries],
  ['pause intent during DJ break suppresses automatic resume',testPauseIntentDuringBreakWins],
  ['malformed writer output regenerates exactly once',testMalformedWriterRegeneratesOnce],
  ['trusted Spotify metadata fact airs and commits once',testTrustedMetadataFactAirsAndCommitsOnce],
  ['request marker consumes only after successful REQUEST air',testRequestMarkerConsumedOnlyAfterSuccessfulRequestAir],
['transient Spotify context failure retries safely',testTransientSpotifyContextRetriesBeforeDroppingBreak],
  ['transient TTS preparation retries once',testTransientTTSPreparationRetriesOnce],
  ['track change cancels Spotify context backoff',testTrackChangeCancelsSpotifyContextBackoff],
  ['bfcache reload aborts old prepared break',testBfcacheReloadAbortsPreparedBreak],
];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,'—',e?.stack||e);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`MAIR DJ v3 behavioral simulation: ${passed}/${tests.length} PASS`);
