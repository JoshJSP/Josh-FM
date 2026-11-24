// MAIR busradio (Josh 25-11): knop "Bus" op het Radio-scherm, eigen busscherm, DJ-meldingen en ritsamenvatting.
// Heen: 500 Lekbrug > Sleeuwijk Tol West, 502 > Claudius Prinsenlaan. Terug andersom. Live tijden via /api/bus (Transitous).
// Alles hier is optioneel: elke fout wordt gelogd en de muziek speelt door. Praten gaat via MAIRCarRideDJ.announce({say}).
// iOS: met het scherm uit staat JavaScript stil. De meldingen komen dan pas als het scherm weer aangaat.
(()=>{
'use strict';
if(window.MAIRBus)return;
const C=window.MAIRBusCore;if(!C)return;
const $=id=>document.getElementById(id);
const RIDE='mair_bus_ride_v1',CACHE='mair_bus_cache_v1',RIDES='mair_car_rides_v1';
const TICK_MS=5000,FETCH_MS=30000,FIX_MS=60000,SAY_MAX_MS=4*60000;
const HOME={lat:51.9909,lon:5.0826},SCHOOL={lat:51.5866,lon:4.7926};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const log=(what,e)=>{try{window.MAIRRuntime?.caught?.('bus.'+what,e)}catch{/* log kapot: onschuldig */}};
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{/* opslag vol of geblokkeerd */}};
let S=fresh(),ritten=[],les=null,source='',fetchedAt=0,pos=null,watchId=null,tick=null,lastFetch=0,fetching=false,open=false,overlay=null,banner='',map=null,mapFailed=false,talking=false;
function fresh(dir=''){return{active:false,dir,phase:'',trip1:'',trip2:'',boardedAt:0,said:{},queue:[],done:null,at:Date.now()}}
const save=()=>{S.at=Date.now();write(RIDE,S)};
function restore(){const r=read(RIDE,null);if(r&&r.active&&Date.now()-Number(r.at||0)<3*3600000)S={...fresh(),...r};}

// ---- data ----
function current(){
  const now=Date.now();
  if(!ritten.length)return null;
  if(!S.trip1){
    // Halverwege starten: rijdt Josh al mee? Anders de eerstvolgende bus.
    const p=fix(),loc=p&&C.locate(ritten,p,now);
    if(loc){S.trip1=C.buses(loc.rit)[0].tripId;S.phase=loc.phase;S.boardedAt=Date.parse(C.buses(loc.rit)[0].start)}
    else{const a=advised(now);return a||C.pick(ritten,now)}
  }
  const r=ritten.find(x=>C.buses(x)[0]?.tripId===S.trip1);if(!r)return null;
  if(!S.trip2)return r;
  const b2=ritten.map(x=>C.buses(x)[1]).find(l=>l?.tripId===S.trip2);
  return b2?{...r,legs:[C.buses(r)[0],{mode:'WALK'},b2]}:r;
}
// Rooster: de bus die Josh voor zijn eerste les moet nemen (laatste die op tijd is). Alleen als die binnen 18 uur vertrekt.
function advised(now){const id=les?.bus?.[les.bus.length-1],r=id&&ritten.find(x=>C.buses(x)[0]?.tripId===id),t=r&&Date.parse(C.buses(r)[0].start);return r&&t>=now-60000&&t-now<18*3600000?r:null}
async function load(force=false){
  if(!S.dir||!force&&(fetching||Date.now()-lastFetch<FETCH_MS))return;
  const dir=S.dir;fetching=true;lastFetch=Date.now();// richting gewisseld tijdens het ophalen: het oude antwoord telt niet
  const first=S.trip1&&ritten.length?ritten.find(x=>C.buses(x)[0]?.tripId===S.trip1):null;
  const from=first?Date.parse(C.buses(first)[0].start)-60000:Date.now()-45*60000;
  try{
    const r=await fetch(`/api/bus?dir=${dir}&time=${encodeURIComponent(new Date(from).toISOString())}${dir==='heen'?'&les=1':''}`,{cache:'no-store',signal:AbortSignal.timeout?.(10000)});
    const d=r.ok?await r.json():null;if(dir!==S.dir)return;if(!d?.ok||!Array.isArray(d.ritten))throw Error(d?.error||'http '+r.status);
    // Lege lijst = er is verbinding maar er rijdt niks. Dat is iets anders dan geen data.
    ritten=d.ritten;les=d.les||null;source='live';fetchedAt=Date.now();
    if(ritten.length){const cache=read(CACHE,{});cache[dir]={at:fetchedAt,ritten:d.ritten.map(x=>({...x,legs:x.legs.map(l=>({...l,_line:undefined}))}))};write(CACHE,cache)}// lege lijst niet over de opgeslagen dienstregeling heen
  }catch(e){
    if(dir!==S.dir)return;log('fetch',e);
    // Geen internet of Transitous plat: de laatst opgehaalde dienstregeling, verschoven naar vandaag.
    const c=read(CACHE,{})[dir];if(c?.ritten?.length&&source!=='live'){ritten=C.shiftToToday(c.ritten,Date.now());source='cache';fetchedAt=c.at}
    else if(!ritten.length)source='none';
  }finally{fetching=false}
  if(dir===S.dir)step();
}

// ---- GPS ----
function fix(){return pos&&Date.now()-pos.at<FIX_MS?pos:null}
function onFix(p){
  const c=p.coords,next={lat:c.latitude,lon:c.longitude,acc:c.accuracy,at:Date.now(),speed:Number.isFinite(c.speed)&&c.speed>=0?c.speed:null};
  if(next.acc>150)return;// te grof om iets over in- of uitstappen te zeggen
  if(next.speed==null&&pos){const dt=(next.at-pos.at)/1000;if(dt>=2&&dt<=60)next.speed=C.dist(pos,next)/dt}
  pos=next;
  // Bij het openen is er vaak nog geen GPS en kiest de klok de richting. De eerste fix mag dat nog rechtzetten.
  if(S.guessed&&!S.trip1){S.guessed=false;const g=guessDir();if(g!==S.dir)return chooseDir(g)}
  step();
}
function watch(){if(watchId!=null||!navigator.geolocation)return;try{watchId=navigator.geolocation.watchPosition(onFix,e=>log('gps',Error(e?.message||'gps')),{enableHighAccuracy:true,maximumAge:5000,timeout:20000})}catch(e){log('gps',e)}}
function unwatch(){if(watchId!=null)try{navigator.geolocation.clearWatch(watchId)}catch{/* al weg */}watchId=null}

// ---- praten ----
function say(key,text){if(!text||S.said[key])return;S.said[key]=Date.now();S.queue.push({text,at:Date.now()});save();speakNext()}
async function speakNext(){
  if(talking)return;S.queue=S.queue.filter(x=>Date.now()-x.at<SAY_MAX_MS);const item=S.queue[0];if(!item)return;
  const dj=window.MAIRCarRideDJ;if(!dj?.announce)return;
  talking=true;
  try{if(await dj.announce({say:item.text})||window.MAIR_DJ_ENABLED!==true)S.queue.shift()}// DJ uit: niet blijven proberen
  catch(e){log('say',e)}
  finally{talking=false;save()}
}
function notify(title,body){
  banner=body;navigatorVibrate();
  try{if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body,icon:'mair-icon-512.png',tag:'mair-bus'})}catch(e){log('notify',e)}
}
function navigatorVibrate(){try{navigator.vibrate?.([200,100,200])}catch{/* geen trilmotor */}}

