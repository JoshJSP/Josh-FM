// Bewaakt het DJ-blok van 2 uur in de mix-stand: klokgebonden blokken, andere DJ per blok, overdracht, vaste DJ blijft, 60 wordt 120.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
function world(store={}){const ls={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
 const ev=[],L={};const profiles={current:{id:'josh',name:'Josh'},select(id){this.current={id,name:id}}};
 const el={readyState:'complete',getElementById:()=>null,addEventListener(){}};
 const win={localStorage:ls,document:el,MAIRDJProfiles:profiles,addEventListener:(t,f)=>{(L[t]=L[t]||[]).push(f)},dispatchEvent:e=>{ev.push(e);return true},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail}}};
 Object.assign(win,{setInterval:()=>0,Date:globalThis.Date,Math,Number,String,Array,JSON,console,window:win});const ctx=vm.createContext(win);
 vm.runInContext(read('mair-live-context.js'),ctx);return{ctx:win,store,ev,profiles,fire:t=>(L[t]||[]).forEach(f=>f({}))}}
const RealDate=Date;let fake;const setClock=iso=>{fake=new RealDate(iso).getTime()};
globalThis.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(fake)}static now(){return fake}};
const at=h=>{setClock(`2026-10-13T${String(h).padStart(2,'0')}:30:00`)};
// blokken: 00-02, 02-04 ... en altijd een andere DJ dan het vorige blok
{const w=world();const live=w.ctx.MAIRLiveContext;live.setMode('rotation');
 const ids=[];for(let h=0;h<24;h+=2){at(h);ids.push(live.targetDJ())}
 ok('12 blokken van 2 uur per dag',ids.length===12);ok('elk blok een andere DJ dan het vorige',ids.every((d,i)=>i===0||d!==ids[i-1]));
 at(0);const a=live.targetDJ();at(1);ok('00:30 en 01:30 zelfde DJ (zelfde blok)',live.targetDJ()===a);
 at(2);ok('02:30 andere DJ dan 01:30',live.targetDJ()!==a);
 at(1); at(1);const w2=world();w2.ctx.MAIRLiveContext.setMode('rotation');ok('herlaad op zelfde tijdstip geeft zelfde DJ',w2.ctx.MAIRLiveContext.targetDJ()===a);
 at(23);const until=live.onAir().until;ok('onAir: tot middernacht om 23:30',until.getHours()===0&&until.getMinutes()===0);
 at(5);const u2=live.onAir().until;ok('onAir: 05:30 tot 06:00',u2.getHours()===6&&u2.getMinutes()===0)}
// blokwissel: nieuwe DJ doet overdracht bij trackchange na de grens
{at(1);const w=world();const live=w.ctx.MAIRLiveContext;live.setMode('rotation');live.applyRotation('boot');
 const first=w.profiles.current.id;const n0=w.ev.length;at(1);live.maybeRotate();ok('binnen blok geen wissel',w.ev.length===n0);
 at(2);live.maybeRotate();const h=w.ev.slice(n0).find(e=>e.type==='mair:djhandover');
 ok('na 02:00 mair:djhandover van oude naar nieuwe DJ',!!h&&h.detail.from===first&&h.detail.to===w.profiles.current.id&&h.detail.to!==first)}
// vaste DJ blijft staan
{at(1);const w=world();const live=w.ctx.MAIRLiveContext;w.profiles.current={id:'max',name:'max'};live.setMode('fixed');const n0=w.ev.length;for(const h of[1,3,5,9,23]){at(h);live.maybeRotate();live.applyRotation('x')}
 ok('fixed: DJ blijft max, geen overdracht',w.profiles.current.id==='max'&&w.ev.length===n0)}
// 60 -> 120
{const w=world({mair_rotation_minutes_v2:'60'});ok('opgeslagen 60 min wordt 120',w.ctx.MAIRLiveContext.rotationMinutes===120);ok('setRotationMinutes(60) wordt 120',w.ctx.MAIRLiveContext.setRotationMinutes(60)===120)}
{const b=read('build7.js');ok('build7: standaard 120, oude 60 gemigreerd, mix gebruikt rotation',b.includes('rotation:120')&&b.includes('o.rotation===60')&&b.includes("setMode?.('rotation')"))}
console.log(`MAIR DJ-blok: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
