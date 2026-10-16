// Love/ban moet echt meetellen in wat de zender kiest: personal-learning-v4 + queue-core (filter) + rotation-engine (gewicht).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const uri=n=>'spotify:track:'+String(n).padStart(22,'0');
const track=(n,artist='Artist '+n,extra={})=>({id:String(n).padStart(22,'0'),uri:uri(n),name:'Track '+n,artists:[artist],popularity:50,release:'2024-01-01',...extra});
class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
function make({channel='hits',seed={}}={}){
  const data=new Map(Object.entries({jfm_music_channel_v1:channel,...seed})),listeners={};
  const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const ctx={localStorage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},CustomEvent:FakeCustomEvent,Date,Math,JSON,Number,String,Array,Set,Object,Promise,console,queue:[],
    setInterval:()=>0,setTimeout:()=>0,document:{readyState:'complete',getElementById:()=>null,addEventListener(){}},
    addEventListener:(t,f)=>(listeners[t]??=[]).push(f),dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}};
  ctx.window=ctx;ctx.JFMRadioSuite={state:()=>({lastIds:[],lastArtists:[]})};ctx.MAIRRuntime={register(){}};
  vm.createContext(ctx);
  for(const f of ['queue-core.js','rotation-engine.js','personal-learning-v4.js'])vm.runInContext(read(f),ctx,{filename:f});
  ctx.store=data;return ctx;
}
const ids=list=>Array.from(list,t=>t.id);

// (d) zonder love/ban verandert er niets
{const c=make(),list=[track(1,'A'),track(2,'B'),track(3,'C'),track(4,'D'),track(5,'E'),track(6,'F')];
 assert.equal(c.JFMTasteModel.filterBanned(list),list,'zonder bans: dezelfde lijst terug');
 assert.equal(c.JFMTasteModel.rotationBoost(list[0]),0,'zonder love/ban: geen gewicht');
 const base=make();assert.deepEqual(ids(c.JFMQueue.commit(list,{station:'hits'})),ids(base.JFMQueue.commit(list,{station:'hits'})));
 const before=JSON.stringify(c.JFMRotation.plan(list,[]).map(t=>t.id));assert.equal(before,JSON.stringify(base.JFMRotation.plan(list,[]).map(t=>t.id)))}

// (a) een geband nummer komt niet meer in een wachtrij
{const c=make(),list=Array.from({length:12},(_,i)=>track(i+1,'Artist '+i));
 c.JFMTasteModel.event('ban',list[3],-12);
 assert.ok(!ids(c.JFMQueue.commit(list,{station:'hits'})).includes(list[3].id),'geband nummer valt weg bij commit');
 assert.ok(ids(c.JFMQueue.commit(list,{station:'hits'})).length===11);
 // het nu spelende nummer blijft staan (anders raakt de wachtrij het spoor bij)
 c.JFMPlaybackState={get:()=>({trackId:list[3].id})};assert.ok(ids(c.JFMQueue.commit(list,{station:'hits'})).includes(list[3].id),'spelende nummer blijft');c.JFMPlaybackState=undefined;
 // een verzoek blijft altijd mogelijk
 c.jfmIsRequest=t=>t.id===list[3].id;assert.ok(ids(c.JFMQueue.commit(list,{station:'hits'})).includes(list[3].id),'verzoek van geband nummer blijft');c.jfmIsRequest=undefined;
 // rotatie-pad (buildActive) filtert ook
 c.MAIRStationController={buildPool:async()=>({tracks:list})};
 const built=await c.JFMQueue.buildActive('rotation');assert.ok(!ids(built).includes(list[3].id),'buildActive: geband nummer weg');
 // love haalt de ban weer weg
 c.JFMTasteModel.event('love',list[3],8);assert.ok(ids(c.JFMQueue.commit(list,{station:'hits'})).includes(list[3].id),'love heft ban op')}

// artiest pas bij herhaalde bans
{const c=make(),list=[...Array.from({length:4},(_,i)=>track(100+i,'Zanger Z')),...Array.from({length:12},(_,i)=>track(i+1,'Artist '+i))];
 c.JFMTasteModel.event('ban',list[0],-12);c.JFMTasteModel.event('ban',list[1],-12);
 let out=ids(c.JFMQueue.commit(list,{station:'hits'}));assert.ok(out.includes(list[2].id)&&out.includes(list[3].id),'2 bans: artiest nog niet uitgesloten');
 c.JFMTasteModel.event('ban',list[2],-12);
 out=ids(c.JFMQueue.commit(list,{station:'hits'}));assert.ok(!out.includes(list[3].id),'3 bans: hele artiest uitgesloten');
 c.JFMTasteModel.event('ban',list[2],-12);assert.equal(JSON.parse(c.store.get('jfm_taste_model_v4')).banArtists['zanger z'].n,3,'dubbel bannen van hetzelfde nummer telt niet dubbel')}

