import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../mair-ux-state.js',import.meta.url),'utf8');
const handlers=new Map(),elements=new Map(),storage=new Map();
const on=(name,fn)=>handlers.set(name,[...(handlers.get(name)||[]),fn]);
const dispatch=(name,detail={})=>(handlers.get(name)||[]).forEach(fn=>fn({type:name,detail}));
elements.set('connect',{disabled:false});elements.set('title',{textContent:'Test Track'});elements.set('artImg',{src:'cover.jpg'});
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const document={readyState:'complete',body:{dataset:{}},getElementById:id=>elements.get(id)||null,addEventListener:on};
const navigator={onLine:true};
const window={addEventListener:on,dispatchEvent:()=>{},playback:null,JFMPlaybackState:{get:()=>window.__playback},JFMPlayback:{health:{}},JFMAuth:{get state(){return window.__auth}},MAIRSpotifySessionReliability:{get state(){return window.__reliability}},JFMSpotifySDK:{deviceId:''},MAIRDJ:{diagnostics:()=>window.__dj},MAIRDJCadenceFix:{remaining:()=>window.__remaining},MAIRStationPolicy:{label:id=>id==='mix'?'Your Mix':id},__playback:{},__dj:{phase:'COUNTING'},__remaining:3,__auth:{hasRefreshToken:false,hasAccessToken:false},__reliability:{reauthRequired:false}};
const context={window,document,navigator,localStorage,console,setTimeout:()=>0,clearTimeout:()=>{},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},Date,Set,Number,String,Math};
vm.runInNewContext(source,context,{filename:'mair-ux-state.js'});
const state=()=>window.MAIRUXState.get();
let checks=0;function ok(name,value){checks++;if(!value)throw new Error(`FAIL: ${name}`)}

ok('fresh load is disconnected',state().appState==='DISCONNECTED');
elements.get('connect').disabled=true;ok('connect request is pending without credentials',state().appState==='CONNECTING');
elements.get('connect').disabled=false;window.__auth={hasRefreshToken:true,hasAccessToken:false};
ok('valid refresh credential means connected without a browser device',state().spotifyConnection.connected===true&&state().appState==='EMPTY'&&state().spotifyConnection.label.includes('apparaat herstellen'));
window.__playback={trackId:'track-a',isPlaying:false,expectedLive:true,progressMs:1200,durationMs:200000};
ok('missing device is recovery, never disconnected',state().appState==='RECOVERING'&&state().recoverableError?.diagnosticsCode==='SPOTIFY_DEVICE'&&state().recoverableError?.secondaryAction==='diagnostics');
window.JFMSpotifySDK.deviceId='device-1';window.__playback.isPlaying=true;window.__playback.lastError='geen actief device';
ok('confirmed playing state suppresses stale device errors',state().appState==='PLAYING'&&!state().recoverableError);
window.__playback.isPlaying=false;window.__playback.expectedLive=false;window.__playback.lastError='';
ok('intentional pause stays paused without recovery card',state().appState==='PAUSED'&&!state().recoverableError);
window.__playback.operation={type:'next'};ok('next pending is explicit',state().playbackPendingAction==='next');window.__playback.operation={type:'previous'};ok('previous pending is explicit',state().playbackPendingAction==='previous');window.__playback.operation=null;
window.__dj={phase:'COUNTING'};window.__remaining=3;ok('DJ counting exposes real countdown',state().djPublicState.state==='LISTENING'&&state().djPublicState.detail.includes('3 nummers'));
window.__remaining=1;ok('DJ near break is explicit',state().djPublicState.label.includes('komt dichtbij')&&state().djPublicState.detail.includes('1 nummer'));
for(const [phase,expected] of [['PREPARING','PREPARING'],['ARMED','PREPARING'],['HANDOFF','PREPARING'],['SPEAKING','ON_AIR'],['RESTORING','RECOVERING'],['RECOVERING','RECOVERING']]){window.__dj={phase};ok(`DJ ${phase} maps to ${expected}`,state().djPublicState.state===expected)}
window.__dj={phase:'COUNTING',skipNextBreak:true};ok('silent skip is not an error',state().djPublicState.state==='SILENT');
navigator.onLine=false;ok('offline has user-facing recovery copy',state().appState==='OFFLINE'&&state().recoverableError?.diagnosticsCode==='NETWORK_OFFLINE');navigator.onLine=true;
window.__dj={phase:'COUNTING'};window.__remaining=2;window.__playback.expectedLive=true;window.JFMPlayback.health={reloadNeedsGesture:true};
ok('reload gesture uses device recovery without OAuth',state().appState==='GESTURE_REQUIRED'&&state().recoverableError?.primaryAction==='device'&&state().recoverableError?.secondaryAction==='diagnostics');
window.JFMPlayback.health={};window.__reliability={reauthRequired:true,hasRefreshToken:false,hasAccessToken:false};window.__auth={hasRefreshToken:false,hasAccessToken:false};
ok('only definitive reauth state offers reconnect',state().appState==='DISCONNECTED'&&state().recoverableError?.diagnosticsCode==='SPOTIFY_REAUTH_REQUIRED'&&state().recoverableError?.primaryAction==='reconnect');
window.__reliability={reauthRequired:false,hasRefreshToken:true,hasAccessToken:false};window.__auth={hasRefreshToken:true,hasAccessToken:false};window.__playback={trackId:'track-a',isPlaying:false,expectedLive:false,lastError:'Spotify Premium 403'};window.JFMSpotifySDK.deviceId='device-1';
ok('premium error is translated',state().recoverableError?.diagnosticsCode==='SPOTIFY_PREMIUM');
window.__playback={trackId:'track-a',isPlaying:true,expectedLive:true,lastError:'geen actief device'};ok('old device error cannot cover live playback',!state().recoverableError);
dispatch('mair:user-error',{scope:'auth',error:'token refresh tijdelijk mislukt',at:Date.now()});ok('transient auth failure preserves connection and never offers OAuth',state().recoverableError?.diagnosticsCode==='SPOTIFY_CONNECT_TEMPORARY'&&!state().recoverableError?.primaryAction);
dispatch('mair:user-error',{scope:'auth',error:'expired',at:Date.now()-20000});dispatch('mair:channelchange',{loading:true});ok('station switch gets pending feedback',state().station.pending==='Station wisselen…');
window.__playback={trackId:'track-a',isPlaying:false,expectedLive:false,lastError:''};dispatch('mair:station-error',{error:'station network error'});ok('station failure preserves a recovery action',state().recoverableError?.primaryAction==='retry-station');
console.log(`PASS UX state behavior v2: ${checks} checks`);
