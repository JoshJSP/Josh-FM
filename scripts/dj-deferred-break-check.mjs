import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const moduleSources=['dj-memory.js','radio-brain.js','dj-context-builder.js','dj-quality-gate.js'].map(name=>[name,fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')]);
const source=fs.readFileSync(new URL('../mair-dj-v2.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Bus{constructor(){this.m=new Map()}addEventListener(n,f){if(!this.m.has(n))this.m.set(n,[]);this.m.get(n).push(f)}removeEventListener(n,f){const rows=this.m.get(n)||[],index=rows.indexOf(f);if(index>=0)rows.splice(index,1)}dispatchEvent(e){for(const f of this.m.get(e.type)||[])f(e);return true}}
class CE{constructor(type,opt={}){this.type=type;this.detail=opt.detail}}
const el=(extra={})=>({value:'',textContent:'',dataset:{},checked:false,addEventListener(){},querySelector(){return null},cloneNode(){return el({...this})},replaceWith(){},...extra});
const bus=new Bus(),elements={talk:el({value:'1'}),talkValue:el(),djBreakTime:el(),djText:el()};
const document={readyState:'complete',visibilityState:'visible',getElementById:id=>elements[id]||null,addEventListener(){}};
const store=new Map([['jfm_spotify_device_id','device-test']]),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},sessionStorage=localStorage;
const remote={id:'A',uri:'spotify:track:A',playing:true,progress:4000};
const metrics={pause:0,resume:0,rewind:0,speak:0,prepare:0,writer:0};
let op=null,expectedLive=true;
const truth={get:()=>({trackId:remote.id,uri:remote.uri,isPlaying:remote.playing,expectedLive,operation:op}),begin:(type,d={})=>{op={id:1,type,...d};return 1},end:()=>{op=null},setExpectedLive:on=>{expectedLive=!!on}};
const live=()=>({item:{id:remote.id,uri:remote.uri,name:`Track ${remote.id}`,artists:[{name:`Artist ${remote.id}`}],album:{release_date:'2026-01-01'}},is_playing:remote.playing,progress_ms:remote.progress,device:{id:'device-test'}});
const api=async path=>{if(path==='/me/player')return live();if(path==='/me/player/queue'){const next=String.fromCharCode(remote.id.charCodeAt(0)+1);return{queue:[{id:next,uri:`spotify:track:${next}`,name:`Track ${next}`,artists:[{name:`Artist ${next}`}],album:{release_date:'2026-01-01'}}]}}throw Error(`unexpected api ${path}`)};
const fetch=async url=>{if(url!=='/api/dj-writer')throw Error(`unexpected fetch ${url}`);metrics.writer++;await sleep(220);return{ok:true,status:200,json:async()=>({text:'Dit is een rustige voorbereide radiolink voor MAIR.',provider:'groq',model:'test'})}};
const audioStatus={provider:'fish',model:'test',voiceId:'voice',cacheSize:0,audioUnlocked:true,playbackMode:'html-audio'};
const JFMDJAudio={status:audioStatus,unlock:async()=>true};
const prepareSpeech=async()=>{metrics.prepare++;audioStatus.cacheSize=1;return true};
const speakText=async(_text,_jingle,meta={})=>{metrics.speak++;audioStatus.cacheSize=0;const playbackStartedAt=Date.now();bus.dispatchEvent(new CE('mair:dj-speaking',{detail:{active:true,breakId:String(meta.breakId||''),provider:'fish',route:'test-audio',playbackStartedAt,success:true}}));await sleep(5);bus.dispatchEvent(new CE('mair:dj-speaking',{detail:{active:false,breakId:String(meta.breakId||''),provider:'fish',route:'test-audio',playbackStartedAt,playbackEndedAt:Date.now(),success:true}}));return true};
const JFMPlayback={djPause:async uri=>{assert.equal(uri,remote.uri);metrics.pause++;remote.playing=false;return true},djResume:async uri=>{assert.equal(uri,remote.uri);metrics.resume++;remote.playing=true;return true},djRewind:async uri=>{assert.equal(uri,remote.uri);metrics.rewind++;remote.progress=0;return true},health:{lastError:''}};
const window={addEventListener:(...a)=>bus.addEventListener(...a),removeEventListener:(...a)=>bus.removeEventListener(...a),dispatchEvent:(...a)=>bus.dispatchEvent(...a),JFMPlaybackState:truth,JFMDJAudio,JFMPlayback,JFMSpotifySDK:{deviceId:'device-test'},MAIRDJProfiles:{current:{id:'josh',name:'Josh',role:'MAIR DJ'}}};
const math=Object.create(Math);math.random=()=>0;
const context={window,document,localStorage,sessionStorage,CustomEvent:CE,api,fetch,prepareSpeech,speakText,setTimeout,clearTimeout,AbortController,Promise,Date,Math:math,console};Object.assign(window,{window,document,localStorage,sessionStorage,CustomEvent:CE,api,fetch,prepareSpeech,speakText});Object.assign(context,window);vm.createContext(context);for(const[name,moduleSource]of moduleSources)vm.runInContext(moduleSource,context,{filename:name});vm.runInContext(source,context,{filename:'mair-dj-v2.js'});
function natural(ended,next){remote.id=next;remote.uri=`spotify:track:${next}`;remote.playing=true;remote.progress=300;bus.dispatchEvent(new CE('mair:track-transition',{detail:{id:`${ended}>${next}`,fromTrackId:ended,toTrackId:next,cause:'NATURAL_END',source:'test'}}))}

natural('A','B');await sleep(15);
natural('B','C');await sleep(35); // preparation for C is intentionally still running
natural('C','D');await sleep(40);
let state=window.MAIRDJ.state();
assert.equal(state.played,0,'late preparation must not fake an aired break');
assert.equal(state.missed,0,'late preparation must not count as a missed break');
assert.ok(state.retries?.prepareRebases>=1,'late preparation must rebase the break');
assert.equal(metrics.pause,0,'music must not pause while the voice is not ready');

await sleep(620);state=window.MAIRDJ.state();
assert.equal(state.phase,'ARMED','deferred break must be re-prepared on the current track');
assert.equal(state.prepared?.originTrackId,'D','deferred copy must be rebuilt for the new origin track');
assert.equal(state.prepared?.nextHintId,'E','deferred copy must target the actual next track');

natural('D','E');await sleep(650);state=window.MAIRDJ.state();
assert.equal(state.played,1,'deferred break must air on the next safe natural transition');
assert.equal(state.missed,0,'successful deferred break must keep missed count at zero');
assert.equal(metrics.pause,1);assert.equal(metrics.speak,1);assert.equal(metrics.rewind,1);assert.equal(metrics.resume,1);
console.log('MAIR deferred DJ break: PASS — late preparation shifts forward and still airs');
