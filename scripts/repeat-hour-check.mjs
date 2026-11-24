// Josh (24-11): op een gewone zender kwam hetzelfde nummer snel terug. Eis: niet binnen een uur.
// Echte queue-core.js + station-queue.js, nep-klok, 4 minuten per nummer, kleine bronnen (daar ging het mis:
// station-queue zakte terug naar 60% van de bron en queue-core naar de laatste 10 gespeelde).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const storage=(init={})=>{const m=new Map(Object.entries(init));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const HOUR=3600000,TRACK_MS=4*60000;

async function simulate(stationId,poolSize,plays){
  let now=Date.UTC(2026,10,24,12),rnd=11;const RealDate=Date;
  class FakeDate extends RealDate{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
  const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){rnd=(rnd*48271)%2147483647;const j=rnd%(i+1);[x[i],x[j]]=[x[j],x[i]]}return x};
  const pool=Array.from({length:poolSize},(_,i)=>({id:'r'+i,uri:'spotify:track:'+String(i).padStart(22,'0'),name:'T'+i,artists:['Artist '+(i%9)]}));
  const suite={lastIds:[],lastArtists:[],playedAt:{}};let currentId='';const listeners={};
  const ctx={document:{getElementById:()=>null},localStorage:storage({jfm_music_channel_v1:stationId}),sessionStorage:storage(),api:async(path)=>path==='/me/player/queue'?{queue:[]}:null,
    queue:[],playback:{item:null},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},Promise,Date:FakeDate,Math,JSON,console,
    CustomEvent:class{constructor(t,o={}){this.type=t;this.detail=o.detail}},addEventListener:(t,fn)=>(listeners[t]||=[]).push(fn),dispatchEvent:()=>true,
    JFMRadioSuite:{state:()=>suite},JFMPlaybackState:{get:()=>({trackId:currentId})},
    MAIRPersonalSourceSync:{buildPersonal:async()=>shuffle(pool)},MAIRStationController:{buildPool:async()=>({tracks:shuffle(pool)})}};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(read('queue-core.js'),ctx,{filename:'queue-core.js'});vm.runInContext(read('station-queue.js'),ctx,{filename:'station-queue.js'});
  const Q=ctx.JFMQueue,S=ctx.JFMStationQueue;
  ctx.queue=Q.commit(shuffle(pool),{reason:'station-start',station:stationId});
  const heard=[];
  for(let p=0;p<plays;p++){
    const q=Q.current(),i=q.findIndex(t=>t.id===currentId),next=q[i+1];
    assert.ok(next,`${stationId}/${poolSize}: wachtrij liep leeg na ${p} nummers, muziek moet doorgaan`);
    currentId=next.id;heard.push({id:next.id,at:now});
    suite.lastIds.unshift(next.id);suite.lastIds=suite.lastIds.slice(0,100);suite.playedAt[next.id]=now;
    await S.prepareNextRotation('trackchange');ctx.queue=Q.current();
    // Elke 9 nummers bouwt de director/set-detected de set opnieuw vanaf de bron (zoals in de app).
    if(p%9===4){Q.commit([next,...shuffle(pool)],{reason:'set-detected',station:stationId});ctx.queue=Q.current()}
    now+=TRACK_MS;
  }
  const last={};let worst=Infinity;
  for(const h of heard){if(last[h.id]!=null)worst=Math.min(worst,h.at-last[h.id]);last[h.id]=h.at}
  return{worst,unique:new Set(heard.map(h=>h.id)).size};
}

for(const [station,size] of [['mix',25],['mix',40],['hits',35],['hits',20]]){
  const r=await simulate(station,size,60);
  assert.ok(r.worst>=HOUR,`${station} (${size} nummers): een nummer kwam na ${Math.round(r.worst/60000)} minuten terug, moet minstens 60`);
  console.log(`  ${station}/${size}: kortste herhaling ${r.worst===Infinity?'geen':Math.round(r.worst/60000)+' min'}, ${r.unique} uniek`);
}
// Bron kleiner dan een uur muziek (10 nummers = 40 min): muziek gaat voor, de wachtrij mag niet leeg raken.
await simulate('hits',10,30);
console.log('MAIR herhaling: PASS, geen nummer binnen een uur terug, kleine bron speelt door');
