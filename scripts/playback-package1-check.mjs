import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class Events{
  constructor(){this.listeners=new Map()}
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
  count(name){return(this.listeners.get(name)||[]).length}
}
class FakeCustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}

function storage(initial={}){const values=new Map(Object.entries(initial));return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}}
function response(status,data=null,headers={}){return{ok:status>=200&&status<300,status,headers:{get:name=>headers[name]??headers[name.toLowerCase()]??null},json:async()=>data}}

async function testAuthSingleFlightAndRetry(){
  const prefix=read('app.js').split('function talkPlan()')[0],localStorage=storage({jfm_refresh:'refresh-1',jfm_client_id:'client-1',jfm_exp:'0'}),sessionStorage=storage();
  const elements={redirect:{value:''},clientId:{value:'',closest:()=>null}};let calls=[];
  let fetchImpl=async(url,opt)=>{calls.push({url,opt});await sleep(15);return response(200,{access_token:'access-1',refresh_token:'refresh-1',expires_in:3600})};
  const context={document:{getElementById:id=>elements[id]},localStorage,sessionStorage,location:{origin:'https://mair.test',pathname:'/',search:''},history:{replaceState(){}},fetch:(...args)=>fetchImpl(...args),AbortController,URLSearchParams,setTimeout,clearTimeout,Date,Error,console};
  context.window=context;vm.createContext(context);vm.runInContext(prefix,context,{filename:'app-auth.js'});context.restore();
  const tokens=await Promise.all([context.JFMAuth.ensure(),context.JFMAuth.ensure(),context.JFMAuth.ensure()]);
  assert.deepEqual(tokens,['access-1','access-1','access-1']);assert.equal(calls.length,1,'concurrent callers must share one refresh request');assert.equal(context.JFMAuth.state.refreshCount,1);
  calls=[];let apiAttempt=0;fetchImpl=async(url,opt)=>{calls.push({url,opt});if(String(url).includes('accounts.spotify.com'))return response(200,{access_token:'access-2',refresh_token:'refresh-1',expires_in:3600});apiAttempt++;return apiAttempt===1?response(401,{error:{message:'expired'}}):response(200,{id:'ok'})};
  const data=await context.api('/me');assert.equal(data.id,'ok');assert.equal(apiAttempt,2,'a 401 must retry the Spotify request exactly once');assert.equal(calls.filter(x=>String(x.url).includes('accounts.spotify.com')).length,1);assert.match(calls.at(-1).opt.headers.Authorization,/access-2/);
  fetchImpl=async(_url,opt)=>new Promise((_resolve,reject)=>opt.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));
  await assert.rejects(()=>context.timedFetch('/slow',{},10),/duurde te lang/);
}

