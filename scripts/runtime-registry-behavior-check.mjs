import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../mair-runtime.js',import.meta.url),'utf8');
class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
const events=[];
const sessionStorage={getItem:()=>null,setItem:()=>{}};
const window={addEventListener(){},dispatchEvent:event=>{events.push(event);return true}};
const context={window,sessionStorage,CustomEvent,Date,Math,Map,Object,Array,String,Number,JSON,Set};
vm.createContext(context);vm.runInContext(source,context,{filename:'mair-runtime.js'});vm.runInContext(source,context,{filename:'mair-runtime-duplicate.js'});

const registrations=[
  ['spotify-sdk-core','spotify-sdk'],['playback-state','playback-truth'],['playback-primary','transport'],
  ['transition-controller','canonical-transition'],['queue-core','authored-queue'],['mair-dj-v2','dj-orchestrator'],
  ['mair-voice-engine','voice-routing'],['mair-observability','diagnostics']
];
for(const[id,owner]of registrations)assert.equal(window.MAIRRuntime.register(id,{owner}).installed,true);
const duplicate=window.MAIRRuntime.register('playback-primary',{owner:'rogue-transport'});
assert.equal(duplicate.duplicate,true);assert.equal(duplicate.entry.installCount,1);assert.equal(duplicate.entry.attemptCount,2);
const snapshot=window.MAIRRuntime.snapshot(),modules=Object.fromEntries(snapshot.modules.map(x=>[x.moduleKey,x]));
for(const key of ['spotifySdk','playbackState','playbackController','transitionController','queue','djEngine','voiceEngine','diagnostics']){
  assert.equal(modules[key].installed,true,`${key} moet geïnstalleerd zijn`);assert.equal(modules[key].installCount,1,`${key} heeft exact één actieve installatie`)
}
assert.equal(modules.playbackController.owner,'transport','de eerste autoritatieve owner blijft eigenaar');
assert.ok(snapshot.events.some(x=>x.event==='MODULE_INSTALL_ATTEMPT'));
assert.ok(snapshot.events.some(x=>x.event==='MODULE_INSTALL_SUCCESS'));
assert.ok(snapshot.events.some(x=>x.event==='MODULE_INSTALL_DUPLICATE_BLOCKED'));
window.MAIRRuntime.failed('voiceEngine',new Error('synthetic failure'),{owner:'test'});
assert.ok(window.MAIRRuntime.snapshot().events.some(x=>x.event==='MODULE_INSTALL_FAILED'));
assert.ok(snapshot.events.every(x=>x.timestamp&&x.sessionId&&x.module&&x.event&&x.details));
console.log('MAIR runtime registry: canonical owners + duplicate blocking + event schema PASS');
