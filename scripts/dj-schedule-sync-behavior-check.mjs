import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../mair-dj-schedule-sync.js',import.meta.url),'utf8');
class EventBus{constructor(){this.listeners=new Map()}addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const bus=new EventBus(),legacy=[];
const window={addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:event=>{if(event.type==='jfm:natural-next-ready')legacy.push(event.detail);return bus.dispatchEvent(event)}};
vm.createContext({window,CustomEvent,Date});vm.runInContext(source,vm.createContext({window,CustomEvent,Date}),{filename:'mair-dj-schedule-sync.js'});

bus.dispatchEvent(new CustomEvent('mair:track-transition',{detail:{id:'t1',fromTrackId:'A',toTrackId:'B',cause:'USER_NEXT',at:1}}));
bus.dispatchEvent(new CustomEvent('mair:track-transition',{detail:{id:'t2',fromTrackId:'B',toTrackId:'C',cause:'NATURAL_END',at:2}}));
assert.equal(legacy.length,0,'schedule sync mag nooit zelf een natuurlijke overgang fabriceren');
const state=window.MAIRDJScheduleSync.state();
assert.equal(state.canonical,true);assert.equal(state.syntheticSignals,0);assert.equal(state.naturalSignals,1);assert.equal(state.ignoredSignals,1);assert.equal(state.lastTransition.cause,'NATURAL_END');
console.log('MAIR DJ schedule sync: 3/3 PASS');
