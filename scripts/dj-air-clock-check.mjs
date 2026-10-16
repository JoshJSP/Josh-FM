// 16-10-2026: om 14:45 noemde de DJ 14:15 en begon hij midden in een nummer.
// Deze check draait mair-dj-v2.js met een nepklok en bewijst: de tekst noemt de tijd van het afspeelmoment,
// een te late break of een break midden in een nummer speelt niet (en de muziek loopt door).
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
const remote={id:'A',uri:'spotify:track:A',playing:true,progress:4000,duration:200000};
// Nepklok: begint om 14:15 lokale tijd en kan vooruit gezet worden.
const RealDate=Date;let offset=new RealDate(2026,9,16,14,15,0).getTime()-RealDate.now();
class FakeDate extends RealDate{constructor(...a){if(a.length)super(...a);else super(RealDate.now()+offset)}static now(){return RealDate.now()+offset}}
const hhmm=ms=>new RealDate(ms).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
const said=[];
const metrics={pause:0,resume:0,rewind:0,speak:0,prepare:0,writer:0};
let op=null,expectedLive=true;
const truth={get:()=>({trackId:remote.id,uri:remote.uri,isPlaying:remote.playing,expectedLive,operation:op}),begin:(type,d={})=>{op={id:1,type,...d};return 1},end:()=>{op=null},setExpectedLive:on=>{expectedLive=!!on}};
const live=()=>({item:{id:remote.id,uri:remote.uri,name:`Track ${remote.id}`,artists:[{name:`Artist ${remote.id}`}],album:{release_date:'2026-01-01'},duration_ms:remote.duration},is_playing:remote.playing,progress_ms:remote.progress,device:{id:'device-test'}});
const api=async path=>{if(path==='/me/player')return live();if(path==='/me/player/queue'){const next=String.fromCharCode(remote.id.charCodeAt(0)+1);return{queue:[{id:next,uri:`spotify:track:${next}`,name:`Track ${next}`,artists:[{name:`Artist ${next}`}],album:{release_date:'2026-01-01'}}]}}throw Error(`unexpected api ${path}`)};
const fetch=async(url,opt={})=>{if(url!=='/api/dj-writer')throw Error(`unexpected fetch ${url}`);metrics.writer++;said.push(JSON.parse(opt.body).context.session.localTime);await sleep(220);return{ok:true,status:200,json:async()=>({text:'Dit is een rustige voorbereide radiolink voor MAIR.',provider:'groq',model:'test'})}};
const audioStatus={provider:'fish',model:'test',voiceId:'voice',cacheSize:0,audioUnlocked:true,playbackMode:'html-audio'};
const JFMDJAudio={status:audioStatus,unlock:async()=>true};
const prepareSpeech=async()=>{metrics.prepare++;audioStatus.cacheSize=1;return true};
const speakText=async(_text,_jingle,meta={})=>{metrics.speak++;audioStatus.cacheSize=0;const playbackStartedAt=Date.now();bus.dispatchEvent(new CE('mair:dj-speaking',{detail:{active:true,breakId:String(meta.breakId||''),provider:'fish',route:'test-audio',playbackStartedAt,success:true}}));await sleep(5);bus.dispatchEvent(new CE('mair:dj-speaking',{detail:{active:false,breakId:String(meta.breakId||''),provider:'fish',route:'test-audio',playbackStartedAt,playbackEndedAt:Date.now(),success:true}}));return true};
const JFMPlayback={djPause:async uri=>{assert.equal(uri,remote.uri);metrics.pause++;remote.playing=false;return true},djResume:async uri=>{assert.equal(uri,remote.uri);metrics.resume++;remote.playing=true;return true},djRewind:async uri=>{assert.equal(uri,remote.uri);metrics.rewind++;remote.progress=0;return true},health:{lastError:''}};
const window={addEventListener:(...a)=>bus.addEventListener(...a),removeEventListener:(...a)=>bus.removeEventListener(...a),dispatchEvent:(...a)=>bus.dispatchEvent(...a),JFMPlaybackState:truth,JFMDJAudio,JFMPlayback,JFMSpotifySDK:{deviceId:'device-test'},MAIRDJProfiles:{current:{id:'josh',name:'Josh',role:'MAIR DJ'}}};
const math=Object.create(Math);math.random=()=>0;
const context={window,document,localStorage,sessionStorage,CustomEvent:CE,api,fetch,prepareSpeech,speakText,setTimeout,clearTimeout,AbortController,Promise,Date:FakeDate,Math:math,console};Object.assign(window,{window,document,localStorage,sessionStorage,CustomEvent:CE,api,fetch,prepareSpeech,speakText});Object.assign(context,window);vm.createContext(context);for(const[name,moduleSource]of moduleSources)vm.runInContext(moduleSource,context,{filename:name});vm.runInContext(source,context,{filename:'mair-dj-v2.js'});
function natural(ended,next,progress=300){remote.id=next;remote.uri=`spotify:track:${next}`;remote.playing=true;remote.progress=progress;bus.dispatchEvent(new CE('mair:track-transition',{detail:{id:`${ended}>${next}`,fromTrackId:ended,toTrackId:next,cause:'NATURAL_END',source:'test'}}))}


// Elke test: break voorbereiden op een nummer dat net begon (10 s van 200 s), dan pas laten spelen.
// Via de DJ-knop (armManual): zelfde voorbereiding en zelfde air() als automatisch, zonder de cadansregels.
async function armOn(id){Object.assign(remote,{id,uri:`spotify:track:${id}`,playing:true,progress:10000});window.MAIRDJ.armManual();await sleep(700);const st=window.MAIRDJ.state();assert.equal(st.phase,'ARMED',`break op ${id} moet klaarstaan, nu ${st.phase} ${st.reason} ${st.error}`)}

// 1. De tekst krijgt de tijd van het einde van het nummer, niet van het voorbereiden.
const t0=FakeDate.now();await armOn('A');
assert.equal(said.at(-1),hhmm(t0+190000),'writer moet de verwachte afspeeltijd krijgen (einde van het nummer)');
assert.notEqual(said.at(-1),hhmm(t0),'niet de tijd van het voorbereiden');

// 2. Wat Josh hoorde: break van 14:15 komt pas een half uur later aan de beurt. Dan geen break, muziek loopt door.
offset+=30*60*1000;natural('A','B');await sleep(400);
assert.equal(metrics.pause,0,'een half uur te late break mag de muziek niet pauzeren');assert.equal(metrics.speak,0,'en niets zeggen');
assert.ok(remote.playing,'muziek blijft spelen');

// 3. Op tijd, maar het volgende nummer speelt al een minuut: niet midden in een nummer beginnen.
let t=FakeDate.now();await armOn('C');offset+=190000;natural('C','D',60000);await sleep(400);
assert.equal(metrics.pause,0,'midden in een nummer mag de DJ niet beginnen');assert.equal(metrics.speak,0);assert.ok(remote.playing);

// 4. Normaal geval: op tijd en tussen twee nummers. Dan praat de DJ, en de genoemde tijd is de tijd van nu.
t=FakeDate.now();await armOn('E');offset+=190000;const airTime=hhmm(FakeDate.now());natural('E','F');await sleep(500);
assert.equal(metrics.pause,1,'normale break pauzeert een keer');assert.equal(metrics.speak,1,'en praat');assert.equal(metrics.resume,1);
assert.equal(said.at(-1),airTime,'de genoemde tijd is de tijd op het moment van afspelen');
console.log('MAIR DJ afspeeltijd: PASS — tijd van het afspeelmoment, te laat of midden in een nummer = geen break');
