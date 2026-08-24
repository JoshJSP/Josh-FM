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

function element(id,elements){return{id,textContent:'',disabled:true,dataset:{},style:{},addEventListener(){},closest(){return null},cloneNode(){return element(id,elements)},replaceWith(next){elements[id]=next}}}
async function testPrimarySingletonAndNaturalEnd(){
  const bus=new Events(),docBus=new Events(),elements={};for(const id of ['start','play','next','prev','queueInfo'])elements[id]=element(id,elements);
  const localStorage=storage({jfm_spotify_device_id:'device-1'}),metrics={intervals:0,play:0,pauseSdk:0,resumeSdk:0,previous:0},remote={item:{id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'},device:{id:'device-1'},is_playing:false,progress_ms:0};let remoteVisible=true,sdkPlaying=false;
  const player={getCurrentState:async()=>({paused:!sdkPlaying,position:0,track_window:{current_track:{uri:remote.item.uri}}}),activateElement(){},async pause(){metrics.pauseSdk++;sdkPlaying=false},async resume(){metrics.resumeSdk++;sdkPlaying=true}};
  const api=async(path,opt={})=>{if(path==='/me/player')return remoteVisible?structuredClone(remote):null;if(path.startsWith('/me/player/play?')){metrics.play++;remote.item={id:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB'};remote.is_playing=true;remote.progress_ms=0;return null}if(path.startsWith('/me/player/previous?')){metrics.previous++;if(remote.progress_ms>3000)remote.progress_ms=0;else{remote.item={id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'};remote.progress_ms=0}return null}throw Error(`Unexpected API ${path} ${opt.method||'GET'}`)};
  const context={window:null,document:{visibilityState:'visible',body:{getAttribute:()=>null},getElementById:id=>elements[id]||null,addEventListener:(...args)=>docBus.addEventListener(...args)},localStorage,CustomEvent:FakeCustomEvent,api,queue:[{id:'A',uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA'},{id:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB'}],playback:null,renderPlayback(){},setTimeout:fn=>{queueMicrotask(fn);return 1},setInterval:()=>{metrics.intervals++;return 1},Promise,Date,Math,console};
  Object.assign(context,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:(...args)=>bus.dispatchEvent(...args),jfmSpotifyPlayer:player,JFMSpotifySDK:{deviceId:'device-1',ensureDevice:async()=> 'device-1'},JFMPlaybackState:{get:()=>({expectedLive:true}),ingest(){},setExpectedLive(){},error(){}}});context.window=context;
  vm.createContext(context);const source=read('playback-primary.js');vm.runInContext(source,context,{filename:'playback-primary.js'});vm.runInContext(source,context,{filename:'playback-primary-duplicate.js'});
  assert.equal(bus.count('jfm:natural-track-end'),1,'duplicate script execution must not add a second natural-end listener');assert.equal(metrics.intervals,1,'duplicate script execution must not add a second watchdog');
  bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));bus.dispatchEvent(new FakeCustomEvent('jfm:natural-track-end',{detail:{trackId:'A'}}));await sleep(20);
  assert.equal(metrics.play,1,'duplicate natural-end events must advance only once');assert.equal(remote.item.id,'B');
  remote.is_playing=true;sdkPlaying=true;remoteVisible=false;await context.JFMPlayback.playPause();assert.equal(metrics.pauseSdk,1,'an empty Web API status must use the playing SDK state and pause, never restart');assert.equal(metrics.play,1,'pause fallback must not restart the queue');
  remoteVisible=true;remote.is_playing=true;await context.JFMPlayback.playPause();assert.equal(metrics.resumeSdk,1,'a stale playing Web API state must not override the paused local SDK state');
  remote.item={id:'B',uri:'spotify:track:BBBBBBBBBBBBBBBBBBBBBB'};remote.progress_ms=6000;remote.is_playing=true;sdkPlaying=true;await context.JFMPlayback.previous();assert.equal(metrics.previous,2,'previous after three seconds must immediately reset and then select the prior track');assert.equal(remote.item.id,'A');
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

const tests=[['auth refresh single-flight, timeout and 401 retry',testAuthSingleFlightAndRetry],['primary singleton and natural-end idempotency',testPrimarySingletonAndNaturalEnd],['Spotify SDK singleton',testSdkSingleton],['runtime-ready reentrancy guard',testRuntimeReadyIsNotRecursive],['iOS transport delegates to primary',testIosTransportDelegatesToPrimary]];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(error){console.error('FAIL',name,'—',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`Playback package 1: ${passed}/${tests.length} PASS`);
