import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Bus{constructor(){this.listeners=new Map()}addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list)}dispatch(name,detail={}){const event={type:name,detail,stopped:false,stopImmediatePropagation(){this.stopped=true}};for(const fn of this.listeners.get(name)||[]){fn(event);if(event.stopped)break}}}
class FakeCustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
const source=fs.readFileSync(new URL('../mair-background-guard.js',import.meta.url),'utf8');

function harness({expectedLive=true,isPlaying=true,remotePlaying=false,recoverResult=true}={}){
  const winBus=new Bus(),docBus=new Bus(),events=[],metrics={recover:0,ingest:0,expected:0},body={setAttribute(){},removeAttribute(){}},state={expectedLive,isPlaying,trackId:'track-a'};
  const document={visibilityState:'visible',body,addEventListener:(...args)=>docBus.addEventListener(...args)};
  const window={addEventListener:(...args)=>winBus.addEventListener(...args),dispatchEvent:event=>{events.push(event.detail);winBus.dispatch(event.type,event.detail);return true},JFMPlaybackState:{get:()=>({...state}),setExpectedLive:on=>{metrics.expected++;state.expectedLive=!!on},ingest:live=>{metrics.ingest++;state.isPlaying=!!live.is_playing}},JFMPlayback:{recover:async()=>{metrics.recover++;return recoverResult}},JFMPWA:{reassertMediaSession(){}},navigator:{mediaSession:{}},document};
  const context={window,document,navigator:window.navigator,CustomEvent:FakeCustomEvent,api:async()=>({item:{id:'track-a'},is_playing:remotePlaying}),setTimeout,clearTimeout,Promise,Date,console};Object.assign(context,window);vm.createContext(context);vm.runInContext(source,context,{filename:'mair-background-guard.js'});
  return{window,document,events,metrics,hide(){document.visibilityState='hidden';docBus.dispatch('visibilitychange')},show(){document.visibilityState='visible';docBus.dispatch('visibilitychange')},pagehide(){winBus.dispatch('pagehide')},naturalEnd(detail={trackId:'track-a'}){winBus.dispatch('jfm:natural-track-end',detail)}}
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stillPlayingNeedsNoRecovery(){const h=harness({remotePlaying:true});h.hide();h.show();await sleep(240);assert.equal(h.metrics.recover,0);assert.equal(h.metrics.ingest,1);assert.ok(h.events.some(x=>x.reason==='visible-still-playing'))}
async function pausedForegroundRecoversOnce(){const h=harness({remotePlaying:false});h.hide();h.show();h.show();await sleep(260);assert.equal(h.metrics.recover,1,'concurrent foreground events may trigger one recovery only');assert.ok(h.events.some(x=>x.reason==='visible-recovered'))}
async function inactiveSessionDoesNotAutostart(){const h=harness({expectedLive:false,isPlaying:false});h.hide();h.show();await sleep(230);assert.equal(h.metrics.recover,0);assert.ok(h.events.some(x=>x.reason==='visible-no-recovery'))}
async function hiddenNaturalEndReachesCentralOwner(){const h=harness();let received=0;h.window.addEventListener('jfm:natural-track-end',()=>{received++});h.hide();h.naturalEnd();assert.equal(received,1,'background guard must never swallow the central natural-end event');assert.ok(h.events.some(x=>x.reason==='hidden-natural-observed'))}

const tests=[['background return keeps live playback',stillPlayingNeedsNoRecovery],['foreground recovery is single-flight',pausedForegroundRecoversOnce],['inactive session never autostarts',inactiveSessionDoesNotAutostart],['hidden natural end reaches central playback owner',hiddenNaturalEndReachesCentralOwner]];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(error){console.error('FAIL',name,'—',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`MAIR background/foreground behavior: ${passed}/${tests.length} PASS`);
