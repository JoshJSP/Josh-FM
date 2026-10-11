// Gedragstest voor mair-sleep.js: verlopen timer, herhaalpogingen en opruimen na de coulance.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
const src=fs.readFileSync(new URL('../mair-sleep.js',import.meta.url),'utf8');
function run(stored,{pauseOk=false}={}){
  const store={jfm_sleep_timer_v1:JSON.stringify(stored)};let pauses=0,now=1e12;
  const el=()=>{const p=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':k==='querySelectorAll'?()=>[]:p,set:()=>true,apply:()=>p});return p};
  let tick;const win={dispatchEvent(){},addEventListener(){},JFMPlayback:{pause:async()=>{pauses++;return pauseOk},health:{}},JFMPlaybackState:{get:()=>({trackId:'t1',expectedLive:true})}};
  const doc={readyState:'complete',getElementById:()=>el(),createElement:el,head:el(),body:{...el(),appendChild(){}},addEventListener(){}};
  const D=class extends Date{static now(){return now}};
  const ctx={window:win,document:doc,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},setInterval:(f,ms)=>{if(ms===500)tick=f;return 1},setTimeout(){return 1},clearInterval(){},Date:D,CustomEvent:class{},console,Math,Number,String,JSON};
  ctx.window.localStorage=ctx.localStorage;vm.runInNewContext(src,ctx);
  return {win,tick:()=>tick(),pauses:()=>pauses,store,advance:ms=>{now+=ms},now:()=>now};
}
const now0=1e12;
let r=run({mode:'time',at:now0-30000,minutes:30,createdAt:now0-1830000});
ok('net verlopen timer blijft bewaard',r.win.MAIRSleep.status().active===true);
r.tick();await Promise.resolve();await Promise.resolve();
ok('verlopen timer pauzeert alsnog',r.pauses()===1);
r.advance(500);r.tick();await Promise.resolve();
ok('mislukte pauze wordt niet elke 500 ms herhaald',r.pauses()===1);
r.advance(10000);r.tick();await Promise.resolve();await Promise.resolve();
ok('na 10 s volgt een nieuwe poging',r.pauses()===2);
r.advance(11*60*1000);r.tick();
ok('na de coulance geeft hij het op',r.win.MAIRSleep.status().active===false);
r=run({mode:'time',at:now0-3*3600*1000,minutes:30,createdAt:now0-4*3600*1000});
ok('uren geleden verlopen restant wordt niet meer uitgevoerd',r.win.MAIRSleep.status().active===false);
r=run({mode:'time',at:now0+600000,minutes:10,createdAt:now0});
ok('lopende timer blijft lopen',r.win.MAIRSleep.status().active===true&&r.pauses()===0);
console.log(`MAIR sleep timer: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