function element(id,elements){return{id,textContent:'',disabled:true,dataset:{},style:{},attributes:{},setAttribute(k,v){this.attributes[k]=String(v)},removeAttribute(k){delete this.attributes[k]},addEventListener(){},closest(){return null},cloneNode(){return element(id,elements)},replaceWith(next){elements[id]=next}}}
async function testPrimarySingletonAndNaturalEnd(){
  const bus=new Events(),docBus=new Events(),elements={};for(const id of ['start','play','next','prev','queueInfo'])elements[id]=element(id,elements);
  const localStorage=storage({jfm_spotify_device_id:'device-1'}),sessionStorage=storage({jfm_playback_truth_v1:JSON.stringify({trackId:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB',progressMs:42000,durationMs:240000,isPlaying:false,expectedLive:true,intent:'dj-handoff',operation:{id:9,type:'dj-handoff',expiresAt:Date.now()+50000},deviceId:'stale-page-device',updatedAt:Date.now()})}),metrics={intervals:0,watchdog:null,play:0,transfer:0,pauseSdk:0,resumeSdk:0,previous:0,previousSdk:0},remote={item:{id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'},device:{id:'device-1'},is_playing:false,progress_ms:0};let remoteVisible=true,sdkPlaying=false,allowResume=true;
  const player={getCurrentState:async()=>({paused:!sdkPlaying,position:remote.progress_ms,track_window:{current_track:{id:remote.item.id,uri:remote.item.uri,duration_ms:remote.item.duration_ms||240000}}}),activateElement(){},async pause(){metrics.pauseSdk++;sdkPlaying=false},async resume(){metrics.resumeSdk++;if(allowResume)sdkPlaying=true},async seek(position){remote.progress_ms=position},async previousTrack(){metrics.previousSdk++;remote.item={id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'};remote.progress_ms=0}};
  const api=async(path,opt={})=>{if(path==='/me/player'&&opt.method==='PUT'){metrics.transfer++;remote.device={id:opt.body.device_ids[0]};remote.is_playing=!!opt.body.play;return null}if(path==='/me/player')return remoteVisible?structuredClone(remote):null;if(path.startsWith('/me/player/play?')){metrics.play++;const uri=opt.body?.uris?.[0]||'spotify:track:BBBBBBBBBBBBBBBBBBBBBB';remote.item={id:uri.split(':').pop()==='BBBBBBBBBBBBBBBBBBBBBB'?'B':uri.split(':').pop(),uri};remote.is_playing=true;remote.progress_ms=Number(opt.body?.position_ms||0);remote.device={id:'device-1'};return null}if(path.startsWith('/me/player/previous?')){metrics.previous++;if(remote.progress_ms>3000)remote.progress_ms=0;else{remote.item={id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'};remote.progress_ms=0}return null}throw Error(`Unexpected API ${path} ${opt.method||'GET'}`)};
  const context={window:null,document:{visibilityState:'visible',body:{getAttribute:()=>null},getElementById:id=>elements[id]||null,addEventListener:(...args)=>docBus.addEventListener(...args)},localStorage,sessionStorage,CustomEvent:FakeCustomEvent,api,queue:[{id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'},{id:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB'}],playback:null,renderPlayback(){},setTimeout:fn=>{queueMicrotask(fn);return 1},setInterval:fn=>{metrics.intervals++;metrics.watchdog=fn;return 1},Promise,Date,Math,console};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),jfmSpotifyPlayer:player,JFMSpotifySDK:{deviceId:'device-1',ensureDevice:async()=> 'device-1'},JFMPlaybackState:{get:()=>({expectedLive:true,isPlaying:true,trackId:remote.item?.id||'',uri:remote.item?.uri||'',progressMs:remote.progress_ms||0,durationMs:remote.item?.duration_ms||0}),shouldRecover:()=>false,ingest(){},setExpectedLive(){},error(){}}});context.window=context;
  vm.createContext(context);const source=read('playback-primary.js');vm.runInContext(source,context,{filename:'playback-primary.js'});vm.runInContext(source,context,{filename:'playback-primary-duplicate.js'});
  assert.equal(bus.count('jfm:natural-track-end'),1,'duplicate script execution must not add a second natural-end listener');assert.equal(metrics.intervals,1,'duplicate script execution must not add a second watchdog');
  bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));await sleep(20);
  assert.equal(metrics.play,1,'duplicate natural-end events must advance only once');assert.equal(remote.item.id,'B');
  remote.is_playing=true;sdkPlaying=true;remoteVisible=false;await context.JFMPlayback.playPause();assert.equal(metrics.pauseSdk,1,'an empty Web API status must use the playing SDK state and pause, never restart');assert.equal(metrics.play,1,'pause fallback must not restart the queue');
  remoteVisible=true;remote.is_playing=true;const resumesBeforeToggle=metrics.resumeSdk;await context.JFMPlayback.playPause();assert.equal(metrics.resumeSdk,resumesBeforeToggle+1,'a stale playing Web API state must not override the paused local SDK state');
  remote.item={id:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB'};remote.progress_ms=6000;remote.is_playing=true;sdkPlaying=true;await context.JFMPlayback.previous();assert.equal(metrics.previous,1,'previous after three seconds must issue one immediate reset');assert.equal(metrics.previousSdk,1,'the local SDK must select the prior track before Spotify can coalesce a second Web API call');assert.equal(remote.item.id,'A');
  remote.item={id:'C',uri:'spotify:track:CCCCCCCCCCCCCCCCCCCCCC'};remote.progress_ms=0;remote.is_playing=false;remote.device={id:'stale-page-device'};sdkPlaying=false;allowResume=false;const playsBeforeRecover=metrics.play,transfersBeforeRecover=metrics.transfer,handoversBeforeRecover=context.JFMPlayback.health.deviceHandovers,failuresBeforeRecover=context.JFMPlayback.health.failures;assert.equal(await context.JFMPlayback.recover('reload-test'),false);assert.equal(metrics.transfer,transfersBeforeRecover+1,'reload recovery must hand playback to the current browser SDK device');assert.equal(metrics.play,playsBeforeRecover+1,'a stale paused SDK context must be replaced by the persisted live track');assert.equal(context.JFMPlayback.health.reloadNeedsGesture,true,'blocked autoplay must request one explicit play gesture');assert.equal(context.JFMPlayback.health.failures,failuresBeforeRecover,'browser autoplay policy must not count as a playback failure');allowResume=true;assert.equal(await context.JFMPlayback.playPause(),true,'the explicit play gesture must finish the exact restore');assert.equal(metrics.play,playsBeforeRecover+2,'the gesture restore must retry the exact URI');assert.equal(remote.item.id,'B','reload recovery must restore the intended track');assert.ok(remote.progress_ms>=42000,'reload recovery must preserve or advance playback position');assert.equal(remote.is_playing,true,'an active radio must remain playing through exact reload restore');assert.equal(context.JFMPlayback.health.deviceHandovers,handoversBeforeRecover+1,'device handovers must be visible in diagnostics');assert.equal(context.JFMPlayback.health.reloadRestores,1,'exact reload restores must be visible in diagnostics');assert.equal(context.JFMPlayback.health.reloadNeedsGesture,false,'successful gesture restore must clear the autoplay prompt');
  const playsBeforeEndedRecovery=metrics.play;remote.item={id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA',duration_ms:240000};remote.progress_ms=239000;remote.is_playing=false;remote.device={id:'device-1'};sdkPlaying=false;assert.equal(await context.JFMPlayback.recover('foreground-return'),true,'foreground recovery must recognize a track that ended while browser events were suspended');assert.equal(metrics.play,playsBeforeEndedRecovery+1,'ended foreground recovery must advance exactly once');assert.equal(remote.item.id,'B');
  const playsBeforeWatchdog=metrics.play;remote.item={id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA',duration_ms:240000};remote.progress_ms=239000;remote.is_playing=false;sdkPlaying=false;await metrics.watchdog();assert.equal(metrics.play,playsBeforeWatchdog+1,'SDK watchdog must recover one missed ended event without a duplicate skip');assert.equal(remote.item.id,'B');
}

async function testSdkSingleton(){
  const bus=new Events(),localStorage=storage(),sessionStorage=storage();let constructors=0;
  class Player{constructor(){constructors++;this.listeners=new Map()}addListener(name,fn){this.listeners.set(name,fn)}async connect(){this.listeners.get('ready')?.({device_id:'device-1'});return true}disconnect(){}}
  const elements={queueInfo:{textContent:'',style:{}},status:{classList:{toggle(){}},textContent:''}};
  const context={window:null,document:{getElementById:id=>elements[id]||null,head:{appendChild(){}},createElement:()=>({})},localStorage,sessionStorage,location:{search:'',pathname:'/'},history:{replaceState(){}},URLSearchParams,CustomEvent:FakeCustomEvent,spotifyClientId:'client',ensure:async()=> 'token',timedFetch:async()=>response(200,{}),api:async()=>({devices:[{id:'device-1',is_restricted:false}]}),setConnected(){},renderPlayback(){},playback:null,token:'token',refreshToken:'refresh',saveToken(){},setTimeout:(fn,ms)=>ms<250?setTimeout(fn,ms):1,clearTimeout(){},setInterval,clearInterval,Promise,Date,console,Spotify:{Player}};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),JFMPlaybackState:{patch(){},ingest(){}}});context.window=context;
  vm.createContext(context);const source=read('stability-core.js');vm.runInContext(source,context,{filename:'stability-core.js'});vm.runInContext(source,context,{filename:'stability-core-duplicate.js'});
  const ids=await Promise.all([context.JFMSpotifySDK.init(),context.JFMSpotifySDK.init()]);assert.deepEqual(ids,['device-1','device-1']);assert.equal(constructors,1,'concurrent init and duplicate script execution must create one Spotify.Player');assert.equal(bus.count('pageshow'),1);
}

function testRuntimeReadyIsNotRecursive(){
  const bus=new Events(),localStorage=storage();let readyEvents=0,channelEvents=0;
  bus.addEventListener('mair:runtime-ready',()=>{readyEvents++;channelEvents++;bus.dispatchEvent(new FakeCustomEvent('mair:channelchange',{detail:{id:'mix'}}))});
  const context={window:null,localStorage,CustomEvent:FakeCustomEvent,setTimeout(){},console};Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args)});context.window=context;
  vm.createContext(context);vm.runInContext(read('mair-runtime-core.js'),context,{filename:'mair-runtime-core.js'});context.MAIRRuntime.refresh();
  assert.equal(readyEvents,1,'runtime-ready must not synchronously re-emit itself through channelchange');assert.equal(channelEvents,1);
}

function testIosTransportDelegatesToPrimary(){
  const source=read('ios-transport-v2b02.js');
  assert.ok(!source.includes("addEventListener('click'"),'iOS shim must not intercept the play button');
  assert.ok(!source.includes("window.api('/me/player"),'iOS shim must not own Spotify Web API transport');
  const calls=[];const context={window:null,Promise,JFMPlayback:{primary:true,playPause:(...args)=>{calls.push(['playPause',...args]);return true},pause:()=>{calls.push(['pause']);return true},resume:()=>{calls.push(['resume']);return true},health:{busy:false}}};context.window=context;
  vm.createContext(context);vm.runInContext(source,context,{filename:'ios-transport-v2b02.js'});
  return Promise.all([context.JFMIOSV2B02.toggle(),context.JFMIOSV2B02.pause(),context.JFMIOSV2B02.resume()]).then(()=>assert.deepEqual(calls.map(x=>x[0]),['playPause','pause','resume']));
}

function testReloadedTruthRequiresFreshConfirmation(){
  const sessionStorage=storage({jfm_playback_truth_v1:JSON.stringify({trackId:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA',isPlaying:false,expectedLive:true,intent:'dj-handoff',operation:{id:4,type:'dj-handoff',expiresAt:Date.now()+99999}})}),bus=new Events(),context={window:null,sessionStorage,CustomEvent:FakeCustomEvent,Date,console};Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args)});context.window=context;vm.createContext(context);vm.runInContext(read('playback-state.js'),context,{filename:'playback-state.js'});const state=context.JFMPlaybackState.get();assert.equal(state.trackId,'A');assert.equal(state.expectedLive,true);assert.equal(state.isPlaying,false,'a reloaded page may not trust persisted audible playback');assert.equal(state.operation,null,'refresh during a DJ handoff must clear the stale transport lock');assert.equal(context.JFMPlaybackState.shouldRecover(),true,'refresh during DJ must make music eligible for recovery')
}

function testTransientSdkErrorsHeal(){const source=read('stability-core.js'),primary=read('playback-primary.js');assert.ok(source.includes('playbackErrorTimer')&&source.includes("message('MAIR speelt.')"),'a transient SDK playback error must clear after confirmed playing state');assert.ok(source.includes('state?.isPlaying')&&source.includes('state.updatedAt'),'delayed playback errors must consult recent central playback truth');assert.ok(primary.includes("if(playing){if(state)ingest(state,'primary-resume-already')")&&primary.includes("info('MAIRFM speelt.')"),'a confirmed already-playing state must replace a stale playback error');assert.ok(primary.includes('if(playing===null)return startDirect()'),'the visible play control must cold-start MAIR when Spotify has no active status');assert.ok(primary.includes('nudgeSdkPlayback')&&primary.includes('player()?.resume?.()'),'a Web API start must also nudge the audible browser SDK inside the user gesture');assert.ok(primary.includes('uris:[intent.uri]')&&primary.includes("'jfm:reload-context-restored'"),'reload recovery must atomically restore one exact URI before reseeding the queue');assert.ok(primary.includes('p.seek(position)')&&primary.includes('Math.abs(Number(stable.position||0)-position)<8000'),'reload recovery must confirm the audible SDK track and position before completing');assert.ok(primary.includes('restoreReloadPlayback')&&primary.includes('reloadRestores'),'reload recovery must restore exact persisted context when Spotify exposes a stale paused SDK track')}
function testSkipCancelTransactionWiring(){const primary=read('playback-primary.js'),dj=read('mair-dj-v2.js'),voice=read('mair-voice-engine.js'),tts=read('debug-tts.js'),skip=primary.slice(primary.indexOf('async function skip(delta)'),primary.indexOf('async function handleNaturalEnd'));assert.equal((skip.match(/cancelActive\(/g)||[]).length,1,'skip invokes one DJ cancel transaction');assert.ok(skip.indexOf('cancelActive(cause)')<skip.indexOf("markTransitionAction('NEXT')"),'voice cancel completes before the Next action');assert.equal((skip.match(/advance\(\{record:true,source:'primary-next'/g)||[]).length,1,'Next owns exactly one playback action');assert.ok(dj.includes('async function cancelActive')&&dj.includes('pack.voiceController?.abort')&&dj.includes('if(paused&&uri&&!pack.userOverride)'),'DJ cancellation must abort voice and suppress stale recovery resume');assert.ok(voice.includes('async function cancel(')&&tts.includes('function cancelPlayback(')&&tts.includes('activePlayback.cancel'),'voice layers expose a real active-audio stop path')}

// --- C-2: natuurlijke-einde-detectie, resume guard en tolerante bijvulronde ---

function sdkHarness(){
  const bus=new Events(),ends=[],listeners=new Map(),localStorage=storage(),sessionStorage=storage();
  bus.addEventListener('jfm:natural-track-end',e=>ends.push(e.detail));
  class Player{constructor(){this.listeners=listeners}addListener(name,fn){listeners.set(name,fn)}async connect(){listeners.get('ready')?.({device_id:'device-1'});return true}disconnect(){}}
  const elements={queueInfo:{textContent:'',style:{}},status:{classList:{toggle(){}},textContent:''}};
  const context={window:null,document:{getElementById:id=>elements[id]||null,head:{appendChild(){}},createElement:()=>({})},localStorage,sessionStorage,location:{search:'',pathname:'/'},history:{replaceState(){}},URLSearchParams,CustomEvent:FakeCustomEvent,spotifyClientId:'client',ensure:async()=>'token',timedFetch:async()=>response(200,{}),api:async()=>({devices:[{id:'device-1',is_restricted:false}]}),setConnected(){},renderPlayback(){},playback:null,token:'token',refreshToken:'refresh',saveToken(){},setTimeout:(fn,ms)=>ms<250?setTimeout(fn,ms):1,clearTimeout(){},setInterval:()=>1,clearInterval(){},Promise,Date,console,Spotify:{Player}};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),JFMPlaybackState:{patch(){},ingest(){}}});
  context.window=context;vm.createContext(context);vm.runInContext(read('stability-core.js'),context,{filename:'stability-core.js'});
  return{context,ends,listeners};
}

async function testSdkContextResetEndDetection(){
  const{context,ends,listeners}=sdkHarness();
  await context.JFMSpotifySDK.init();
  const onState=listeners.get('player_state_changed'),onNotReady=listeners.get('not_ready');
  assert.equal(typeof onState,'function','the SDK must expose a player_state_changed listener');
  const DURATION=240000;
  const state=(id,position,paused)=>({paused,position,track_window:{current_track:{id,uri:'spotify:track:'+id.repeat(22).slice(0,22),duration_ms:DURATION,artists:[],album:{name:'',images:[]}}}});

  // (a) vorige observatie speelde binnen 3,5s van het einde, nieuwe state is paused op 0.
  onState(state('A',238800,false));onState(state('A',0,true));
  assert.equal(ends.length,1,'a context reset after a near-end observation must signal one natural end');
  assert.equal(ends[0].trackId,'A');
  assert.equal(ends[0].source,'sdk-context-reset');
  assert.equal(ends[0].positionMs,DURATION,'a collapsed position must be reported as the reached end so transition classification accepts the evidence');

  // dezelfde teruggeklapte state mag niet nog een keer melden
  onState(state('A',0,true));
  assert.equal(ends.length,1,'a repeated collapsed state must not signal a second natural end');

  // (b) pauze door de gebruiker midden in een nummer is nooit een natuurlijk einde
  ends.length=0;onState(state('B',60000,false));onState(state('B',60000,true));
  assert.equal(ends.length,0,'a user pause mid-track must never count as a natural end');

  // (b2) pauze vlak voor het einde behoudt zijn positie en blijft dus een gebruikerspauze
  ends.length=0;onState(state('C',237000,false));onState(state('C',237000,true));
  assert.equal(ends.length,0,'a pause that keeps its position is a user pause, not a context reset');

  // (c) device-overdracht (Spotify Connect) mag geen einde worden
  ends.length=0;onState(state('D',239000,false));onNotReady({device_id:'device-1'});onState(state('D',0,true));
  assert.equal(ends.length,0,'a device handover must clear the near-end observation instead of ending the track');

  // het bestaande pad (paused op de duur) blijft werken
  ends.length=0;onState(state('E',239500,false));onState(state('E',239500,true));
  assert.equal(ends.length,1,'a track paused at its duration must still signal a natural end');
  assert.equal(ends[0].source,'sdk-paused-end');
}

function primaryHarness({tracks=['A','B'],nextWorks=true}={}){
  const bus=new Events(),docBus=new Events(),elements={};for(const id of ['start','play','next','prev','queueInfo'])elements[id]=element(id,elements);
  const metrics={next:0,play:0,resumeSdk:0,watchdog:null};
  const queue=tracks.map(id=>({id,uri:'spotify:track:'+id.repeat(22).slice(0,22)}));
  const remote={item:{id:tracks[0],uri:queue[0].uri,duration_ms:240000},device:{id:'device-1'},is_playing:false,progress_ms:0};
  const player={getCurrentState:async()=>({paused:!remote.is_playing,position:remote.progress_ms,track_window:{current_track:{id:remote.item.id,uri:remote.item.uri,duration_ms:remote.item.duration_ms}}}),activateElement(){},async pause(){remote.is_playing=false},async resume(){metrics.resumeSdk++},async seek(){},async nextTrack(){},async previousTrack(){}};
  const api=async(path,opt={})=>{
    if(path==='/me/player'&&opt.method==='PUT')return null;
    if(path==='/me/player')return structuredClone(remote);
    if(path.startsWith('/me/player/next')){metrics.next++;if(nextWorks&&queue[1]){remote.item={id:queue[1].id,uri:queue[1].uri,duration_ms:240000};remote.is_playing=true;remote.progress_ms=0}return null}
    if(path.startsWith('/me/player/play?')){metrics.play++;return null}
    throw Error('Unexpected API '+path+' '+(opt.method||'GET'));
  };
  const truth={expectedLive:true,isPlaying:false,trackId:tracks[0],uri:queue[0].uri,progressMs:0,durationMs:240000};
  const context={window:null,document:{visibilityState:'visible',body:{getAttribute:()=>null},getElementById:id=>elements[id]||null,addEventListener:(...args)=>docBus.addEventListener(...args)},localStorage:storage({jfm_spotify_device_id:'device-1'}),sessionStorage:storage(),CustomEvent:FakeCustomEvent,api,queue,playback:null,renderPlayback(){},setTimeout:(fn,ms=0)=>{if(Number(ms)<=1000)queueMicrotask(fn);return 1},setInterval:(fn)=>{metrics.watchdog=fn;return 1},Promise,Date,Math,console};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),jfmSpotifyPlayer:player,JFMSpotifySDK:{deviceId:'device-1',ensureDevice:async()=>'device-1'},JFMPlaybackState:{get:()=>({...truth,trackId:remote.item?.id||truth.trackId,isPlaying:!!remote.is_playing}),shouldRecover:()=>!remote.is_playing,ingest(){},setExpectedLive(){},error(){}}});
  context.window=context;vm.createContext(context);vm.runInContext(read('playback-primary.js'),context,{filename:'playback-primary.js'});
  return{context,metrics,remote,bus};
}

async function testResumeGuardStopsRepeatOfSameTrack(){
  const{context,metrics,remote}=primaryHarness();
  assert.equal(await context.JFMPlayback.recover('watchdog'),false,'a failed resume must report failure');
  assert.equal(metrics.next,0,'the first failed resume must never skip the track');
  assert.ok(metrics.resumeSdk>0,'the first attempt must actually try to resume');
  assert.equal(context.JFMPlayback.health.resumeGuard.attempts,1);
  assert.equal(await context.JFMPlayback.recover('watchdog'),true,'a second stuck resume must be recovered by one controlled advance');
  assert.equal(metrics.next,1,'a repeatedly stuck track must advance exactly once');
  assert.equal(remote.item.id,'B','the controlled advance must reach the next station track');
  assert.equal(context.JFMPlayback.health.resumeGuard.advances,1);
  assert.equal(await context.JFMPlayback.recover('watchdog'),true,'a healthy playing state needs no further action');
  assert.equal(metrics.next,1,'a recovered radio must not keep skipping');
}

async function testResumeGuardAdvancesOnlyOncePerTrack(){
  const{context,metrics}=primaryHarness({tracks:['A'],nextWorks:false});
  for(let i=0;i<4;i++)await context.JFMPlayback.recover('watchdog');
  assert.equal(metrics.next,1,'a stuck track without a reachable next track must be advanced at most once, never in a loop');
  assert.equal(context.JFMPlayback.health.resumeGuard.advancedTrackId,'A','the guard must remember which track it already advanced past');
  assert.equal(context.JFMPlayback.health.resumeGuard.advances,0,'a failed advance must not be counted as recovered');
}

async function testContextEndWithoutNextTrack(){
  const{context,metrics,bus}=primaryHarness({tracks:['A'],nextWorks:false});
  const failuresBefore=context.JFMPlayback.health.failures;
  bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));
  await sleep(30);
  assert.equal(metrics.next,1,'a context end without a next track must be attempted exactly once');
  assert.equal(context.JFMPlayback.health.failures,failuresBefore+1,'an unreachable next track must surface as one visible failure');
  bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));
  await sleep(30);
  assert.equal(metrics.next,1,'the same ended track must not be retried inside the dedupe window');
}

