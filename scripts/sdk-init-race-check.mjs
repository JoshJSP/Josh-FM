import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Twee races in de speleropstart (stability-core.js), met korte limieten nagespeeld:
// 1. Een oude poging die na een reconnect alsnog faalt, mag de nieuwe speler niet weggooien.
// 2. Een reconnect tijdens een lopende opstart wacht op die poging in plaats van hem af te breken.
const src=fs.readFileSync(new URL('../stability-core.js',import.meta.url),'utf8')
  .replace('PLAYER_READY_TIMEOUT_MS=20000','PLAYER_READY_TIMEOUT_MS=120')
  .replace('PLAYER_CONNECT_TIMEOUT_MS=20000','PLAYER_CONNECT_TIMEOUT_MS=120')
  .replace('[1500,...RETRY_DELAYS]','[10]');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function boot(){
  const players=[],plan=[],records=[],store=new Map();
  // plan: per nieuwe speler na hoeveel ms 'ready' komt (null = nooit)
  class Player{constructor(){this.l={};this.n=players.length;this.dead=false;this.ms=plan.shift();players.push(this)}
    addListener(k,f){this.l[k]=f}disconnect(){this.dead=true}
    connect(){if(this.ms!=null)setTimeout(()=>{if(!this.dead)this.l.ready?.({device_id:'dev-'+this.n})},this.ms);return Promise.resolve(true)}}
  const ls={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const ctx={console,setTimeout,clearTimeout,setInterval,clearInterval,
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},
    localStorage:ls,sessionStorage:ls,navigator:{onLine:true},location:{search:'',pathname:'/'},history:{replaceState(){}},
    document:{visibilityState:'visible',getElementById:()=>null,addEventListener(){},head:{appendChild(){}}},
    tok:null,api:async p=>p==='/me/player/devices'?{devices:players.filter(x=>!x.dead).map(x=>({id:'dev-'+x.n}))}:{},
    setConnected(){},renderPlayback(){},token:'',refreshToken:'r',spotifyClientId:'x',connect:null,
    Spotify:{Player},JFMAuth:{state:{hasRefreshToken:true}},MAIRRuntime:{record:t=>records.push(t),caught(){}}};
  ctx.ensure=async()=>ctx.tok;// null tijdens het laden: de eigen opstart-reconcile van het script stopt dan meteen
  ctx.window=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  vm.runInNewContext(src,ctx);
  return {ctx,players,plan,records,sdk:ctx.JFMSpotifySDK};
}

{ // 1. Speler 0 komt nooit klaar. not_ready -> deviceLost -> reconnect bouwt speler 1. Speler 0 faalt daarna alsnog.
  const {ctx,players,plan,sdk}=boot();await wait(400);ctx.tok='tok';
  plan.push(null,20);
  const first=sdk.init().catch(()=>'mislukt');
  await wait(5);players[0].l.not_ready({device_id:''});
  await wait(250);
  assert.equal(await first,'mislukt');
  assert.equal(players.length,2);
  assert.equal(sdk.deviceId,'dev-1','nieuwe speler blijft staan na de late fout van de oude');
  assert.equal(sdk.player,players[1]);
  assert.equal(players[1].dead,false);
}
{ // 2. Opstart heeft 60 ms nodig. Een tik op Play (reconnect) na 10 ms wacht daarop.
  const {ctx,players,plan,records,sdk}=boot();await wait(400);ctx.tok='tok';
  plan.push(60);
  sdk.init();await wait(10);
  assert.equal(await sdk.reconnect(),'dev-0');
  assert.equal(players.length,1,'geen tweede speler gebouwd');
  assert.equal(players[0].dead,false);
  assert.ok(records.includes('spotify.reconnect-joins-init'));
}
{ // 3. Lopende opstart faalt: reconnect bouwt daarna alsnog een nieuwe speler.
  const {ctx,players,plan,sdk}=boot();await wait(400);ctx.tok='tok';
  plan.push(null,20);
  sdk.init().catch(()=>{});await wait(10);
  assert.equal(await sdk.reconnect(),'dev-1');
  assert.equal(sdk.player,players[1]);
}
console.log('MAIR sdk-init-race: PASS');process.exit(0);
