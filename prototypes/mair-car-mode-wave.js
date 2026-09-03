// MAIRFM Car Mode — music-first navigation + Journey context
(()=>{
'use strict';
if(window.MAIRCarModePrototype?.version?.includes?.('journey-nav'))return;
const $=id=>document.getElementById(id),CFG='/api/config';
let overlay=null,open=false,wake=null,wakeRetry=null,searchTimer=null,searchAbort=null,routeAbort=null,refreshTimer=null,token='',recents=[];
const s={screen:'home',routeActive:false,origin:null,destination:null,stops:[],route:null,steps:[],step:0,pos:null,watch:null,near:false,error:'',loading:false,lastRoute:0,off:0,searchQuery:'',searchResults:[],searchPurpose:'destination',geo:{status:'unknown',message:'',at:0}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dist=m=>!Number.isFinite(m)?'—':m<1000?`${Math.max(10,Math.round(m/10)*10)} M`:`${m/1000<10?(m/1000).toFixed(1):Math.round(m/1000)} KM`;
const dur=x=>{if(!Number.isFinite(x))return'—';const m=Math.max(0,Math.round(x/60));return m<60?`${m} MIN`:`${Math.floor(m/60)}U ${String(m%60).padStart(2,'0')}M`};
const eta=x=>Number.isFinite(x)?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'}).format(new Date(Date.now()+x*1000)):'--:--';
function play(){try{const p=window.JFMPlaybackState?.get?.()||{},img=$('artImg');return{title:String($('title')?.textContent||p.title||p.name||'MAIRFM').trim(),artist:String($('artist')?.textContent||p.artist||'').trim(),image:String(img?.currentSrc||img?.src||'mair-icon-512.png'),isPlaying:typeof p.isPlaying==='boolean'?p.isPlaying:!!p.expectedLive,progress:Number(p.progressMs||p.progress_ms||0),duration:Number(p.durationMs||p.duration_ms||0)}}catch{return{title:'MAIRFM',artist:'',image:'mair-icon-512.png',isPlaying:false,progress:0,duration:0}}}
function next(){try{return(window.jfmUpcoming?.()||[])[0]||null}catch{return null}}
async function config(){try{const r=await fetch(CFG,{cache:'no-store'});if(r.ok)token=String((await r.json()).mapboxPublicToken||'').trim()}catch{}return token}
const hav=(a,b)=>{if(!a||!b)return Infinity;const R=6371000,r=x=>x*Math.PI/180,d1=r(b.latitude-a.latitude),d2=r(b.longitude-a.longitude),q=Math.sin(d1/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
const geo=opts=>new Promise((ok,no)=>{if(!navigator.geolocation)return no(Object.assign(Error('Locatie niet beschikbaar.'),{code:2}));navigator.geolocation.getCurrentPosition(ok,no,opts||{enableHighAccuracy:true,timeout:15000,maximumAge:10000})});
// Locatiestatus is expliciet: iOS toont de systeemprompt pas bij de eerste echte
// aanvraag, en weigering/timeout/onbeschikbaar moeten los van elkaar leesbaar zijn.
const GEO_TEXT={denied:'MAIRFM mag je locatie niet gebruiken. Zet dit aan via Instellingen › MAIRFM › Locatie en probeer opnieuw.',unavailable:'Je locatie is nu niet beschikbaar. Controleer of Locatievoorzieningen aanstaan.',timeout:'Het duurde te lang om je locatie te bepalen. Probeer het opnieuw.',error:'Locatie kon niet worden bepaald.'};
const geoStatusOf=e=>({1:'denied',2:'unavailable',3:'timeout'})[Number(e?.code||0)]||'error';
const GEO_LABEL={unknown:'Locatie nog niet gedeeld',prompting:'Locatie bepalen…',granted:'Locatie actief',denied:'Locatie geweigerd',unavailable:'Locatie niet beschikbaar',timeout:'Locatie duurde te lang',error:'Locatie mislukt'};
function setGeo(status,message=''){s.geo={status,message,at:Date.now()};return s.geo}
// Eén gedeelde ingang voor locatie. Vraagt hooguit een verse fix aan wanneer de
// vorige ouder is dan twee minuten, zodat Car Mode niet bij elke render prompt.
async function ensureLocation({force=false}={}){
  if(!navigator.geolocation){setGeo('unavailable',GEO_TEXT.unavailable);render();return null}
  if(!force&&s.pos&&s.geo.status==='granted'&&Date.now()-s.geo.at<120000)return s.pos;
  if(s.geo.status==='prompting')return null;
  setGeo('prompting');render();
  try{
    const p=await geo();
    s.pos={latitude:p.coords.latitude,longitude:p.coords.longitude,speed:Number(p.coords.speed||0),accuracy:p.coords.accuracy};
    setGeo('granted');render();return s.pos;
  }catch(e){const status=geoStatusOf(e);setGeo(status,GEO_TEXT[status]||GEO_TEXT.error);render();return null}
}
async function search(q){q=String(q||'').trim();if(q.length<2)return[];if(!token)throw Error('Mapbox-token ontbreekt.');searchAbort?.abort();searchAbort=new AbortController();const prox=s.pos?`&proximity=${s.pos.longitude},${s.pos.latitude}`:'';const r=await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=nl&language=nl&limit=6${prox}&access_token=${encodeURIComponent(token)}`,{signal:searchAbort.signal});if(!r.ok)throw Error(`Adres zoeken mislukt (${r.status}).`);const d=await r.json();return(d.features||[]).map(f=>{const c=f.geometry?.coordinates||[],p=f.properties||{};return{name:p.name||p.full_address||f.place_name||q,address:p.full_address||p.place_formatted||f.place_name||'',longitude:Number(c[0]),latitude:Number(c[1])}}).filter(x=>Number.isFinite(x.longitude)&&Number.isFinite(x.latitude))}
const routePoints=()=>[s.origin,...s.stops,s.destination].filter(Boolean);
async function route(force=false){if(!s.origin||!s.destination)throw Error('Kies eerst een bestemming.');if(!token)throw Error('Mapbox-token ontbreekt.');if(!force&&Date.now()-s.lastRoute<15000&&s.route)return s.route;routeAbort?.abort();routeAbort=new AbortController();s.loading=true;render();const pts=routePoints().map(p=>`${p.longitude},${p.latitude}`).join(';'),qs=new URLSearchParams({access_token:token,alternatives:'false',steps:'true',banner_instructions:'true',geometries:'geojson',overview:'full',language:'nl',voice_units:'metric',roundabout_exits:'true'});try{const r=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${pts}?${qs}`,{signal:routeAbort.signal});if(!r.ok)throw Error(`Route berekenen mislukt (${r.status}).`);const d=await r.json(),rt=d.routes?.[0];if(!rt)throw Error('Geen autoroute gevonden.');s.route=rt;s.steps=(rt.legs||[]).flatMap(l=>l.steps||[]);s.step=0;indexRoute(rt);s.proj=s.pos?projectOnRoute(s.pos):null;arriveHits=0;arrivedLegs=new Set();routeDone=false;s.off=0;s.lastRoute=Date.now();s.loading=false;publish();render();return rt}catch(e){s.loading=false;if(e?.name==='AbortError')return null;s.error=e?.message||'Route kon niet worden berekend.';render();throw e}}
const mpoint=st=>Array.isArray(st?.maneuver?.location)?{longitude:Number(st.maneuver.location[0]),latitude:Number(st.maneuver.location[1])}:null;
const currentStep=()=>s.steps[Math.min(s.step,Math.max(0,s.steps.length-1))]||null,nextStep=()=>s.steps[Math.min(s.step+1,Math.max(0,s.steps.length-1))]||currentStep();
// --- Route-geometrie en projectie -------------------------------------------
// Alle afstanden liepen via hav(): hemelsbrede afstand tot het manoeuvrepunt. In een
// bocht is die rechte lijn veel korter dan de weg erheen, dus kwam de aanwijzing te
// vroeg - precies het gemelde symptoom. Mapbox levert al overview=full met
// geometries=geojson, dus de volledige lijn is beschikbaar. Daarop projecteren geeft
// twee dingen die hav() niet kan: afstand LANGS de route, en de dwarsafstand tot de
// route (nodig om te weten of je er echt af bent).
let geom=[],geomCum=[],stepAlong=[],legAlong=[];
function indexRoute(rt){
  const c=rt?.geometry?.coordinates;
  geom=Array.isArray(c)?c.map(p=>({longitude:Number(p[0]),latitude:Number(p[1])})).filter(p=>Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)):[];
  geomCum=[];let acc=0;
  for(let i=0;i<geom.length;i++){if(i)acc+=hav(geom[i-1],geom[i]);geomCum.push(acc)}
  let hint=0;stepAlong=(s.steps||[]).map(st=>{const p=mpoint(st),pr=p?projectOnRoute(p,hint):null;if(pr)hint=pr.along;return pr?pr.along:null});
  let legAcc=0;legAlong=(rt?.legs||[]).map(l=>{legAcc+=Number(l.distance||0);return legAcc});
}
const routeLength=()=>geomCum.length?geomCum[geomCum.length-1]:Number(s.route?.distance||0);
// Projectie op het dichtstbijzijnde segment. Lokaal vlak benaderd: op deze schaal
// (segmenten van tientallen meters) is dat nauwkeurig genoeg en veel goedkoper dan
// haversine per segment.
// Het zoekbereik is bewust begrensd rond de laatst bekende positie langs de route.
// Een route die zichzelf nadert - een haarspeld, een rondje, een parallelweg - heeft
// twee stukken lijn op enkele tientallen meters van elkaar. Een projectie over de hele
// lijn zou dan naar het verkeerde stuk kunnen springen en de afgelegde afstand laten
// verspringen. Met een venster van 150 m terug en 400 m vooruit kan de positie alleen
// vooruit kruipen langs de route waar hij al was.
const PROJ_BACK_M=150,PROJ_AHEAD_M=400;
function projectOnRoute(pos,hint){
  if(!pos||geom.length<2)return null;
  const from=Number.isFinite(hint)?hint-PROJ_BACK_M:null,to=Number.isFinite(hint)?hint+PROJ_AHEAD_M:null;
  let best=windowed(pos,from,to);
  if(!best)best=windowed(pos,null,null);
  return best
}
function windowed(pos,from,to){
  let best=null;
  for(let i=1;i<geom.length;i++){
    if(from!==null&&((geomCum[i]||0)<from||(geomCum[i-1]||0)>to))continue;
    const a=geom[i-1],b=geom[i];
    const mx=111320*Math.cos((a.latitude+b.latitude)/2*Math.PI/180),my=110540;
    const bx=(b.longitude-a.longitude)*mx,by=(b.latitude-a.latitude)*my;
    const px=(pos.longitude-a.longitude)*mx,py=(pos.latitude-a.latitude)*my;
    const len2=bx*bx+by*by;
    let u=len2?(px*bx+py*by)/len2:0;if(u<0)u=0;else if(u>1)u=1;
    const dx=px-bx*u,dy=py-by*u,d=Math.sqrt(dx*dx+dy*dy);
    if(!best||d<best.distance)best={distance:d,index:i,along:(geomCum[i-1]||0)+Math.sqrt(len2)*u};
  }
  return best;
}
// Afstand langs de route tot stap i. Zonder projectie of index valt dit terug op de
// oude hemelsbrede meting, zodat navigatie nooit stilvalt door een ontbrekende index.
function alongToStep(i){
  const target=stepAlong[i];
  if(!s.proj||!Number.isFinite(target))return null;
  return Math.max(0,target-s.proj.along);
}
// --- GPS-filter -------------------------------------------------------------
// accuracy werd wel opgeslagen en nooit gebruikt. Een meting van 150 meter
// onnauwkeurig hoort geen manoeuvre te triggeren. Ook een enkele sprong wordt
// geweigerd: sneller dan 400 km/u is geen auto maar een GPS-uitschieter. Bewust geen
// positie-smoothing: dat introduceert vertraging tijdens het rijden, en de oorzaak
// van het gemelde probleem was de afstandsmaat, niet de ruis.
const GPS_MAX_ACCURACY=60,GPS_MAX_JUMP_MPS=110;
let lastFixAt=0,rejectedFixes=0;
function acceptFix(p){
  const acc=Number(p?.accuracy||0),at=Date.now();
  if(acc>GPS_MAX_ACCURACY){rejectedFixes++;return false}
  if(s.pos&&lastFixAt){const dt=Math.max(0.5,(at-lastFixAt)/1000);if(hav(s.pos,p)/dt>GPS_MAX_JUMP_MPS){rejectedFixes++;return false}}
  lastFixAt=at;return true
}
// --- Rotondes ---------------------------------------------------------------
// Mapbox gebruikt spaties in de types: roundabout, rotary, roundabout turn,
// exit roundabout, exit rotary. roundabout_exits=true staat al in de aanvraag, dus
// maneuver.exit bevat het afslagnummer.
const isRoundabout=st=>/^(roundabout|rotary|roundabout turn)$/.test(String(st?.maneuver?.type||''));
// Zolang je op de rotonde zit hoort de rotonde-aanwijzing te blijven staan. Zonder dit
// schoof de weergave door naar de manoeuvre NA de rotonde zodra je de rotonde opreed.
function roundaboutCleared(){
  const i=Math.min(s.step,Math.max(0,s.steps.length-1)),st=s.steps[i];
  if(!st||!isRoundabout(st))return true;
  const start=stepAlong[i];
  if(!s.proj||!Number.isFinite(start))return true;
  return s.proj.along>=start+Math.max(10,Number(st.distance||0))-5
}
const displayStep=()=>{const cur=currentStep();return cur&&isRoundabout(cur)&&!roundaboutCleared()?cur:nextStep()};
// --- Meldingen --------------------------------------------------------------
// .car-toast stond al in de stylesheet maar werd door niets gebruikt.
let toastTimer=null;
function toast(text,ms=6000){
  if(!overlay)return;
  let el=overlay.querySelector('.car-toast');
  if(!el){el=document.createElement('div');el.className='car-toast';overlay.appendChild(el)}
  el.textContent=String(text||'');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{try{el.remove()}catch{}},ms);
}
// --- Aankomst bij een stop --------------------------------------------------
// Elke leg eindigt op een waypoint, dus legAlong geeft de afstand tot elke stop en
// tot de eindbestemming. 50 meter, bevestigd over drie geaccepteerde metingen, zodat
// een uitschieter geen aankomst meldt.
const ARRIVE_M=50,ARRIVE_CONFIRM=3;
let arriveHits=0,arrivedLegs=new Set(),routeDone=false;
function checkArrival(){
  if(!s.proj||!legAlong.length)return;
  const k=legAlong.findIndex((end,i)=>!arrivedLegs.has(i)&&s.proj.along<end+ARRIVE_M);
  const index=k<0?legAlong.length-1:k;
  if(arrivedLegs.has(index))return;
  const remaining=legAlong[index]-s.proj.along;
  if(!Number.isFinite(remaining)||remaining>ARRIVE_M){arriveHits=0;return}
  if(++arriveHits<ARRIVE_CONFIRM)return;
  arriveHits=0;arrivedLegs.add(index);
  const last=index>=legAlong.length-1;
  const name=last?(s.destination?.name||'je bestemming'):(s.stops[index]?.name||('stop '+(index+1)));
  if(last){routeDone=true;s.routeActive=false;s.near=false;toast(`Je bent bij ${name}. Route klaar.`,9000);unwatch();stopRefresh()}
  else toast(`Je bent bij ${name}. Volgende stop wordt gevolgd.`,7000);
  publish();render();
}
// --- Afwijken van de route --------------------------------------------------
// Oud: de dichtstbijzijnde van vier manoeuvrepunten verder dan 350 meter, drie keer.
// Dat meet afstand tot een punt, niet tot de weg, dus een lange rechte stretch tussen
// twee manoeuvres kon dat drempelgetal halen zonder dat je verkeerd reed. Nu de echte
// dwarsafstand tot de route, met een begrenzing tegen herberekeningslussen.
const OFFROUTE_M=40,OFFROUTE_CONFIRM=3,REROUTE_MIN_GAP_MS=20000,REROUTE_MAX=3,REROUTE_WINDOW_MS=300000;
let rerouteTimes=[];
function checkOffRoute(){
  if(!s.proj||!s.routeActive){s.off=0;return}
  s.off=s.proj.distance>OFFROUTE_M?s.off+1:0;
  if(s.off<OFFROUTE_CONFIRM)return;
  const now=Date.now();
  rerouteTimes=rerouteTimes.filter(x=>now-x<REROUTE_WINDOW_MS);
  if(now-s.lastRoute<REROUTE_MIN_GAP_MS)return;
  if(rerouteTimes.length>=REROUTE_MAX){toast('Je wijkt af van de route. MAIRFM wacht even met herberekenen.',7000);s.off=0;return}
  s.off=0;rerouteTimes.push(now);
  s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};
  toast('Nieuwe route wordt berekend…',5000);
  route(true).then(()=>toast('Nieuwe route berekend.',5000)).catch(()=>toast('Nieuwe route berekenen lukte niet.',6000));
}
function metrics(){if(!s.route)return{distance:null,duration:null};let distance=0,duration=0;for(let i=s.step;i<s.steps.length;i++){distance+=Number(s.steps[i]?.distance||0);duration+=Number(s.steps[i]?.duration||0)}return{distance:distance||Number(s.route.distance||0),duration:duration||Number(s.route.duration||0)}}
function progress(){const total=Number(s.route?.distance||0),rem=metrics().distance;return total&&Number.isFinite(rem)?Math.max(0,Math.min(1,1-rem/total)):0}
function nearDistance(){
  const i=s.steps.indexOf(displayStep());
  const along=i>=0?alongToStep(i):null;
  if(Number.isFinite(along))return along;
  const p=mpoint(displayStep());return s.pos&&p?hav(s.pos,p):Number(displayStep()?.distance||Infinity)
}
function updateNav(){
  if(!s.pos||!s.steps.length)return;
  s.proj=projectOnRoute(s.pos,s.proj?.along);
  // Stap vooruit als het manoeuvrepunt langs de route gepasseerd is. Op de oude
  // hemelsbrede meting van 45 meter sprong dit in bochten te vroeg door.
  const ni=Math.min(s.step+1,s.steps.length-1),along=alongToStep(ni);
  if(Number.isFinite(along)){if(along<=20)s.step=ni}
  else{const np=mpoint(s.steps[ni]);if(np&&hav(s.pos,np)<45)s.step=ni}
  const d=nearDistance(),v=Math.max(0,Number(s.pos.speed||0));
  s.near=Number.isFinite(d)&&d<=(v>22?900:v>12?650:450);
  checkArrival();
  if(!routeDone)checkOffRoute();
  publish();render()
}
function watch(){unwatch();if(!navigator.geolocation)return;s.watch=navigator.geolocation.watchPosition(p=>{const fix={latitude:p.coords.latitude,longitude:p.coords.longitude,speed:Number(p.coords.speed||0),accuracy:Number(p.coords.accuracy||0)};if(s.geo.status!=='granted')setGeo('granted');if(!acceptFix(fix))return;s.pos=fix;updateNav()},e=>{const status=geoStatusOf(e);setGeo(status,GEO_TEXT[status]||GEO_TEXT.error);s.error=status==='denied'?GEO_TEXT.denied:'Live locatie tijdelijk niet beschikbaar.';render()},{enableHighAccuracy:true,maximumAge:3000,timeout:15000})}
function unwatch(){if(s.watch!=null&&navigator.geolocation)navigator.geolocation.clearWatch(s.watch);s.watch=null}
function startRefresh(){stopRefresh();if(!s.routeActive)return;refreshTimer=setInterval(()=>{if(!open||!s.routeActive||document.visibilityState!=='visible'||!s.pos)return;s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};route(true).catch(()=>{})},120000)}
function stopRefresh(){if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}}
function publish(){const m=metrics(),detail={active:!!s.routeActive,destination:s.destination?.name||'',stops:s.stops.map(x=>x.name),remainingTravelTime:m.duration,arrivalTime:Number.isFinite(m.duration)?Date.now()+m.duration*1000:null,remainingDistance:m.distance,routeProgress:progress(),stopsRemaining:s.stops.length,nextManeuver:nextStep()?.maneuver?.instruction||''};window.MAIRJourneyContext=detail;try{window.dispatchEvent(new CustomEvent('mair:journey-context',{detail}))}catch{}}
function transport(a){const id=a==='play'?'play':a==='prev'?'prev':a==='next'?'next':'',el=id?$(id):null;if(el){el.click();setTimeout(render,100);return}if(a==='play')window.JFMPlayback?.playPause?.()}
function like(){$('loveTrack')?.click()}
// Rotondes draaien in Nederland en de rest van rechts-rijdend Europa tegen de klok
// in. Hier stond U+21BB (met de klok mee), spiegelbeeldig verkeerd; het is nu U+21BA.
// Verder waren alleen roundabout/rotary, left, right en uturn afgedekt: merge, op- en
// afritten, splitsingen, aankomst en 'exit roundabout' vielen allemaal terug op een
// gewone bochtpijl of een pijl rechtdoor, dus visueel niet te onderscheiden van een
// normale afslag. Mapbox gebruikt spaties in de types, geen underscores.
function icon(st){
  const m=String(st?.maneuver?.modifier||''),t=String(st?.maneuver?.type||'');
  if(/^(roundabout|rotary|roundabout turn)$/.test(t))return'↺';
  if(/^(exit roundabout|exit rotary)$/.test(t))return m.includes('left')?'↰':'↱';
  if(t==='arrive')return'◉';
  if(t==='depart')return'↑';
  if(t==='merge')return m.includes('left')?'⤳':'⤳';
  if(t==='on ramp')return m.includes('left')?'⤴':'⤴';
  if(t==='off ramp')return m.includes('left')?'⤶':'⤷';
  if(t==='fork')return m.includes('left')?'⑃':'⑂';
  if(m==='uturn')return'↶';
  if(m==='sharp left')return'⬉';
  if(m==='sharp right')return'⬈';
  if(m.includes('left'))return'↰';
  if(m.includes('right'))return'↱';
  return'↑'
}
// Bij een rotonde levert Mapbox het afslagnummer in maneuver.exit (omdat
// roundabout_exits=true wordt meegestuurd). De Nederlandse instructietekst noemt dat
// nummer meestal al, dus het staat hier als losse badge bij de pijl in plaats van in
// de tekst - anders zou het dubbel op het scherm staan.
const exitBadge=st=>{const n=Number(st?.maneuver?.exit||0);return isRoundabout(st)&&n>0?`<span class="car-nav-exit">${n}e</span>`:''};
const instr=st=>String(st?.maneuver?.instruction||st?.name||'Route volgen').trim();
function startMarkup(){const rs=recents.slice(0,5).map((r,i)=>`<button data-recent="${i}"><b>${esc(r.name)}</b><small>${esc(r.address||'')}</small></button>`).join('');return`<section class="car-start"><div class="car-brand"><span>MAIRFM</span><strong>CAR MODE</strong></div><div class="car-start-main"><p>MUZIEK EERST. ROUTE WANNEER JE HEM NODIG HEBT.</p><button class="car-choice primary" data-act="search"><b>⌖ KIES BESTEMMING</b><span>Route, ETA en afslaginfo</span></button><button class="car-choice" data-act="music"><b>▶ START ZONDER ROUTE</b><span>Volledig muziekgericht</span></button></div>${geoMarkup()}<div class="car-recents"><span>RECENT</span>${rs||'<small>Nog geen bestemmingen in deze sessie</small>'}</div></section>`}
// Locatie krijgt een eigen, zichtbare regel op het startscherm. De gebruiker ziet
// daardoor voor het kiezen van een bestemming al of MAIRFM locatie heeft, en kan
// een geweigerde of mislukte poging hier direct opnieuw proberen.
function geoMarkup(){
  const st=s.geo.status,label=GEO_LABEL[st]||GEO_LABEL.error,busy=st==='prompting',ok=st==='granted';
  const action=ok?'':`<button class="car-geo-action" data-act="locate"${busy?' disabled':''}>${busy?'Bezig…':st==='unknown'?'Locatie delen':'Opnieuw proberen'}</button>`;
  const note=!ok&&s.geo.message?`<small>${esc(s.geo.message)}</small>`:'';
  return`<div class="car-geo" data-geo="${esc(st)}"><span>⌖ ${esc(label)}</span>${note}${action}</div>`;
}
function searchMarkup(){const rs=s.searchResults.map((x,i)=>`<button data-result-index="${i}"><b>${esc(x.name)}</b><small>${esc(x.address)}</small></button>`).join('');const title=s.searchPurpose==='stop'?'Tussenstop toevoegen':'Waar wil je heen?';return`<section class="car-search"><header><button class="car-back" data-act="searchback">‹</button><div><small>CAR MODE</small><strong>${title}</strong></div></header><label class="car-searchbox"><span>⌕</span><input id="carSearchInput" autocomplete="off" placeholder="Adres of plaats" value="${esc(s.searchQuery)}"></label>${s.error?`<div class="car-search-error">${esc(s.error)}</div>`:''}<div id="carSearchStatus" class="car-search-status"></div><div id="carSearchResults" class="car-search-results">${rs}</div><button class="car-text-action" data-act="music">Verder zonder route</button></section>`}
function stopRows(){return s.stops.map((x,i)=>`<div class="car-stop-row"><div><small>TUSSENSTOP ${i+1}</small><b>${esc(x.name)}</b></div><div class="car-stop-actions"><button data-stop-up="${i}" ${i===0?'disabled':''}>↑</button><button data-stop-down="${i}" ${i===s.stops.length-1?'disabled':''}>↓</button><button data-stop-remove="${i}">×</button></div></div>`).join('')}
function previewMarkup(){const m=metrics();return`<section class="car-preview"><header><button class="car-back" data-act="search">‹</button><div><small>ROUTE</small><strong>${esc(s.destination?.name||'Bestemming')}</strong></div></header><div class="car-preview-card"><div><small>VAN</small><b>Huidige locatie</b></div><div><small>NAAR</small><b>${esc(s.destination?.name||'')}</b></div><div><small>AANKOMST</small><b>${eta(m.duration)}</b></div></div><div class="car-stops-list">${stopRows()}<button class="car-add-stop" data-act="addstop">＋ Tussenstop toevoegen</button></div><div class="car-preview-metrics"><div><small>TIJD</small><b>${dur(m.duration)}</b></div><div><small>AFSTAND</small><b>${dist(m.distance)}</b></div><div><small>VERKEER</small><b>LIVE</b></div></div><button class="car-route-start" data-act="start">ROUTE STARTEN</button></section>`}
// B2: voortgangslijn met bolletjes. De positie komt van afgelegde afstand gedeeld
// door totale routeafstand - niet van tijd, want tijd loopt door als je stilstaat.
// progress() bestond al en rekende al op afstand; de stops komen uit legAlong.
function progressMarkup(){
  const pct=Math.round(Math.max(0,Math.min(1,progress()))*100);
  const total=routeLength();
  const dots=(legAlong||[]).slice(0,-1).map((end,i)=>{
    const at=total?Math.max(0,Math.min(100,end/total*100)):0;
    return `<i class="car-progress-stop${arrivedLegs.has(i)?' done':''}" style="left:${at}%"></i>`
  }).join('');
  return `<div class="car-route-progress" role="img" aria-label="Routevoortgang ${pct} procent">
    <i class="car-progress-track"></i>
    <i class="car-progress-done" style="width:${pct}%"></i>
    <i class="car-progress-start"></i>
    ${dots}
    <i class="car-progress-end"></i>
    <i class="car-progress-me" style="left:${pct}%"></i>
  </div>`
}
function navMarkup(){const st=displayStep(),m=metrics(),d=nearDistance();return`<aside class="car-nav-card"><div class="car-nav-top"><span>VOLGENDE</span><span>${eta(m.duration)}</span></div><div class="car-nav-maneuver"><div class="car-nav-arrow">${icon(st)}${exitBadge(st)}</div><div><b>${dist(d)}</b><strong>${esc(instr(st))}</strong></div></div>${s.stops.length?`<div class="car-stop-chip">${s.stops.length} tussenstop${s.stops.length===1?'':'s'}</div>`:''}<div class="car-nav-bottom"><span>${dur(m.duration)}</span><span>${dist(m.distance)}</span></div>${progressMarkup()}</aside>`}
function player(withNav){const p=play(),n=next(),pct=p.duration>0?Math.max(0,Math.min(100,p.progress/p.duration*100)):0,nm=n?.name||n?.title||'Wordt bepaald',na=Array.isArray(n?.artists)?n.artists.join(', '):n?.artist||'';return`<section class="car-drive ${withNav?'':'music-only'}"><header class="car-drive-head"><strong>MAIRFM <span>${withNav?'· JOURNEY':'· MUSIC'}</span></strong><button class="car-more" data-act="menu">•••</button></header><div class="car-drive-grid"><div class="car-music"><img class="car-artwork" src="${esc(p.image||'mair-icon-512.png')}" alt=""><div class="car-track-copy"><small>NU SPEELT</small><h1>${esc(p.title)}</h1><p>${esc(p.artist)}</p><div class="car-track-progress"><i style="width:${pct}%"></i></div><div class="car-controls"><button data-like>♡</button><button data-tr="prev">‹</button><button class="car-play" data-tr="play">${p.isPlaying?'Ⅱ':'▶'}</button><button data-tr="next">›</button></div></div><div class="car-next"><small>VOLGENDE</small><b>${esc(nm)}</b><span>${esc(na)}</span></div></div>${withNav?navMarkup():''}</div>${s.error?`<div class="car-toast">${esc(s.error)} <button data-act="dismiss">×</button></div>`:''}</section>`}
function focusMarkup(){const p=play(),st=displayStep(),m=metrics();return`<section class="car-turn-focus"><header><div><small>${esc(p.title)}</small><span>${esc(p.artist)}</span></div><button class="car-more" data-act="menu">•••</button></header><div class="car-turn-hero"><div class="car-turn-arrow">${icon(st)}${exitBadge(st)}</div><div><b>${dist(nearDistance())}</b><h1>${esc(instr(st))}</h1><span>${eta(m.duration)} · ${dur(m.duration)}</span></div></div><div class="car-turn-controls"><button data-tr="play">${p.isPlaying?'Ⅱ':'▶'}</button><button data-tr="next">›</button></div></section>`}
function menu(){return`<div class="car-menu-backdrop"><section class="car-menu">${s.routeActive?'<button data-act="addstop">Tussenstop toevoegen</button><button data-act="search">Bestemming wijzigen</button><button data-act="waze">Open in Waze</button><button data-act="music">Verder zonder route</button>':'<button data-act="search">Bestemming toevoegen</button>'}<button class="danger" data-act="close">Car Mode sluiten</button><button class="muted" data-act="menuclose">Annuleren</button></section></div>`}
function openSearch(purpose='destination'){closeMenu();s.searchPurpose=purpose;s.searchQuery='';s.searchResults=[];s.error='';s.screen='search';render();queueMicrotask(bindSearch);
  // Hier is locatie voor het eerst echt nodig (proximity bij zoeken en straks als
  // vertrekpunt), dus hier hoort de iOS-prompt. Niet blokkerend: zoeken werkt ook
  // zonder fix, alleen zonder nabijheidsvoorkeur.
  ensureLocation().catch(()=>{})}
