import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../stability-core.js',import.meta.url),'utf8');
assert.match(source,/sdk-core-v7-auth-device-separated/);
assert.match(source,/showAuthorizedRecovery/);
assert.match(source,/AUTH_REAUTH_REQUIRED/);
assert.doesNotMatch(source,/authentication_error[^\n]+enable\(false\)/,'SDK auth error must not immediately disable the app');

const events=new Map(),storage=new Map([['jfm_refresh','refresh-1'],['jfm_token','access-old']]);
const controls={};for(const id of ['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild','connect'])controls[id]={disabled:false,dataset:{},cloneNode(){return this},replaceWith(){},addEventListener(){}};
controls.status={classList:{values:new Set(),toggle(k,on){on?this.values.add(k):this.values.delete(k)}},textContent:''};controls.queueInfo={textContent:'',style:{}};
let authEnsure=0,constructors=0,disconnects=0;
class Player{
  constructor(){constructors++;this.listeners=new Map()}
  addListener(name,fn){this.listeners.set(name,fn)}
  async connect(){this.listeners.get('ready')?.({device_id:'device-1'});return true}
  disconnect(){disconnects++}
  fire(name,payload){return this.listeners.get(name)?.(payload)}
}
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
const window={Spotify:{Player},JFMAuth:{state:{hasRefreshToken:true,hasAccessToken:true},ensure:async()=>{authEnsure++;return'access-new'}},MAIRSpotifySessionReliability:{state:{hasRefreshToken:true,hasAccessToken:true,reauthRequired:false}},JFMPlaybackState:{patch(){},ingest(){},get:()=>({isPlaying:false,updatedAt:0})},MAIRRuntime:{register(){}},addEventListener:(n,fn)=>events.set(n,[...(events.get(n)||[]),fn]),dispatchEvent:e=>{for(const fn of events.get(e.type)||[])fn(e)}};
const context={window,document:{getElementById:id=>controls[id]||null,head:{appendChild(){}},createElement:()=>({})},localStorage,sessionStorage,location:{search:'',pathname:'/',assign(){}},history:{replaceState(){}},URLSearchParams,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},spotifyClientId:'client',ensure:async()=> 'access-new',timedFetch:async()=>({ok:true,text:async()=>'',json:async()=>({})}),api:async path=>path==='/me/player/devices'?{devices:[{id:'device-1',is_restricted:false}]}:null,setConnected(){},renderPlayback(){},playback:null,token:'access-old',refreshToken:'refresh-1',saveToken(){},rand:()=> 'x',sha256:async()=>new ArrayBuffer(1),b64url:()=> 'x',redirectUri:()=> 'https://mair.test/',setTimeout:(fn,ms)=>{if(ms<300)queueMicrotask(fn);return 1},clearTimeout(){},setInterval,clearInterval,Promise,Date,console};Object.assign(context,window);context.window=context;context.JFMAuth=window.JFMAuth;context.MAIRSpotifySessionReliability=window.MAIRSpotifySessionReliability;context.JFMPlaybackState=window.JFMPlaybackState;context.MAIRRuntime=window.MAIRRuntime;context.addEventListener=window.addEventListener;context.dispatchEvent=window.dispatchEvent;
vm.createContext(context);vm.runInContext(source,context,{filename:'stability-core.js'});
await context.JFMSpotifySDK.init();assert.equal(constructors,1);const p=context.JFMSpotifySDK.player;assert.ok(p);
context.JFMAuth.state={hasRefreshToken:true,hasAccessToken:false};context.MAIRSpotifySessionReliability.state={hasRefreshToken:true,hasAccessToken:false,reauthRequired:false};p.fire('authentication_error');await new Promise(r=>setTimeout(r,10));assert.ok(authEnsure>=1,'transient SDK auth error must revalidate the existing session');assert.notEqual(controls.status.textContent,'offline','valid refresh token must not become public logout');assert.equal(controls.play.disabled,false,'valid session must keep recovery controls usable');assert.ok(storage.has('jfm_refresh'),'transient SDK auth error must preserve refresh token');
context.MAIRSpotifySessionReliability.state={hasRefreshToken:false,hasAccessToken:false,reauthRequired:true};context.JFMAuth.state={hasRefreshToken:false,hasAccessToken:false};storage.delete('jfm_refresh');storage.delete('jfm_token');p.fire('authentication_error');await new Promise(r=>setTimeout(r,10));assert.equal(controls.status.textContent,'offline','definitive reauth-required state may become disconnected');assert.equal(controls.play.disabled,true,'reauth-required state may disable playback until reconnect');
console.log('Spotify SDK auth recovery: PASS');
