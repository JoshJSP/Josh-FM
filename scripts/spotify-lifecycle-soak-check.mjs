import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const coordinatorSrc=fs.readFileSync(new URL('../mair-spotify-coordinator-v2.js',import.meta.url),'utf8');
const uxSrc=fs.readFileSync(new URL('../mair-ux-state.js',import.meta.url),'utf8');
const handlers=new Map(),elements=new Map(),storage=new Map([['jfm_refresh','refresh-live']]);
for(const id of ['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild'])elements.set(id,{disabled:false});elements.set('connect',{disabled:false});elements.set('title',{textContent:'Soak Track'});elements.set('artImg',{src:'cover'});
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
let deviceSeq=0,activations=0,reconnects=0,remotePlaying=false,remoteDevice='',lastTrack='track-soak',patches=0,ingests=0;
const truth={trackId:lastTrack,uri:'spotify:track:AAAAAAAAAAAAAAAAAAAAAA',progressMs:10000,durationMs:180000,isPlaying:true,expectedLive:true,lastError:'',operation:null};
const sdk={deviceId:'device-0',player:{activateElement(){activations++}},async ensureDevice(){if(!sdk.deviceId){deviceSeq++;sdk.deviceId=`device-${deviceSeq}`;reconnects++}return sdk.deviceId},async reconnect(){deviceSeq++;sdk.deviceId=`device-${deviceSeq}`;reconnects++;return sdk.deviceId}};
const playback={health:{reloadNeedsGesture:false,failures:0,lastError:''},async ensureDevice(){return sdk.deviceId},async recover(){if(!sdk.deviceId)return false;remoteDevice=sdk.deviceId;remotePlaying=true;truth.isPlaying=true;return true},async playPause(){if(!sdk.deviceId)return false;remoteDevice=sdk.deviceId;remotePlaying=true;truth.isPlaying=true;return true},async resume(){return this.recover()},async start(){return this.recover()}};
const window={JFMAuth:{state:{hasRefreshToken:true,hasAccessToken:false},ensure:async()=> 'access'},MAIRSpotifySessionReliability:{state:{hasRefreshToken:true,hasAccessToken:false,reauthRequired:false}},JFMSpotifySDK:sdk,JFMPlayback:playback,JFMPlaybackState:{get:()=>({...truth}),patch(v){Object.assign(truth,v);patches++},ingest(v){truth.isPlaying=!!v.is_playing;truth.trackId=v.item?.id||truth.trackId;truth.lastError='';ingests++}},MAIRRuntime:{register(){}},MAIRDJ:{diagnostics:()=>({phase:'COUNTING'})},MAIRDJCadenceFix:{remaining:()=>3},MAIRStationPolicy:{label:()=> 'Hits'},api:async path=>path==='/me/player'&&remotePlaying?{item:{id:lastTrack,name:'Soak Track',artists:[]},device:{id:remoteDevice},is_playing:true,progress_ms:12000}:null,addEventListener:(n,fn)=>handlers.set(n,[...(handlers.get(n)||[]),fn]),dispatchEvent:e=>{for(const fn of handlers.get(e.type)||[])fn(e);return true},playback:null};
const document={visibilityState:'visible',hidden:false,body:{dataset:{}},getElementById:id=>elements.get(id)||null,addEventListener:(n,fn)=>handlers.set(n,[...(handlers.get(n)||[]),fn])};
const context={window,document,navigator:{onLine:true},localStorage,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},setTimeout:()=>1,setInterval:()=>1,clearInterval:()=>{},requestAnimationFrame:fn=>fn(),Promise,Date,String,Number,Math,Set,console};vm.createContext(context);vm.runInContext(coordinatorSrc,context);vm.runInContext(uxSrc,context);
const state=()=>window.MAIRUXState.get();
for(let cycle=1;cycle<=60;cycle++){
  // Simulate iOS discarding the ephemeral Web Playback device while auth remains valid.
  sdk.deviceId='';remoteDevice='';remotePlaying=false;truth.isPlaying=false;truth.expectedLive=true;truth.lastError='Spotify-device is niet beschikbaar';playback.health.lastError=truth.lastError;
  let before=state();assert.equal(before.spotifyConnection.connected,true,`cycle ${cycle}: valid auth must stay connected`);assert.equal(before.appState,'RECOVERING',`cycle ${cycle}: missing device must be recovery`);assert.equal(before.recoverableError?.primaryAction,'device',`cycle ${cycle}: recovery must stay local`);assert.notEqual(before.recoverableError?.primaryAction,'reconnect');
  if(cycle%7===0){window.MAIRSpotifySessionReliability.state={hasRefreshToken:true,hasAccessToken:false,reauthRequired:false};window.JFMAuth.state={hasRefreshToken:true,hasAccessToken:false}}
  if(cycle%5===0)playback.health.reloadNeedsGesture=true;
  const ok=await window.MAIRSpotifyCoordinator.recoverFromGesture(`soak-${cycle}`);assert.equal(ok,true,`cycle ${cycle}: foreground gesture recovery must succeed`);playback.health.reloadNeedsGesture=false;playback.health.lastError='';
  const after=state();assert.equal(after.spotifyConnection.connected,true,`cycle ${cycle}: auth remains connected after repair`);assert.equal(after.appState,'PLAYING',`cycle ${cycle}: playback returns live`);assert.equal(after.recoverableError,null,`cycle ${cycle}: stale error card must clear`);assert.ok(sdk.deviceId,`cycle ${cycle}: live SDK device restored`)
}
assert.ok(reconnects>=60,'each simulated iOS device loss must create a fresh live device');assert.ok(activations>=60,'user recovery path must activate browser audio each time');assert.ok(patches>=60&&ingests>=60,'recovery must refresh canonical playback truth repeatedly');
// One definitive authorization revocation is the only scenario allowed to request reconnect.
window.MAIRSpotifySessionReliability.state={hasRefreshToken:false,hasAccessToken:false,reauthRequired:true};window.JFMAuth.state={hasRefreshToken:false,hasAccessToken:false};storage.delete('jfm_refresh');sdk.deviceId='';truth.isPlaying=false;truth.expectedLive=true;
const revoked=state();assert.equal(revoked.recoverableError?.diagnosticsCode,'SPOTIFY_REAUTH_REQUIRED');assert.equal(revoked.recoverableError?.primaryAction,'reconnect');
console.log(`Spotify lifecycle soak: PASS — 60 device-loss recoveries, ${reconnects} devices rebuilt, stale UI errors cleared`);
