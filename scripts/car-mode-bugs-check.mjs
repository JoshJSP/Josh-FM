// Car Mode: drie bugs (15-10-2026). Mapbox Directions staat 25 coördinaten toe (ook driving-traffic),
// Passenger Mode neemt het gekozen nummer, de 70/30-weergave houdt het afslagnummer als los label.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL(`../${n}`,import.meta.url),'utf8');

// 1. Meer dan 23 tussenstops (start + stops + einde > 25) geeft bij Mapbox een fout: de UI houdt de grens zelf aan.
{const src=read('prototypes/mair-car-mode-wave.js');
 const a=src.indexOf('function openSearch('),b=src.indexOf('async function recalcAfterStops')-1;assert.ok(a>0&&b>a,'openSearch gevonden');
 const m=/const MAX_ROUTE_POINTS=(\d+)/.exec(src);assert.equal(m&&Number(m[1]),25,'limiet 25 uit de Mapbox-documentatie');
 const c=src.indexOf('const MAX_ROUTE_POINTS=');const cEnd=src.indexOf('\n',c);
 const ctx={s:{stops:[],screen:'drive'},toasts:[],closeMenu(){},render(){},bindSearch(){},ensureLocation:async()=>{},toast:t=>ctx.toasts.push(t),queueMicrotask(){}};
 vm.runInNewContext(src.slice(c,cEnd).replace(/^(const|let) /gm,'var ')+';'+src.slice(a,b+1).replace(/^(const|let) /gm,'var ')+';globalThis.openSearch=openSearch',ctx);
 ctx.s.stops=Array.from({length:22},()=>({}));ctx.openSearch('stop');assert.equal(ctx.s.screen,'search','22 stops: nog één erbij kan');
 ctx.s.screen='drive';ctx.s.stops=Array.from({length:23},()=>({}));ctx.openSearch('stop');assert.equal(ctx.s.screen,'drive','23 stops: vol, geen zoekscherm');assert.match(ctx.toasts.at(-1)||'',/23/);
 ctx.openSearch('destination');assert.equal(ctx.s.screen,'search','bestemming zoeken blijft kunnen');
}

// 2. Passenger Mode: het gekozen nummer (resolvedTrack) wordt gebruikt, zoeken alleen als het ontbreekt.
async function passenger(req){
  const added=[],searched=[],acks=[];
  const store={KEY:JSON.stringify({active:true,code:'ABC',hostSecret:'h',guestUrl:'x',requests:[]})};
  const timers=[];
  const ctx={console,JSON,Promise,Date,Error,encodeURIComponent,URLSearchParams,Array,Object,String,Number,Math,
    sessionStorage:{getItem:()=>store.KEY,setItem(){}},
    document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:()=>({setAttribute(){},addEventListener(){},appendChild(){},querySelector:()=>null,style:{}}),head:{appendChild(){}},body:{appendChild(){},contains:()=>false},activeElement:null,hidden:false},
    MutationObserver:class{observe(){}},requestAnimationFrame:f=>f(),navigator:{},location:{origin:'https://x'},
    setInterval:()=>0,clearInterval(){},setTimeout:f=>{timers.push(f);return 0},clearTimeout(){},
    api:async p=>{searched.push(p);return{tracks:{items:[{id:'WRONG',uri:'spotify:track:WRONG',name:'Cover',artists:[{name:'Ander'}]}]}}},
    fetch:async(u,o)=>{const body=o?.body?JSON.parse(o.body):null;if(body?.action==='ack'){acks.push(body);return{ok:true,json:async()=>({})}}return{ok:true,json:async()=>({active:true,requests:[req]})}}};
  ctx.window=ctx;ctx.addEventListener=()=>{};ctx.JFMRequests={add:async u=>{added.push(u);return true}};
  vm.runInNewContext(read('mair-passenger-mode.js'),ctx);
  for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
  return{added,searched,acks};
}
{const r=await passenger({id:'p1',query:'Wonderwall',name:'Sam',status:'pending',createdAt:1,resolvedTrack:{id:'EXACT',uri:'spotify:track:EXACT',name:'Wonderwall',artists:['Oasis']}});
 assert.deepEqual(r.added,['spotify:track:EXACT'],'exact gekozen nummer wordt toegevoegd');assert.equal(r.searched.length,0,'geen nieuwe zoekopdracht');assert.equal(r.acks[0]?.status,'accepted');}
{const r=await passenger({id:'p2',query:'Wonderwall',name:'Sam',status:'pending',createdAt:1,resolvedTrack:null});
 assert.deepEqual(r.added,['spotify:track:WRONG'],'zonder gekozen nummer: terugvallen op zoeken');assert.equal(r.searched.length,1);}

// 3. 70/30: afslagnummer blijft een los label naast de pijl.
{const src=read('mair-car-70-30.js');let html='';
 const mk=(text,exit)=>({textContent:text,querySelector:q=>q==='.car-nav-exit'&&exit?{textContent:exit}:null});
 const focus={dataset:{},classList:{add(){}},querySelector:q=>q==='.car-turn-arrow'?mk('↱2e','2e'):q==='.car-turn-hero b'?{textContent:'150 m'}:q==='.car-turn-hero h1'?{textContent:'Neem de 2e afslag'}:q==='.car-turn-hero span'?{textContent:'12:00'}:null,set innerHTML(v){html=v}};
 const overlay={querySelector:()=>focus};
 const ctx={window:{},document:{getElementById:id=>id==='mairCarWaveOverlay'?overlay:null,createElement:()=>({}),head:{appendChild(){}},addEventListener(){},readyState:'complete'},MutationObserver:class{observe(){}},queueMicrotask(){},setTimeout(){},console};
 ctx.window=ctx;vm.runInNewContext(src,ctx);
 assert.match(html,/<div class="car-nav-arrow">↱<span class="car-nav-exit">2e<\/span><\/div>/,'pijl en afslagnummer los');
}
console.log('PASS Car Mode bugs (limiet 25, Passenger exact nummer, 70/30 afslagnummer)');