// ---- verloop ----
function step(){
  if(!S.active)return render();
  const before=S.phase,now=Date.now(),rit=current();// current() kan de fase zetten (halverwege gestart)
  if(!rit)return render();
  const prev=before,ph=C.phase(prev||null,rit,fix(),now),[b1,b2]=C.buses(rit);
  S.phase=ph;
  const riding=p=>p&&p!=='wachten';
  if(riding(ph)&&!riding(prev)){
    if(!S.trip1)S.trip1=b1.tripId;
    if(!S.boardedAt)S.boardedAt=ph==='in-1'&&prev==='wachten'?now:Date.parse(b1.start);
    if(ph!=='aangekomen')say('start',C.startLine(rit,ph,S.dir));
  }
  if(ph==='in-1'){
    const t=C.transfer(rit);
    if(t?.status==='gemist'&&!S.said['missed-'+b2.tripId]){
      const next=C.nextConnection(ritten,rit),text=C.missedLine(rit,next,S.dir);
      say('missed-'+b2.tripId,text);notify('Overstap gemist',text);
      if(next){S.trip2=next.tripId;delete S.said.soon}
    }else if(C.mins(b1.end,new Date(now).toISOString())<=4)say('soon',C.soonLine(rit));
  }
  const leg=ph==='in-1'?b1:ph==='in-2'||ph==='overstap'?b2:null,d=C.delay(leg);
  if(leg&&d>=3)say(`delay-${leg.tripId}-${Math.floor(d/3)}`,C.delayLine(leg,S.dir,b2));
  if(riding(ph))C.alerts(rit).forEach((a,i)=>say('alert-'+a.slice(0,40),`Let op: ${a}`));
  if(ph==='aangekomen'&&!S.done)arrive(rit,now);
  save();speakNext();render();
}
function arrive(rit,now){
  const sum=C.summary(rit,S.boardedAt||now,now),item={at:now,name:S.dir==='terug'?'Bus naar huis':'Bus naar BUas',arrived:true,min:sum.min,diff:sum.diff,km:null,avg:null,max:null};
  S.done=item;
  // Zelfde lijst als Car Mode, dan staat de busrit ook op de Profiel-tab. Car Mode's aankomst-DJ zegt de zin.
  const list=read(RIDES,[]);write(RIDES,[item,...(Array.isArray(list)?list:[])].slice(0,10));
  try{dispatchEvent(new CustomEvent('mair:car-ride-end',{detail:{...item,bus:true}}))}catch{/* alleen een melding */}
  S.active=false;unwatch();stopTimers();
}

