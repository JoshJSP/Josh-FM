// MAIRFM Car Mode: flitsmeldingen. Alleen vaste flitspalen en trajectcontroles uit OpenStreetMap (Overpass), geen mobiele flitsers.
// - Data per vak (0,1° x 0,15°, ~11 x 10 km), één aanvraag per vak, daarna 7 dagen in het geheugen en in localStorage. Nooit per gps-fix.
//   De aanvragen gaan één voor één met 3 s ertussen. Zonder route halen we het vak van de auto en het vak 6 km vooruit, met route
//   de vakken tot 40 km vooruit langs de route.
// - Met route: een flitser telt als hij op de route ligt (<= 20 m) en voor je ligt. Zonder route: hij ligt voor je (rijrichting)
//   en dichtbij de lijn van je rijrichting. Zonder route kan een flitser aan de andere kant van een smalle weg niet worden
//   onderscheiden van een aan jouw kant, en op een bocht zie je hem pas dichterbij. Een trajectcontrole heeft een richting
//   (van -> naar), dus daar werkt de richting wel.
// - Niets bekend (vak niet geladen, Overpass stuk) betekent niets tonen. Nooit een "geen flitsers"-melding.
// - Alles is optioneel: een fout hier mag Car Mode en de muziek nooit raken.
(()=>{
'use strict';
if(window.MAIRCarCams)return;
const ON_KEY='mair_car_cams_on_v1',CACHE_KEY='mair_car_cams_v2',OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const TILE_LAT=.1,TILE_LON=.15,TTL_MS=7*864e5,KEEP=40,GAP_MS=3000,FETCH_MS=25000,RETRY_MS=300000,AHEAD_M=6000,ROUTE_AHEAD_M=40000,MAP_M=6000;
const ROUTE_SNAP_M=20,SEC_SNAP_M=35,PASS_M=8,MIN_SPEED=3,R=Math.PI/180;
let on=true;try{on=localStorage.getItem(ON_KEY)!=='0'}catch{/* geen opslag: standaard aan */}
let tiles=null,pending=[],busy=false,lastFetch=0,fetches=0,errs=0,lastErr='',ver=0,beeps=0;
const failed=new Map(),beeped=new Set();
let alert=null,html='',last=null,routeIdx=null,inSec=null,prevPos=null,travelled=0,wasRoute=false,mapSig='',mapAt=null,ac=null;
const flat=(a,b)=>{const k=Math.cos((a.latitude+b.latitude)/2*R);return{x:(b.longitude-a.longitude)*111320*k,y:(b.latitude-a.latitude)*110540}};
const brg=(a,b)=>{const o=flat(a,b);return(Math.atan2(o.x,o.y)/R+360)%360};
const diff=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
const tk=(la,lo)=>Math.floor(la/TILE_LAT)+','+Math.floor(lo/TILE_LON);
const tkOf=p=>tk(p.latitude,p.longitude);
const maxOf=v=>{const m=/^(\d+)\s*(mph)?$/i.exec(String(v||'').trim());return m?Math.round(m[2]?m[1]*1.609344:+m[1]):null};
function load(){
  if(tiles)return tiles;tiles=new Map();
  try{const o=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');for(const[k,v]of Object.entries(o))if(v&&Date.now()-v.t<TTL_MS&&Array.isArray(v.cams)&&Array.isArray(v.secs))tiles.set(k,v)}catch{/* kapotte cache: opnieuw ophalen */}
  return tiles
}
function save(){
  try{const e=[...tiles.entries()].sort((a,b)=>b[1].t-a[1].t).slice(0,KEEP);localStorage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(e)))}catch{/* vol of geen opslag: het geheugen blijft werken */}
}
function query(k){
  const[a,b]=k.split(',').map(Number),bb=[a*TILE_LAT,b*TILE_LON,(a+1)*TILE_LAT,(b+1)*TILE_LON].map(x=>x.toFixed(4)).join(',');
  // out body, niet out tags: 'tags' laat de leden van een relatie weg, en zonder leden (from/to/device) vielen alle 80
  // trajectcontroles in NL weg of werden losse punten (20-10-2026). Ook losse punten met alleen enforcement=maxspeed (16 in NL).
  return`[out:json][timeout:20];(node["highway"="speed_camera"](${bb});node["enforcement"~"^(maxspeed|average_speed)$"](${bb});rel["type"="enforcement"]["enforcement"~"^(maxspeed|average_speed)$"](${bb}););out body geom;`
}
// Overpass -> {cams, secs}. Een enforcement-relatie met een begin (from) en einde (to) is een trajectcontrole; de camera's
// (device) daarvan tellen niet los mee. Heeft de relatie geen begin en einde, dan zijn de devices gewone flitsers.
function parse(d){
  const pt=m=>m&&Number.isFinite(m.lat)&&Number.isFinite(m.lon)?{latitude:m.lat,longitude:m.lon}:null;
  const first=m=>m.type==='node'?pt(m):pt(m.geometry?.[0]),end=m=>m.type==='node'?pt(m):pt(m.geometry?.at(-1));
  const els=d?.elements||[],cams=[],secs=[],dev=new Set();
  for(const e of els){
    if(e.type!=='relation')continue;
    const ms=e.members||[],by=r=>ms.filter(m=>m.role===r),devs=by('device').map(first).filter(Boolean),max=maxOf(e.tags?.maxspeed);
    by('device').forEach(m=>{if(m.type==='node')dev.add(m.ref)});
    const f=by('from').map(first).find(Boolean)||devs[0],t=by('to').map(end).find(Boolean)||devs.at(-1);
    if(f&&t&&Math.hypot(flat(f,t).x,flat(f,t).y)>100)secs.push({id:'r'+e.id,max,f,t});
    else devs.forEach((p,i)=>cams.push({id:`r${e.id}.${i}`,max,...p}))
  }
  for(const e of els){if(e.type==='node'&&(e.tags?.highway==='speed_camera'||/^(maxspeed|average_speed)$/.test(e.tags?.enforcement||''))&&!dev.has(e.id)&&pt(e))cams.push({id:'n'+e.id,max:maxOf(e.tags.maxspeed),...pt(e)})}
  return{cams,secs}
}
function fetchJson(url,ms){const ac=new AbortController(),to=setTimeout(()=>ac.abort(),ms);return fetch(url,{signal:ac.signal}).then(r=>{if(!r.ok)throw Error('http '+r.status);return r.json()}).finally(()=>clearTimeout(to))}
async function pump(){
  if(busy||!on)return;const k=pending.shift();if(!k)return;
  busy=true;
  try{
    const wait=GAP_MS-(Date.now()-lastFetch);if(wait>0)await new Promise(r=>setTimeout(r,wait));
    if(!on)return;
    lastFetch=Date.now();fetches++;let d=null,why='';
    for(const url of OVERPASS){try{d=await fetchJson(`${url}?data=${encodeURIComponent(query(k))}`,FETCH_MS);break}catch(e){why=e?.name==='AbortError'?'time-out':String(e?.message||e)}}
    if(!d){failed.set(k,Date.now());errs++;lastErr=why;try{window.MAIRRuntime?.caught?.('carmode.cams',Error(why))}catch{/* log kapot: onschuldig */}}
    else{load().set(k,{t:Date.now(),...parse(d)});failed.delete(k);ver++;routeIdx=null;save()}
  }catch(e){errs++;lastErr=String(e?.message||e)}
  finally{busy=false;if(pending.length)setTimeout(pump,0);if(last)evaluate(last)}
}
// Welke vakken hebben we nodig? Dat van de auto, plus vooruit (zonder route 6 km in de rijrichting, met route langs de route).
function need(a){
  const ks=[tkOf(a.pos)],r=a.route;
  if(r?.geom?.length>1){let next=r.along;for(let i=1;i<r.geom.length;i++){const c=r.cum[i];if(c<next)continue;if(c>r.along+ROUTE_AHEAD_M)break;ks.push(tkOf(r.geom[i]));next=c+2500}}
  else if(Number.isFinite(a.bearing)){const m=AHEAD_M,h=a.bearing*R;ks.push(tk(a.pos.latitude+m*Math.cos(h)/110540,a.pos.longitude+m*Math.sin(h)/(111320*Math.cos(a.pos.latitude*R))))}
  const t=load(),now=Date.now();
  for(const k of ks)if(!t.has(k)&&!pending.includes(k)&&pending.length<12&&now-(failed.get(k)||0)>RETRY_MS)pending.push(k);
  pump()
}
function routeIndex(a){
  const r=a.route;if(routeIdx&&routeIdx.g===r.geom&&routeIdx.v===ver)return routeIdx;
  let s=90,w=190,n=-90,e=-190;for(const p of r.geom){if(p.latitude<s)s=p.latitude;if(p.latitude>n)n=p.latitude;if(p.longitude<w)w=p.longitude;if(p.longitude>e)e=p.longitude}
  const pad=.0005,near=p=>p.latitude>=s-pad&&p.latitude<=n+pad&&p.longitude>=w-pad&&p.longitude<=e+pad,cams=[],secs=[];
  for(const t of load().values()){
    for(const c of t.cams)if(near(c)){const m=r.project(c);if(m&&m.distance<=ROUTE_SNAP_M)cams.push({o:c,along:m.along})}
    for(const x of t.secs)if(near(x.f)&&near(x.t)){const f=r.project(x.f),t2=r.project(x.t);if(f&&t2&&f.distance<=SEC_SNAP_M&&t2.distance<=SEC_SNAP_M&&f.along<t2.along)secs.push({o:x,a0:f.along,a1:t2.along})}
  }
  return routeIdx={g:r.geom,v:ver,cams,secs}
}
// De dichtstbijzijnde melding. kind: cam (flitser voor je), secahead (begin trajectcontrole voor je), secin (je zit erin).
function decide(a,v,h){
  const alertM=Math.max(400,Math.min(1000,v*20));let cam=null,sec=null,inside=null;
  const pick=(cur,d,o,kind)=>!cur||d<cur.dist?{kind,dist:d,max:o.max,id:o.id}:cur;
  if(a.route?.on){
    const ri=routeIndex(a),al=a.route.along;
    if(Number.isFinite(al)){
      for(const c of ri.cams){const d=c.along-al;if(d>PASS_M&&d<=alertM)cam=pick(cam,d,c.o,'cam')}
      for(const s of ri.secs){const d=s.a0-al;if(al>=s.a0-PASS_M&&al<=s.a1)inside={kind:'secin',dist:s.a1-al,max:s.o.max,id:s.o.id};else if(d>PASS_M&&d<=alertM)sec=pick(sec,d,s.o,'secahead')}
    }
    inSec=null
  }else{
    const t=load(),k=tkOf(a.pos),[ka,kb]=k.split(',').map(Number);
    const moving=h!=null&&v>=MIN_SPEED,hx=moving?Math.sin(h*R):0,hy=moving?Math.cos(h*R):0;
    const ahead=p=>{const o=flat(a.pos,p),along=o.x*hx+o.y*hy,cross=Math.abs(o.x*hy-o.y*hx);return{along,cross,ok:moving&&along>PASS_M&&along<=alertM&&cross<=Math.min(30,12+.03*along)}};
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const tt=t.get(`${ka+i},${kb+j}`);if(!tt)continue;
      for(const c of tt.cams){const x=ahead(c);if(x.ok)cam=pick(cam,x.along,c,'cam')}
      for(const s of tt.secs){
        const x=ahead(s.f),dirOk=moving&&diff(h,brg(s.f,s.t))<=60;
        if(dirOk&&x.ok)sec=pick(sec,x.along,s,'secahead');
        // je rijdt langs het begin: de trajectcontrole begint. Einde (60 m van het eindpunt) of te ver gereden = klaar.
        else if(!inSec&&dirOk&&alert?.kind==='secahead'&&alert.id===s.id&&x.along<=PASS_M&&x.along>-120&&x.cross<=40){inSec={o:s,L:Math.hypot(flat(s.f,s.t).x,flat(s.f,s.t).y)};travelled=0}
      }
    }
    if(inSec){
      const s=inSec.o;
      if(prevPos)travelled+=Math.hypot(flat(prevPos,a.pos).x,flat(prevPos,a.pos).y);
      if(Math.hypot(flat(a.pos,s.t).x,flat(a.pos,s.t).y)<=60||travelled>inSec.L*1.5+500)inSec=null;
      else inside={kind:'secin',dist:null,max:s.max,id:s.id}
    }
  }
  // zit je in een trajectcontrole, dan zegt een tweede trajectcontrole voor je niets (bijvoorbeeld die van de andere rijbaan)
  return inside?cam||inside:cam&&sec?(cam.dist<=sec.dist?cam:sec):cam||sec
}
function evaluate(a){
  last=a;
  if(!on||!a?.pos)return setAlert(null);
  const v=Number.isFinite(a.speed)?a.speed:0,h=Number.isFinite(a.bearing)?a.bearing:null,isRoute=!!a.route?.on;
  if(isRoute!==wasRoute){wasRoute=isRoute;inSec=null}
  let next=null;
  try{next=decide(a,v,h)}catch(e){errs++;lastErr=String(e?.message||e)}
  prevPos={latitude:a.pos.latitude,longitude:a.pos.longitude};
  setAlert(next);mapSync(a.pos)
}
function feed(a){
  if(!on||!a?.pos)return;
  try{need(a)}catch(e){errs++;lastErr=String(e?.message||e)}
  evaluate(a)
}
function setAlert(next){
  const was=alert;alert=next;
  if(next&&(!was||was.id!==next.id||was.kind!==next.kind)){const key=`${next.id}:${next.kind==='secin'?'in':'ahead'}`;if(!beeped.has(key)){beeped.add(key);beep()}}
  const h=cardHtml();if(h!==html){html=h;try{window.MAIRCarModePrototype?.render?.()}catch{/* Car Mode zonder render: onschuldig */}}
}
// Kort en zacht, één toon. Zonder audio (of geblokkeerd) staat de melding nog gewoon op het scherm.
function beep(){
  beeps++;
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    ac=ac||new C();if(ac.state==='suspended')ac.resume().catch(()=>{});
    const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=880;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.02);g.gain.linearRampToValueAtTime(0,t+.18);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.22)
  }catch{/* geen audio: onschuldig */}
}
const fmt=m=>m>=1000?`${(Math.round(m/100)/10).toFixed(1).replace('.',',')} km`:`${m>=200?Math.round(m/50)*50:Math.round(m/10)*10} m`;
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5h4l1.4-2.5h7L17 8.5h4V19H3z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.2" fill="none" stroke="#fff" stroke-width="2"/></svg>';
function cardHtml(){
  if(!on||!alert)return'';
  const a=alert,title=a.kind==='cam'?`Flitser over ${fmt(a.dist)}`:a.kind==='secahead'?`Trajectcontrole over ${fmt(a.dist)}`:'Trajectcontrole';
  const sub=a.kind==='secin'&&a.dist!=null?`nog ${fmt(a.dist)}`:'',kmh=Number.isFinite(last?.speed)&&last.speed>=0?last.speed*3.6:null,over=a.max&&kmh!=null&&kmh>a.max+1;
  return`<aside class="car-cam-card${over?' over':''}" data-kind="${a.kind}"><i class="car-cam-ico">${ICON}</i><div><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div>${a.max?`<span class="car-cam-limit" aria-label="Maximumsnelheid ${a.max}">${a.max}</span>`:''}</aside>`
}
// Iconen op de kaart: de flitsers in de vakken rond de auto (hooguit 6 km), de actieve iets groter.
function mapSync(pos){
  const M=window.MAIRCarMap;if(!M?.setCams)return;
  const sig=`${ver}|${alert?.id||''}`;
  if(sig===mapSig&&mapAt&&Math.hypot(flat(mapAt,pos).x,flat(mapAt,pos).y)<1500)return;
  mapSig=sig;mapAt={latitude:pos.latitude,longitude:pos.longitude};
  const f=[],add=(p,id)=>{if(Math.hypot(flat(pos,p).x,flat(pos,p).y)<=MAP_M)f.push({type:'Feature',properties:{on:alert&&alert.id===id?1:0},geometry:{type:'Point',coordinates:[p.longitude,p.latitude]}})};
  for(const t of load().values()){for(const c of t.cams)add(c,c.id);for(const s of t.secs){add(s.f,s.id);add(s.t,s.id)}}
  M.setCams(f)
}
function clear(){alert=null;html='';inSec=null;routeIdx=null;prevPos=null;mapSig='';mapAt=null;try{window.MAIRCarMap?.setCams?.([])}catch{/* kaart al weg: onschuldig */}}
function toggle(){
  on=!on;try{localStorage.setItem(ON_KEY,on?'1':'0')}catch{/* geen opslag: geldt tot herladen */}
  if(!on){pending=[];clear()}
  return on
}
// Car Mode dicht: geen melding meer, de vakken blijven in het geheugen.
function reset(){pending=[];beeped.clear();last=null;clear()}
window.MAIRCarCams={feed,cardHtml,toggle,reset,isOn:()=>on,
  status:()=>({on,tiles:load().size,pending:pending.length,fetches,errs,lastErr,beeps,alert:alert?{...alert}:null,cams:[...load().values()].reduce((n,t)=>n+t.cams.length+t.secs.length,0)})};
})();
