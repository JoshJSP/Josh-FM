import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../mair-dj-schedule-sync.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class EventBus{
  constructor(){this.listeners=new Map()}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}

function harness(){
  const bus=new EventBus(),events=[];
  const window={MAIRDJ:{busy:false},JFMPlaybackState:{get:()=>({trackId:'A'})}};
  Object.assign(window,{addEventListener:(...args)=>bus.addEventListener(...args),dispatchEvent:event=>{if(event.type==='jfm:natural-next-ready')events.push(event.detail);return bus.dispatchEvent(event)}});
  const context={window,CustomEvent,setTimeout,clearTimeout,Date};
  vm.createContext(context);vm.runInContext(source,context,{filename:'mair-dj-schedule-sync.js'});
  const track=(previous,next)=>bus.dispatchEvent(new CustomEvent('jfm:trackchange',{detail:{previousTrackId:previous,trackId:next,source:'test'}}));
  const natural=(previous,next)=>bus.dispatchEvent(new CustomEvent('jfm:natural-next-ready',{detail:{endedTrackId:previous,newTrackId:next,source:'primary-natural-end'}}));
  return{window,events,track,natural};
}

async function testMissingPrimarySignalGetsOneSyntheticFallback(){
  const h=harness();h.track('A','B');await sleep(760);
  assert.equal(h.events.length,1);assert.equal(h.events[0].synthetic,true);assert.equal(h.events[0].source,'dj-schedule-sync');
  const state=h.window.MAIRDJScheduleSync.state();assert.equal(state.syntheticSignals,1);assert.equal(state.naturalSignals,1);assert.equal(state.lastSignal.source,'synthetic');
}
async function testPrimarySignalSuppressesSyntheticFallback(){
  const h=harness();h.track('A','B');await sleep(80);h.natural('A','B');await sleep(720);
  assert.equal(h.events.length,0,'schedule sync must not emit its own event when primary already did');
  const state=h.window.MAIRDJScheduleSync.state();assert.equal(state.syntheticSignals,0);assert.equal(state.naturalSignals,1);assert.equal(state.lastSignal.source,'primary-natural-end');
}
async function testDuplicateTrackEventsCannotDuplicateFallback(){
  const h=harness();h.track('A','B');h.track('A','B');h.track('A','B');await sleep(760);
  assert.equal(h.events.length,1);assert.equal(h.window.MAIRDJScheduleSync.state().syntheticSignals,1);
}

const tests=[
  ['missing primary transition gets one fallback',testMissingPrimarySignalGetsOneSyntheticFallback],
  ['primary transition suppresses fallback',testPrimarySignalSuppressesSyntheticFallback],
  ['duplicate track events stay idempotent',testDuplicateTrackEventsCannotDuplicateFallback],
];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(error){console.error('FAIL',name,'-',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`MAIR DJ schedule sync: ${passed}/${tests.length} PASS`);
