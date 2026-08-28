import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../mair-voice-engine.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class FakeCustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}

const metrics={prepare:0,speak:0,cancel:0,events:[]};
const body={classList:{toggle(){}}};
const document={readyState:'complete',body,getElementById:()=>null,addEventListener:()=>{}};
const localStorage={getItem:key=>key==='mair_voice_provider_v1'?'fish':null};
const legacyPrepare=async()=>{metrics.prepare++;return true};
let cancelCurrent=null;
const legacySpeak=async()=>{metrics.speak++;return new Promise(resolve=>{const timer=setTimeout(()=>{cancelCurrent=null;resolve(true)},35);cancelCurrent=()=>{clearTimeout(timer);cancelCurrent=null;resolve(false)}})};
const window={document,localStorage,prepareSpeech:legacyPrepare,speakText:legacySpeak,JFMDJAudio:{cancel:()=>{metrics.cancel++;cancelCurrent?.();return true}},MAIRDJProfiles:{current:{id:'josh',name:'Josh'}},addEventListener:()=>{},dispatchEvent:event=>{metrics.events.push(event);return true}};
const context={window,document,localStorage,CustomEvent:FakeCustomEvent,setInterval:fn=>{Promise.resolve().then(fn);return 1},clearInterval:()=>{},setTimeout:(fn,ms)=>ms===2500?(Promise.resolve().then(fn),2):setTimeout(fn,ms),clearTimeout,Promise,Date,console};
Object.assign(context,window);vm.createContext(context);vm.runInContext(source,context,{filename:'mair-voice-engine.js'});

await sleep(0);
assert.equal(await window.prepareSpeech('Dit is een Nederlandse test.'),true);
const first=window.speakText('Dit is een Nederlandse test.');
const overlap=await window.speakText('Deze tweede stem mag niet overlappen.');
assert.equal(overlap,false,'a second voice action must be dropped while audio is active');
assert.equal(await first,true);assert.equal(metrics.speak,1,'the provider must receive exactly one playback call');
assert.equal(window.MAIRVoiceEngine.speaking,false);assert.equal(window.MAIRVoiceEngine.status.overlapDrops,1);
const cancelled=window.speakText('Deze stem wordt geannuleerd.',false,{breakId:'cancel-me'});await sleep(5);assert.equal(await window.MAIRVoiceEngine.cancel('USER_NEXT','cancel-me'),true);assert.equal(await cancelled,false);assert.equal(metrics.cancel,1,'provider receives one explicit cancel');assert.equal(window.MAIRVoiceEngine.status.cancelled,1);assert.equal(window.MAIRVoiceEngine.speaking,false);
assert.deepEqual(metrics.events.filter(e=>e.type==='mair:dj-speaking').map(e=>e.detail.active),[true,false,true,false]);
console.log('MAIR voice engine behavioral simulation: PASS');
