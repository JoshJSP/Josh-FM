import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../mair-reload-audibility.js',import.meta.url),'utf8');
const uri='spotify:track:'+'a'.repeat(22),oldUri='spotify:track:'+'b'.repeat(22);
let remoteUri=uri,remotePosition=45678,paused=true,localUri=uri,localPosition=0,seeks=0,resumes=0;
const store=new Map([['jfm_playback_truth_v1',JSON.stringify({expectedLive:true,uri,updatedAt:Date.now(),progressMs:43000,durationMs:180000})]]);
const player={
  async getCurrentState(){return{paused,position:localPosition,track_window:{current_track:{uri:localUri}}}},
  async seek(position){seeks++;localPosition=Number(position||0);localUri=remoteUri},
  async resume(){resumes++;paused=false;localUri=remoteUri}
};
const listeners=new Map(),events=[];
const context={console,setTimeout,clearTimeout,Promise,Date,Math,JSON,String,Number,Error,RegExp,Map,Set,
  document:{visibilityState:'visible',hidden:false,readyState:'loading',addEventListener(name,fn){listeners.set('document:'+name,fn)}},
  sessionStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
  CustomEvent:class{constructor(type,opt={}){this.type=type;this.detail=opt.detail}},
  addEventListener(name,fn){listeners.set(name,fn)},dispatchEvent(event){events.push(event);return true},
  jfmSpotifyPlayer:player,
  JFMPlayback:{async ensureDevice(){return'dev-1'},async recover(){return true}},
  async api(){return{is_playing:true,progress_ms:remotePosition,item:{uri:remoteUri},device:{id:'dev-1'}}}
};
context.window=context;context.globalThis=context;
vm.runInNewContext(source,context,{filename:'mair-reload-audibility.js'});
assert.ok(context.MAIRReloadAudibilityGuard,'guard should install');
let ok=await context.MAIRReloadAudibilityGuard.check('same-track-test');
assert.equal(ok,true);assert.equal(paused,false);assert.ok(seeks>=1);assert.ok(resumes>=1);assert.ok(Math.abs(localPosition-remotePosition)<10);assert.equal(context.MAIRReloadAudibilityGuard.status.status,'repaired');assert.equal(context.MAIRReloadAudibilityGuard.status.naturalAdvance,false);

// Natural Spotify advance after a reload must sync to the remote current track, never rewind the old intent.
store.set('jfm_playback_truth_v1',JSON.stringify({expectedLive:true,uri:oldUri,updatedAt:Date.now(),progressMs:175000,durationMs:178000}));
remoteUri=uri;remotePosition=12000;paused=true;localUri=oldUri;localPosition=0;
ok=await context.MAIRReloadAudibilityGuard.check('natural-advance-test');
assert.equal(ok,true);assert.equal(localUri,uri);assert.equal(paused,false);assert.equal(context.MAIRReloadAudibilityGuard.status.naturalAdvance,true);assert.equal(context.MAIRReloadAudibilityGuard.status.remoteUri,uri);assert.ok(events.some(e=>e.type==='mair:reload-audibility'));
console.log('MAIR reload audibility guard: PASS');