// (c) zender loopt niet leeg: kleine bron, veel bans
{const c=make(),small=Array.from({length:8},(_,i)=>track(i+1,'Artist '+i));
 for(const t of small.slice(0,6))c.JFMTasteModel.event('ban',t,-12);
 assert.equal(c.JFMQueue.commit(small,{station:'hits'}).length,8,'minder dan 5 over: oude lijst, muziek speelt door');
 const c2=make();for(const t of small.slice(0,3))c2.JFMTasteModel.event('ban',t,-12);
 assert.equal(c2.JFMQueue.commit(small,{station:'hits'}).length,5,'5 over blijft gefilterd');
 const c3=make(),all=small.slice(0,3);for(const t of all)c3.JFMTasteModel.event('ban',t,-12);
 assert.equal(c3.JFMQueue.commit(all,{station:'hits'}).length,3,'alles geband: geen lege wachtrij');
 // kapotte opslag of kapotte functie mag nooit gooien
 const c4=make();c4.JFMTasteModel.filterBanned=()=>{throw Error('stuk')};assert.equal(c4.JFMQueue.commit(small,{station:'hits'}).length,8,'filter gooit: oude keuze')}

// begrensd in grootte
{const c=make();for(let i=0;i<1000;i++)c.JFMTasteModel.event('ban',track(i+1,'Artist '+i),-12);
 const m=JSON.parse(c.store.get('jfm_taste_model_v4'));assert.ok(Object.keys(m.bans).length<=400&&Object.keys(m.banArtists).length<=400,'bans begrensd');assert.ok(m.events.length<=160)}

// (b) love: geliefde artiest staat vaker vooraan, over dezelfde reeks pools
{let x=12345;const rnd=()=>(x=(x*1664525+1013904223)>>>0)/4294967296;
 const catalog=Array.from({length:120},(_,i)=>track(i+1,'Artist '+(i%12),{popularity:30+(i*7)%60,release:`${2010+(i%15)}-01-01`}));
 const pools=Array.from({length:40},()=>catalog.filter(()=>rnd()<.4));
 const run=c=>{let top=0,share=0,tot=0,maxRun=0;for(const p of pools){const out=c.JFMRotation.plan(p,[]).slice(0,30);let r=0,last='';out.forEach((t,i)=>{const mine=t.artists[0]==='Artist 3';if(mine&&i<4)top++;if(mine)share++;tot++;if(t.artists[0]===last)r++;else r=0;last=t.artists[0];maxRun=Math.max(maxRun,r)})}return{top,share:share/tot,maxRun}};
 const plain=run(make()),loved=make();loved.JFMTasteModel.event('love',catalog[3],8);loved.JFMTasteModel.event('love',catalog[15],8);
 const withLove=run(loved);
 assert.ok(withLove.top>plain.top,'love: artiest vaker in de eerste 4 plekken (zonder '+plain.top+', met '+withLove.top+' van 40 pools)');
 assert.ok(withLove.share>plain.share,'love: groter aandeel in de eerste 30 (zonder '+plain.share.toFixed(3)+', met '+withLove.share.toFixed(3)+')');
 assert.ok(withLove.share<=plain.share*1.6,'love blijft rustig: aandeel hoogstens 1,6x');
 assert.ok(withLove.maxRun<=plain.maxRun,'love veroorzaakt geen artiest-na-artiest');
 console.log('love: eerste-4-plekken zonder',plain.top,'met',withLove.top,'| aandeel eerste 30 zonder',plain.share.toFixed(3),'met',withLove.share.toFixed(3))}

// bestaande opslagsleutel wordt gewist door reset (Profiel: Wis luisterprofiel)
{const c=make();c.JFMTasteModel.event('ban',track(1),-12);assert.ok(c.store.get('jfm_taste_model_v4'));c.JFMTasteModel.reset();assert.equal(Object.keys(JSON.parse(c.store.get('jfm_taste_model_v4')).bans).length,0)}
console.log('taste-learning-check: ok');