// ---- muziek ----
function music(){
  try{
    const st=window.MAIRStationController,t=window.JFMPlaybackState?.get?.();
    // Bus-mix = Josh' eigen mix. Een ander station wisselen we om, verder blijft alles wat al speelt gewoon spelen.
    if(st?.channel&&st.channel!=='mix'){st.select?.('mix');return}
    if(!t?.isPlaying){const b=$('play')&&!$('play').disabled?$('play'):$('start');if(b&&!b.disabled)b.click()}
  }catch(e){log('music',e)}
}

// ---- kaart (Mapbox, zoals Car Mode; valt hij uit, dan blijft de rest gewoon werken) ----
let libP=null,token='';
function lib(){if(libP)return libP;libP=new Promise((ok,no)=>{if(window.mapboxgl)return ok(window.mapboxgl);const B='vendor/mapbox-gl/',l=document.createElement('link');l.rel='stylesheet';l.href=B+'mapbox-gl.css';document.head.appendChild(l);const s=document.createElement('script');s.src=B+'mapbox-gl-csp.js';s.onload=()=>{try{window.mapboxgl.workerUrl=new URL(B+'mapbox-gl-csp-worker.js',location.href).href;ok(window.mapboxgl)}catch(e){no(e)}};s.onerror=()=>no(Error('kaart niet geladen'));document.head.appendChild(s)}).catch(e=>{libP=null;throw e});return libP}
const fc=f=>({type:'FeatureCollection',features:f});
const pt=(p,kind)=>p?{type:'Feature',properties:{kind},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}:null;
function geo(rit){const now=Date.now(),[b1,b2]=C.buses(rit),leg=S.phase==='in-2'||S.phase==='overstap'||(b1&&now>Date.parse(b1.end))?b2:b1;return{route:fc(C.buses(rit).map((l,i)=>({type:'Feature',properties:{i},geometry:{type:'LineString',coordinates:C.lineOf(l).map(p=>[p.lon,p.lat])}}))),dots:fc([pt(leg&&C.busPos(leg,now),'bus'),pt(fix(),'me')].filter(Boolean)),stops:fc([b1?.from,b1?.to,b2?.to].filter(Boolean).map(p=>pt(p,'stop')))}}
async function mapUpdate(rit){
  const host=$('mairBusMap');if(!host||!rit||mapFailed)return;
  try{
    const g=geo(rit);
    if(map&&map.getContainer()!==host){try{map.remove()}catch{/* weg */}map=null}
    if(!map){
      if(!token){const r=await fetch('/api/config',{cache:'no-store'});token=String((await r.json()).mapboxPublicToken||'')}
      if(!token)throw Error('Mapbox-token ontbreekt');
      const gl=await lib();gl.accessToken=token;
      map=new gl.Map({container:host,style:'mapbox://styles/mapbox/navigation-night-v1',attributionControl:false,interactive:true});
      map.on('load',()=>{map.addSource('r',{type:'geojson',data:g.route});map.addSource('s',{type:'geojson',data:g.stops});map.addSource('d',{type:'geojson',data:g.dots});
        map.addLayer({id:'r',type:'line',source:'r',paint:{'line-color':['match',['get','i'],0,'#9b4dff','#36d7b7'],'line-width':4}});
        map.addLayer({id:'s',type:'circle',source:'s',paint:{'circle-radius':5,'circle-color':'#fff'}});
        map.addLayer({id:'d',type:'circle',source:'d',paint:{'circle-radius':['match',['get','kind'],'bus',9,7],'circle-color':['match',['get','kind'],'bus','#ffcc33','#4aa3ff'],'circle-stroke-width':2,'circle-stroke-color':'#08070e'}});
        fit(g);map._mairReady=true});
      map.on('error',e=>log('map',e?.error||Error('map')));
    }else if(map._mairReady){map.getSource('r').setData(g.route);map.getSource('s').setData(g.stops);map.getSource('d').setData(g.dots);if(map._mairTrip!==S.trip1+S.trip2)fit(g)}
    map._mairTrip=S.trip1+S.trip2;
  }catch(e){mapFailed=true;log('map',e);host.hidden=true}
}
function fit(g){try{const c=g.route.features.flatMap(f=>f.geometry.coordinates);if(!c.length)return;const lo=c.map(x=>x[0]),la=c.map(x=>x[1]);map.fitBounds([[Math.min(...lo),Math.min(...la)],[Math.max(...lo),Math.max(...la)]],{padding:24,duration:0})}catch(e){log('map.fit',e)}}