async function recalcAfterStops(){if(!s.origin||!s.destination)return;try{await route(true)}catch{}}
function ensure(){if(overlay)return overlay;overlay=document.createElement('div');overlay.id='mairCarWaveOverlay';overlay.className='mair-car-wave-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');document.body.appendChild(overlay);overlay.addEventListener('click',async e=>{const tr=e.target.closest('[data-tr]');if(tr){transport(tr.dataset.tr);return}if(e.target.closest('[data-like]')){like();return}const rr=e.target.closest('[data-recent]');if(rr){const d=recents[Number(rr.dataset.recent)];if(d){s.destination=d;s.error='';await prepare()}return}const up=e.target.closest('[data-stop-up]');if(up){const i=Number(up.dataset.stopUp);if(i>0){[s.stops[i-1],s.stops[i]]=[s.stops[i],s.stops[i-1]];await recalcAfterStops();render()}return}const down=e.target.closest('[data-stop-down]');if(down){const i=Number(down.dataset.stopDown);if(i>=0&&i<s.stops.length-1){[s.stops[i],s.stops[i+1]]=[s.stops[i+1],s.stops[i]];await recalcAfterStops();render()}return}const rem=e.target.closest('[data-stop-remove]');if(rem){s.stops.splice(Number(rem.dataset.stopRemove),1);await recalcAfterStops();render();return}const res=e.target.closest('[data-result-index]');if(res){const d=s.searchResults[Number(res.dataset.resultIndex)];if(d){if(s.searchPurpose==='stop'){s.stops.push({...d});s.error='';if(s.routeActive){s.screen='drive';if(s.pos)s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};await recalcAfterStops()}else{s.screen='preview';await recalcAfterStops()}render()}else{s.destination={...d};s.error='';await prepare()}}return}const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;if(a==='home'){s.routeActive=false;s.screen='home';unwatch();stopRefresh();publish();render()}else if(a==='search'){openSearch('destination')}else if(a==='searchback'){s.screen=s.destination?'preview':'home';render()}else if(a==='addstop'){openSearch('stop')}else if(a==='music'){s.routeActive=false;s.screen='music';unwatch();stopRefresh();publish();render()}else if(a==='start'){s.routeActive=true;s.screen='drive';if(s.destination)recents=[s.destination,...recents.filter(x=>x.longitude!==s.destination.longitude||x.latitude!==s.destination.latitude)].slice(0,5);watch();startRefresh();publish();render()}else if(a==='menu'){if(!overlay.querySelector('.car-menu-backdrop'))overlay.insertAdjacentHTML('beforeend',menu())}else if(a==='menuclose')closeMenu();else if(a==='dismiss'){s.error='';render()}else if(a==='locate'){ensureLocation({force:true}).catch(()=>{})}else if(a==='waze'){if(s.destination)location.href=`https://waze.com/ul?ll=${encodeURIComponent(`${s.destination.latitude},${s.destination.longitude}`)}&navigate=yes`}else if(a==='close'){closeMenu();setOpen(false)}});return overlay}
function closeMenu(){overlay?.querySelector('.car-menu-backdrop')?.remove()}
function bindSearch(){const input=$('carSearchInput'),out=$('carSearchResults'),status=$('carSearchStatus');if(!input||input.dataset.bound)return;input.dataset.bound='1';input.focus();input.addEventListener('input',()=>{clearTimeout(searchTimer);const q=input.value.trim();s.searchQuery=q;s.error='';if(q.length<2){s.searchResults=[];out.innerHTML='';status.textContent='';return}searchTimer=setTimeout(async()=>{status.textContent='Zoeken…';try{const items=await search(q);if(q!==s.searchQuery)return;s.searchResults=items;status.textContent=items.length?'':'Geen bestemmingen gevonden.';out.innerHTML=items.map((x,i)=>`<button data-result-index="${i}"><b>${esc(x.name)}</b><small>${esc(x.address)}</small></button>`).join('')}catch(e){if(e?.name!=='AbortError')status.textContent=e?.message||'Zoeken mislukt.'}},350)})}
async function prepare(){
  // Locatie eerst, en als aparte stap: een geweigerde of trage fix moet een eigen
  // uitleg geven in plaats van te verdwijnen achter "Route voorbereiden mislukt".
  const pos=await ensureLocation();
  if(!pos){s.loading=false;s.error=s.geo.message||GEO_TEXT.error;s.screen='search';render();queueMicrotask(bindSearch);return}
  try{s.loading=true;s.error='';s.screen='preview';render();s.origin={name:'Huidige locatie',latitude:pos.latitude,longitude:pos.longitude};await route(true);s.screen='preview';render()}
  catch(e){s.loading=false;s.error=e?.message||'Route voorbereiden mislukt.';s.screen='search';render();queueMicrotask(bindSearch)}
}
// Het zoekscherm mag nooit opnieuw worden opgebouwd terwijl de gebruiker typt:
// playback-events komen tijdens het typen binnen en een innerHTML-rebuild
// vernietigt het invoerveld, het toetsenbord en de cursorpositie. Alleen de
// resultaten en de statusregel worden dan ververst.
function patchSearch(){
  const out=$('carSearchResults');
  if(out)out.innerHTML=s.searchResults.map((x,i)=>`<button data-result-index="${i}"><b>${esc(x.name)}</b><small>${esc(x.address)}</small></button>`).join('');
  const err=overlay?.querySelector('.car-search-error');
  if(err){err.textContent=s.error||'';err.hidden=!s.error}
  return true;
}
function render(){ensure();if(!open)return;if(s.screen==='search'&&$('carSearchInput'))return void patchSearch();if(s.screen==='home')overlay.innerHTML=startMarkup();else if(s.screen==='search'){overlay.innerHTML=searchMarkup();queueMicrotask(bindSearch)}else if(s.screen==='preview')overlay.innerHTML=s.loading?`<section class="car-loading"><b>${esc(s.destination?.name||'Bestemming geselecteerd')}</b><span>GPS en verkeer ophalen…</span></section>`:previewMarkup();else if(s.screen==='drive')overlay.innerHTML=s.near?focusMarkup():player(true);else overlay.innerHTML=player(false)}
const wakeSupported=()=>!!navigator.wakeLock?.request;function wakeRetryStart(){if(wakeRetry)clearTimeout(wakeRetry);if(open&&document.visibilityState==='visible'&&wakeSupported())wakeRetry=setTimeout(()=>requestWake(),1500)}async function requestWake(){if(!open||document.visibilityState!=='visible'||!wakeSupported())return false;if(wake&&!wake.released)return true;try{const l=await navigator.wakeLock.request('screen');wake=l;l.addEventListener('release',()=>{if(wake===l)wake=null;wakeRetryStart()},{once:true});return true}catch{wake=null;return false}}async function releaseWake(){if(wakeRetry){clearTimeout(wakeRetry);wakeRetry=null}const l=wake;wake=null;if(l&&!l.released)try{await l.release()}catch{}}
function setOpen(v){ensure();open=!!v;overlay.classList.toggle('is-open',open);document.body.classList.toggle('mair-car-mode-open',open);if(open){document.body.dataset.mairCarMode='1';s.screen=s.routeActive?'drive':'home';if(s.routeActive){watch();startRefresh()}config().then(render);requestWake();render()}else{delete document.body.dataset.mairCarMode;unwatch();stopRefresh();closeMenu();releaseWake()}try{window.dispatchEvent(new CustomEvent('mair:car-mode',{detail:{open}}))}catch{}}
document.addEventListener('keydown',e=>{if(open&&e.key==='Escape')setOpen(false)});document.addEventListener('visibilitychange',()=>{if(!open)return;document.visibilityState==='visible'?requestWake():releaseWake()});window.addEventListener('pageshow',()=>{if(open)requestWake()});window.addEventListener('pagehide',()=>releaseWake());['jfm:trackchange','jfm:playback-state','jfm:upcoming-invalidated','mair:director-replanned','mair:channelchange'].forEach(n=>window.addEventListener(n,()=>{if(open)render()}));
window.MAIRCarModePrototype={version:'journey-nav-v5-explicit-geo-2026-09-01',open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!open),render,chooseDestination:()=>openSearch('destination'),addStop:()=>openSearch('stop'),status:()=>({open,screen:s.screen,routeActive:s.routeActive,destination:s.destination,stops:s.stops.slice(),wakeLockSupported:wakeSupported(),wakeLockActive:!!(wake&&!wake.released),geo:{...s.geo},hasPosition:!!s.pos,journey:window.MAIRJourneyContext||null}),requestLocation:()=>ensureLocation({force:true})};
})();