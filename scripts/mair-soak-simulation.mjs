import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../rotation-engine.js',import.meta.url),'utf8'),store=new Map([['jfm_music_channel_v1','mix']]),likes={},requests=new Set();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const show={id:'morning',name:'MAIR Morning',musicPattern:['Power','Current','Familiar','Discovery','Power','Current'],targetMomentum:.72};
const window={jfmDirectorMemory:()=>({likes,plays:{},discoveryWins:{},discoveryLosses:{}}),jfmIsRequest:t=>requests.has(t?.id),JFMRadioSuite:{state:()=>({lastIds:[],lastArtists:[]})},JFMStationClock:{current:()=>({show,phase:'open'})}};
window.addEventListener=()=>{};window.dispatchEvent=()=>{};window.MAIRRuntime={register:()=>{}};const document={addEventListener:()=>{}};const CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail}};const context=vm.createContext({window,document,CustomEvent,localStorage,console,Date,Math,JSON,Number,String,Array,Set,Object});vm.runInContext(src,context,{filename:'rotation-engine.js'});const rot=window.JFMRotation;assert.ok(rot?.version==='mair-director-v3-horizon');
const year=new Date().getFullYear(),tracks=[];for(let i=0;i<160;i++){const kind=i%5,id=`track-${i}`,t={id,uri:`spotify:track:${String(i).padStart(22,'0')}`,name:`Track ${i}`,artists:[`Artist ${i%40}`],popularity:48+(i%48),release:`${2017+(i%8)}-01-01`};if(kind===0){likes[id]=2;t.release=`${year-3}-01-01`}if(kind===1)t.release=`${year}-01-01`;if(kind===2)t.release=`${year-5}-01-01`;if(kind===3){t._discovery=true;t.release=`${year}-01-01`}if(kind===4)t.release='2006-01-01';if(i%37===0)requests.add(id);tracks.push(t)}
const shows=[
 {id:'after-hours',name:'MAIR After Hours',musicPattern:['Familiar','Throwback','Discovery','Familiar'],targetMomentum:.42},
 {id:'morning',name:'MAIR Morning',musicPattern:['Power','Current','Familiar','Discovery','Power','Current'],targetMomentum:.72},
 {id:'daytime',name:'MAIR Daytime',musicPattern:['Familiar','Current','Power','Discovery','Familiar','Current'],targetMomentum:.65},
 {id:'drive',name:'MAIR Drive',musicPattern:['Power','Current','Power','Familiar','Discovery','Current'],targetMomentum:.82},
 {id:'evening',name:'MAIR Evening',musicPattern:['Familiar','Discovery','Current','Throwback','Familiar'],targetMomentum:.58},
 {id:'late-night',name:'MAIR Late Night',musicPattern:['Familiar','Throwback','Discovery','Familiar'],targetMomentum:.45}
];
let transitions=0,targetHits=0;for(const s of shows){Object.assign(show,s);const planned=rot.plan(tracks.map(x=>({...x})),[]).slice(0,80);assert.equal(planned.length,80,`${s.id}: onvoldoende tracks`);const cats=planned.map(rot.category);assert.ok(new Set(cats).size>=4,`${s.id}: te weinig categorievariatie`);for(let i=0;i<planned.length;i++){if(i){assert.notEqual(planned[i].id,planned[i-1].id,`${s.id}: directe trackrepeat`);assert.notEqual(planned[i].artists[0],planned[i-1].artists[0],`${s.id}: directe artiestrepeat`);if(rot.category(planned[i])==='Discovery')assert.notEqual(rot.category(planned[i-1]),'Discovery',`${s.id}: discovery stapelt`)}const slot=(Math.floor(new Date().getMinutes()/10)+i)%s.musicPattern.length;if(rot.category(planned[i])===s.musicPattern[slot])targetHits++;transitions++}}
assert.ok(transitions>=480,'soak simuleert te weinig overgangen');assert.ok(targetHits>=45,`muziekkolk te zwak: ${targetHits} target hits`);console.log(`MAIR Music Director soak: PASS — ${transitions} transitions, ${targetHits} clock-pattern hits, no adjacent artist repeats`);

// Lange speeltest door queue-core.commit(): 70 nummers op een pool van 160, en elke paar nummers schrijft een andere module
// de hele lijst opnieuw (director.replan zet al gespeelde nummers terug, 'set-detected' herbouwt vanaf het begin).
// Oude code: 34 uniek op 70. Nu mag een nummer binnen 50 plays niet terugkomen, verzoeken uitgezonderd.
{
  const qsrc=fs.readFileSync(new URL('../queue-core.js',import.meta.url),'utf8');
  const mem=new Map(),st={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
  const lastIds=[];let currentId='',requestId='';
  const w={addEventListener(){},dispatchEvent(){},JFMRadioSuite:{state:()=>({lastIds})},JFMPlaybackState:{get:()=>({trackId:currentId})},jfmIsRequest:t=>!!requestId&&t?.id===requestId};
  const ctx=vm.createContext({window:w,localStorage:st,sessionStorage:st,CustomEvent,console,Date,Math,JSON,Promise,queue:[]});
  vm.runInContext(qsrc,ctx,{filename:'queue-core.js'});const Q=w.JFMQueue;
  const pool=Array.from({length:160},(_,i)=>({id:`q${i}`,uri:`spotify:track:${String(i).padStart(22,'0')}`,artists:[{name:`Artist ${i%40}`}]}));
  let rnd=7;const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){rnd=(rnd*48271)%2147483647;const j=rnd%(i+1);[x[i],x[j]]=[x[j],x[i]]}return x};
  Q.commit(pool.slice(0,60),{reason:'station-start'});const heard=[];
  for(let play=0;play<70;play++){
    const q=Q.current(),i=q.findIndex(t=>t.id===currentId),next=q[i+1]||q[0];
    currentId=next.id;heard.push(next.id);lastIds.unshift(next.id);lastIds.splice(100);
    if(play%7===3){const prev=Q.current();Q.commit([next,...shuffle(prev.filter(t=>t.id!==next.id))],{reason:'director-replan'})}
    if(play%11===5)Q.commit(shuffle(pool).slice(0,60),{reason:'set-detected'});
  }
  const uniq=new Set(heard).size;assert.ok(uniq>=66,`lange speeltest: maar ${uniq} unieke nummers op 70 (herhaalde nummers)`);
  for(let i=0;i<heard.length;i++){const j=heard.indexOf(heard[i],i+1);assert.ok(j<0||j-i>=50,`nummer ${heard[i]} kwam na ${j-i} plays terug`)}
  // Een verzoek dat al eerder speelde blijft wel staan.
  requestId=lastIds[3];const req=pool.find(t=>t.id===requestId);Q.commit([pool.find(t=>t.id===currentId),req,...shuffle(pool).slice(0,40)],{reason:'request'});
  assert.ok(Q.current().some(t=>t.id===requestId),'verzoek mag nooit door de geschiedenis-filter verdwijnen');
  // Kleine zender (35 nummers, alles al gespeeld): de lijst mag niet leeg raken.
  requestId='';const small=pool.slice(0,35);for(const t of small)lastIds.unshift(t.id);Q.commit(small,{reason:'small-station'});
  assert.ok(Q.current().length>=10,'kleine zender: te weinig nummers over, muziek moet doorgaan');
  console.log(`MAIR queue soak: PASS — ${uniq}/70 uniek, geen nummer binnen 50 plays terug, verzoek blijft, kleine zender speelt door`);
}