// ---- scherm ----
const hm=t=>t?C.hm(t):'--:--';
const dayKey=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Europe/Amsterdam'});
const dayName=t=>{const d=dayKey(t);return d===dayKey(Date.now())?'vandaag':d===dayKey(Date.now()+86400000)?'morgen':new Date(t).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Amsterdam'})};
// Ver weg (s nachts de eerste bus van morgen): een klok in plaats van "over 412 min".
const until=t=>{const m=Math.round((Date.parse(t)-Date.now())/60000);if(m>=90){const n=dayName(t);return n==='vandaag'?`om ${C.hm(t)}`:`${n} om ${C.hm(t)}`}return m<=0?'nu':m===1?'over 1 min':`over ${m} min`};
const late=l=>{const d=C.delay(l);return d>0?` <em class="mair-bus-late">+${d}</em>`:''};
function headline(rit){
  if(S.done)return['Je bent er',window.MAIRCarRideDJ?.arrivalLine?.(S.done)||''];
  if(!rit)return source==='none'?['Geen busdata','Geen verbinding en nog geen opgeslagen dienstregeling.']:source==='live'?['Geen bus gevonden','De komende 12 uur rijdt er geen 500 of 502.']:['Bustijden laden…',''];
  const[b1,b2]=C.buses(rit);
  if(S.phase==='in-1')return[`In de ${b1.lijn}`,`Overstappen ${until(b1.end)} · ${hm(b1.end)}`];
  if(S.phase==='overstap')return[`Overstap op de ${b2.lijn}`,`Vertrekt ${until(b2.start)} · ${hm(b2.start)}`];
  if(S.phase==='in-2')return[`In de ${b2.lijn}`,`Uitstappen ${until(b2.end)} · ${hm(b2.end)}`];
  const far=Date.parse(b1.start)-Date.now()>=90*60000;
  return[`Wachten op de ${b1.lijn}`,`Vertrekt ${until(b1.start)}${far?'':' · '+hm(b1.start)}${b1.cancelled?' · rijdt niet':''}`];
}
function infoHtml(rit){
  if(!rit||S.done)return'';
  const[b1,b2]=C.buses(rit),t=C.transfer(rit),pill=t?`<i class="mair-bus-pill is-${t.status}">${t.status}</i>`:'';
  const alerts=C.alerts(rit).map(a=>`<p class="mair-bus-alert">${esc(a)}</p>`).join('');
  return`${lesHtml()}<div class="mair-bus-rows"><div><small>OVERSTAP ${esc(String(b1.to?.name||'').replace(/^[^,]*,\s*/,'').toUpperCase())}</small><b>${hm(b1.end)}${late(b1)} → ${esc(b2.lijn)} ${hm(b2.start)} ${pill}</b></div><div><small>${S.dir==='terug'?'THUIS (LEKBRUG)':'OP SCHOOL'}</small><b>${hm(b2.end)}${late(b2)}</b></div></div>${alerts}`;
}
function lesHtml(){
  if(S.dir!=='heen'||!les?.start||S.phase&&S.phase!=='wachten')return'';
  const label=`${dayName(les.start)==='vandaag'?'EERSTE LES VANDAAG':'VOLGENDE LES '+dayName(les.start).toUpperCase()} ${C.hm(les.start)}`;
  const opts=(les.bus||[]).map(id=>ritten.find(x=>C.buses(x)[0]?.tripId===id)).filter(Boolean);
  if(!opts.length)return`<div class="mair-bus-les"><small>${esc(label)}</small><b>Geen 500/502 gevonden die op tijd is</b></div>`;
  const best=opts[opts.length-1],[b1,b2]=C.buses(best),eerder=opts.slice(0,-1).reverse().map(r=>hm(C.buses(r)[0].start));
  return`<div class="mair-bus-les"><small>${esc(label)}</small><b>Neem de ${hm(b1.start)} · op school ${hm(b2?.end)}</b>${eerder.length?`<span>Eerder kan ook: ${eerder.join(', ')}</span>`:''}</div>`;
}
function sourceText(){const t=fetchedAt?new Date(fetchedAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'';return source==='live'?`Live OV-data · ${t}`:source==='cache'?`Vaste dienstregeling (geen verbinding) · van ${new Date(fetchedAt).toLocaleDateString('nl-NL')}`:''}
function nowPlaying(){const img=$('artImg');return{title:String($('title')?.textContent||'').trim()||'MAIRFM',artist:String($('artist')?.textContent||'').trim(),art:img&&!img.classList.contains('hidden')?img.currentSrc||img.src:'mair-icon-512.png',playing:!!window.JFMPlaybackState?.get?.()?.isPlaying}}
function ensure(){
  if(overlay)return overlay;
  overlay=document.createElement('div');overlay.id='mairBusOverlay';overlay.className='mair-bus-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Busradio');
  overlay.innerHTML=`<header class="mair-bus-head"><button type="button" class="mair-bus-icon" data-bus="close" aria-label="Sluiten">‹</button><strong>MAIRFM <span>· BUS</span></strong><div class="mair-bus-dir"><button type="button" data-bus="heen">Heen</button><button type="button" data-bus="terug">Terug</button></div></header>
<section class="mair-bus-status"><h2 id="mairBusTitle"></h2><p id="mairBusSub"></p><div id="mairBusInfo"></div><p id="mairBusBanner" class="mair-bus-banner" hidden></p></section>
<div id="mairBusMap" class="mair-bus-map"></div>
<section class="mair-bus-music"><img id="mairBusArt" alt=""><div class="mair-bus-meta"><b id="mairBusTrack"></b><span id="mairBusArtist"></span></div><div class="mair-bus-transport"><button type="button" data-bus="prev" aria-label="Vorige">‹</button><button type="button" class="is-play" data-bus="play" aria-label="Afspelen of pauzeren">▶</button><button type="button" data-bus="next" aria-label="Volgende">›</button></div></section>
<footer class="mair-bus-foot"><span id="mairBusSource"></span><button type="button" data-bus="stop">Rit stoppen</button><small>Scherm uit: de muziek speelt door, de busmeldingen komen als je het scherm weer aanzet.</small></footer>`;
  overlay.addEventListener('click',e=>{const a=e.target.closest('[data-bus]')?.dataset.bus;if(!a)return;
    if(a==='close')return setOpen(false);
    if(a==='heen'||a==='terug')return chooseDir(a);
    if(a==='stop'){S=fresh(S.dir);save();unwatch();stopTimers();banner='';return setOpen(false)}
    const el=$(a);if(el&&!el.disabled)el.click();else if(a==='play')window.JFMPlayback?.playPause?.();setTimeout(render,150)});
  document.body.appendChild(overlay);return overlay;
}
function render(){
  syncLauncher();
  if(!open||!overlay)return;
  const rit=S.done?null:current(),[title,sub]=headline(rit),np=nowPlaying();
  $('mairBusTitle').textContent=title;$('mairBusSub').textContent=sub;$('mairBusInfo').innerHTML=infoHtml(rit);
  const bn=$('mairBusBanner');bn.hidden=!banner;bn.textContent=banner;
  $('mairBusSource').textContent=sourceText();
  overlay.querySelectorAll('.mair-bus-dir button').forEach(b=>{b.classList.toggle('is-on',b.dataset.bus===S.dir);b.disabled=!!(S.phase&&S.phase!=='wachten'&&!S.done)});
  overlay.querySelector('[data-bus="stop"]').hidden=!S.active;
  $('mairBusTrack').textContent=np.title;$('mairBusArtist').textContent=np.artist;
  const art=$('mairBusArt');if(art.getAttribute('src')!==np.art)art.setAttribute('src',np.art);
  overlay.querySelector('.is-play').textContent=np.playing?'❚❚':'▶';
  if(rit)mapUpdate(rit);
}
function syncLauncher(){
  const radio=$('tab-radio');if(!radio)return;
  let b=$('mairBusOpen');
  if(!b){b=document.createElement('button');b.id='mairBusOpen';b.type='button';b.className='mair-sleep-launch mair-bus-launch';b.addEventListener('click',()=>setOpen(true));
    const anchor=$('mairCarModeOpen');if(anchor)anchor.insertAdjacentElement('afterend',b);else{const g=$('djNow')?.closest('.grid2');if(g)g.insertAdjacentElement('afterend',b);else radio.appendChild(b)}}
  const ph={'wachten':'wacht op de bus','in-1':'in de bus','overstap':'overstappen','in-2':'in de bus'}[S.phase]||'';
  const html=`🚌 Bus <span>${S.active&&ph?'Busradio aan · '+ph:'Busradio naar BUas en terug'}</span>`;if(b.innerHTML!==html)b.innerHTML=html;
}
// Bij Lekbrug = heen, bij school = terug. Onderweg zegt de plek niets over de richting, dan beslist de klok.
function guessDir(){const p=fix();if(p&&C.dist(p,HOME)<3000)return'heen';if(p&&C.dist(p,SCHOOL)<3000)return'terug';return new Date().getHours()<12?'heen':'terug'}
function chooseDir(dir){if(S.dir===dir&&S.active)return;S={...fresh(dir),active:true,queue:S.queue};ritten=[];les=null;source='';fetchedAt=0;banner='';save();load(true);render()}
function startTimers(){stopTimers();tick=setInterval(()=>{if(document.visibilityState==='visible'){load();step()}},TICK_MS)}
function stopTimers(){if(tick)clearInterval(tick);tick=null}
function setOpen(v){
  ensure();open=!!v;overlay.classList.toggle('is-open',open);document.body.classList.toggle('mair-bus-open',open);
  if(open){
    try{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch?.(()=>{})}catch{/* geen meldingen */}
    if(!S.active||S.done){S={...fresh(guessDir()),active:true,guessed:true};save();music()}
    watch();startTimers();load(true);
  }
  render();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.active){load(true);step()}});
['jfm:trackchange','jfm:playback-state'].forEach(n=>addEventListener(n,()=>{if(open)render()}));
restore();
if(S.active){watch();startTimers();load(true)}
const boot=()=>{try{syncLauncher()}catch(e){log('launcher',e)}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,1500);addEventListener('mair:runtime-ready',boot);
window.MAIRBus={version:'bus-v1',open:()=>setOpen(true),close:()=>setOpen(false),state:()=>({...S,source,ritten:ritten.length,les,pos:fix()}),_set:(r,p)=>{if(r)ritten=r,source='live',fetchedAt=Date.now();if(p!==undefined)pos=p;step()}};
})();
