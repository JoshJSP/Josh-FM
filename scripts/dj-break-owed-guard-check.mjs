import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../mair-dj-break-owed-guard.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Bus{constructor(){this.m=new Map()}addEventListener(n,f){if(!this.m.has(n))this.m.set(n,[]);this.m.get(n).push(f)}dispatchEvent(e){for(const f of this.m.get(e.type)||[])f(e);return true}}
class CE{constructor(type,opt={}){this.type=type;this.detail=opt.detail}}
const bus=new Bus();
let current={phase:'COUNTING',pendingAir:false,prepared:null,busy:false,lastMissReason:'',lastMissAt:0,manualArmed:false};
const metrics={arm:0,prepare:0};
const document={visibilityState:'visible',addEventListener(){}};
const window={
 addEventListener:(...a)=>bus.addEventListener(...a),dispatchEvent:(...a)=>bus.dispatchEvent(...a),
 JFMPlaybackState:{get:()=>({trackId:'track-live'})},
 MAIRDJ:{busy:false,state:()=>current,armManual:()=>{metrics.arm++;return true},prepare:async x=>{metrics.prepare++;return{x}}}
};
const context={window,document,CustomEvent:CE,setTimeout,clearTimeout,setInterval:()=>0,Date,Promise,console};Object.assign(window,{window,document,CustomEvent:CE});vm.createContext(context);vm.runInContext(src,context,{filename:'mair-dj-break-owed-guard.js'});
assert.equal(window.MAIRDJBreakOwedGuard?.version,'mair-dj-break-owed-guard-v1');
current={...current,pendingAir:true,prepared:null,phase:'COUNTING'};bus.dispatchEvent(new CE('mair:dj-v2-state',{detail:current}));await sleep(360);assert.equal(metrics.prepare,1,'due break without prepared audio must self-heal preparation');
current={...current,pendingAir:false,lastMissReason:'break-missed',lastMissAt:12345};bus.dispatchEvent(new CE('mair:dj-v2-state',{detail:current}));await sleep(360);assert.equal(metrics.arm,0,'an aired-handoff failure must be safely skipped instead of creating a retry loop');
bus.dispatchEvent(new CE('mair:dj-v2-state',{detail:current}));await sleep(360);assert.equal(metrics.arm,0,'same missed break must remain terminal');
document.visibilityState='hidden';current={...current,lastMissAt:12346};bus.dispatchEvent(new CE('mair:dj-v2-state',{detail:current}));await sleep(360);assert.equal(metrics.arm,0,'background state must not trigger an audible retry');
console.log('MAIR DJ break owed guard: PASS — due preparation self-heals and failed handoff is safely terminal');