const stationUri=n=>'spotify:track:'+String(n).padStart(22,'0');
function stationQueueHarness(failFor,message){
  const bus=new Events(),elements={queueInfo:{textContent:'',style:{}}},posted=[];
  const tracks=[];for(let i=1;i<=40;i++)tracks.push({id:'t'+i,uri:'spotify:track:'+String(i).padStart(22,'0'),name:'Track '+i,artists:['Artist '+i]});
  const api=async(path,opt={})=>{
    if(path==='/me/player/queue'&&!opt.method)return{queue:[]};
    if(path.startsWith('/me/player/queue?uri=')){const uri=decodeURIComponent(path.split('uri=')[1].split('&')[0]);posted.push(uri);if(failFor==='*'||uri===failFor)throw Error(message);return null}
    throw Error('Unexpected API '+path);
  };
  const context={window:null,document:{getElementById:id=>elements[id]||null},localStorage:storage({jfm_music_channel_v1:'mix',jfm_spotify_device_id:'device-1'}),sessionStorage:storage(),CustomEvent:FakeCustomEvent,api,queue:tracks,playback:{item:{id:'t26'}},setTimeout:(fn,ms=0)=>{if(Number(ms)<=200)queueMicrotask(fn);return 1},clearTimeout(){},setInterval:()=>1,clearInterval(){},Promise,Date,Math,JSON,console};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),JFMQueue:{current:()=>context.queue},JFMPlaybackState:{get:()=>({trackId:'t26'})}});
  context.window=context;vm.createContext(context);vm.runInContext(read('station-queue.js'),context,{filename:'station-queue.js'});
  return{context,posted,tracks};
}

async function testTolerantQueueAppend(){
  // een enkele geweigerde track stopt de bijvulronde niet
  const one=stationQueueHarness(stationUri(33),'Spotify fout 403');
  assert.equal(await one.context.JFMStationQueue.maintain('test'),true);
  assert.equal(one.posted.length,10,'every track in the window must still be attempted after one refusal');
  assert.equal(one.context.JFMStationQueue.state().appended.length,9,'nine of ten tracks must reach the Spotify queue');
  assert.ok(one.posted.includes(stationUri(40)),'tracks after the refused one must still be queued');

  // rate limit is wel fataal: doorgaan zou de fout alleen vermenigvuldigen
  const rate=stationQueueHarness(stationUri(31),'Spotify vraagt ons even rustiger aan te doen. Probeer over 3 sec opnieuw.');
  assert.equal(await rate.context.JFMStationQueue.maintain('test'),false);
  assert.equal(rate.posted.length,1,'a rate limit must stop the round immediately');
  const rateLog=(rate.context.JFMStationQueueLog||[]).find(x=>x.stage==='append-error');
  assert.equal(rateLog?.fatal,true,'a rate limit must be traced as fatal');

  // structureel falen stopt na een klein budget in plaats van alles te proberen
  const broken=stationQueueHarness('*','Spotify fout 500');
  assert.equal(await broken.context.JFMStationQueue.maintain('test'),false);
  assert.equal(broken.posted.length,3,'repeated failures must stop the round after a small budget');
}

const tests=[['auth refresh single-flight, timeout and 401 retry',testAuthSingleFlightAndRetry],['primary singleton and natural-end idempotency',testPrimarySingletonAndNaturalEnd],['Spotify SDK singleton',testSdkSingleton],['runtime-ready reentrancy guard',testRuntimeReadyIsNotRecursive],['iOS transport delegates to primary',testIosTransportDelegatesToPrimary],['reloaded playback truth requires fresh confirmation',testReloadedTruthRequiresFreshConfirmation],['transient SDK errors heal after confirmed playback',testTransientSdkErrorsHeal],['skip voice cancel transaction owns exactly one playback action',testSkipCancelTransactionWiring],['SDK context reset is recognised as a natural end',testSdkContextResetEndDetection],['resume guard advances a stuck track exactly once',testResumeGuardStopsRepeatOfSameTrack],['resume guard never loops on the same track',testResumeGuardAdvancesOnlyOncePerTrack],['context end without a next track fails once and visibly',testContextEndWithoutNextTrack],['queue append survives a single refused track',testTolerantQueueAppend]];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(error){console.error('FAIL',name,'—',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`Playback package 1: ${passed}/${tests.length} PASS`);
