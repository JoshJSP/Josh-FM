// MAIRFM Car Mode — music-first navigation + Journey context
(()=>{
'use strict';
if(window.MAIRCarModePrototype?.version?.includes?.('journey-nav'))return;
const $=id=>document.getElementById(id),CFG='/api/config';
let overlay=null,open=false,wake=null,wakeRetry=null,searchTimer=null,searchAbort=null,routeAbort=null,refreshTimer=null,token='',recents=[];
const s={screen:'home',routeActive:false,origin:null,destination:null,stops:[],route:null,steps:[],step:0,pos:null,watch:null,near:false,error:'',loading:false,lastRoute:0,off:0,posAt:0,weak:false,heading:null,searchQuery:'',searchResults:[],searchPurpose:'destination',geo:{status:'unknown',message:'',at:0}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Eén afstandsnotatie voor heel Car Mode. Afronden eerst, dan pas kiezen tussen M en KM:
// 995 m is 1.0 KM (niet 1000 M) en 9.95 km wordt 10 KM (niet 10.0).
const dist=m=>{if(!Number.isFinite(m))return'—';m=Math.max(0,m);const r=Math.round(m/10)*10;if(r<1000)return`${r} M`;const k=Math.round(m/100)/10;return k<10?`${k.toFixed(1)} KM`:`${Math.round(m/1000)} KM`};
const dur=x=>{if(!Number.isFinite(x))return'—';const m=Math.max(0,Math.round(x/60));return m<60?`${m} MIN`:`${Math.floor(m/60)}U ${String(m%60).padStart(2,'0')}M`};
const eta=x=>Number.isFinite(x)?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'}).format(new Date(Date.now()+x*1000)):'--:--';
function play(){try{const p=window.JFMPlaybackState?.get?.()||{},img=$('artImg');return{title:String($('title')?.textContent||p.title||p.name||'MAIRFM').trim(),artist:String($('artist')?.textContent||p.artist||'').trim(),image:String(img?.currentSrc||img?.src||'mair-icon-512.png'),isPlaying:typeof p.isPlaying==='boolean'?p.isPlaying:!!p.expectedLive,progress:Number(p.progressMs||p.progress_ms||0),duration:Number(p.durationMs||p.duration_ms||0)}}catch{return{title:'MAIRFM',artist:'',image:'mair-icon-512.png',isPlaying:false,progress:0,duration:0}}}
async function config(){try{const r=await fetch(CFG,{cache:'no-store'});if(r.ok)token=String((await r.json()).mapboxPublicToken||'').trim()}catch{}return token}
const hav=(a,b)=>{if(!a||!b)return Infinity;const R=6371000,r=x=>x*Math.PI/180,d1=r(b.latitude-a.latitude),d2=r(b.longitude-a.longitude),q=Math.sin(d1/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
const geo=opts=>new Promise((ok,no)=>{if(!navigator.geolocation)return no(Object.assign(Error('Locatie niet beschikbaar.'),{code:2}));navigator.geolocation.getCurrentPosition(ok,no,opts||{enableHighAccuracy:true,timeout:15000,maximumAge:10000})});
// Locatiestatus is expliciet: iOS toont de systeemprompt pas bij de eerste echte
// aanvraag, en weigering/timeout/onbeschikbaar moeten los van elkaar leesbaar zijn.
const GEO_TEXT={denied:'MAIRFM mag je locatie niet gebruiken. Zet dit aan via Instellingen › MAIRFM › Locatie en probeer opnieuw.',unavailable:'Je locatie is nu niet beschikbaar. Controleer of Locatievoorzieningen aanstaan.',timeout:'Het duurde te lang om je locatie te bepalen. Probeer het opnieuw.',error:'Locatie kon niet worden bepaald.'};
const geoStatusOf=e=>({1:'denied',2:'unavailable',3:'timeout'})[Number(e?.code||0)]||'error';
const GEO_LABEL={unknown:'Locatie nog niet gedeeld',prompting:'Locatie bepalen…',granted:'Locatie actief',denied:'Locatie geweigerd',unavailable:'Locatie niet beschikbaar',timeout:'Locatie duurde te lang',error:'Locatie mislukt'};
// Eén vorm voor elke GPS-fix. coords.speed is null zolang iOS geen snelheid kent: dat blijft null
// (kmh=null, op het scherm "--") en wordt dus nooit stilzwijgend 0 km/u.
// Snelheid komt alleen uit coords.speed (Doppler van de telefoon, loopt niet achter zoals afstand/tijd tussen fixes).
// Licht afgevlakt: helft oud, helft nieuw. Na een gat van 5 s of na null begint hij opnieuw, dus geen naijlen.
let spd=null,spdAt=0;
function feedSpeed(c){const v=Number.isFinite(c?.speed)&&c.speed>=0?c.speed:null,now=Date.now();if(v==null){spd=null;spdAt=now;return}spd=spd==null||now-spdAt>5000?v:spd+.5*(v-spd);spdAt=now}
const fixOf=c=>({latitude:c.latitude,longitude:c.longitude,speed:Number(c.speed||0),accuracy:Number(c.accuracy||0),kmh:Number.isFinite(c.speed)&&c.speed>=0?Math.round(c.speed*3.6):null,heading:Number.isFinite(c.heading)?c.heading:null});
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
    s.pos=fixOf(p.coords);s.posAt=Date.now();
    setGeo('granted');render();return s.pos;
  }catch(e){const status=geoStatusOf(e);setGeo(status,GEO_TEXT[status]||GEO_TEXT.error);render();return null}
}
// Zoeken op naam van een plek (winkel, restaurant, school) en op adres. Search Box kent plekken; Geocode v6 alleen adressen
// en blijft de terugval. Een keten (Albert Heijn) geeft met alleen proximity eerst grote steden, dus ook een aanvraag
// binnen ~20 km rond je positie. Samenvoegen, dubbele eruit, dichtbij eerst.
const SEARCH_LAT=.18,SEARCH_LON=.29;
const toItem=(f,q)=>{const c=f.geometry?.coordinates||[],p=f.properties||{};return{id:p.mapbox_id||'',name:p.name||p.full_address||f.place_name||q,address:p.full_address||p.place_formatted||f.place_name||'',longitude:Number(c[0]),latitude:Number(c[1])}};
async function search(q){
  q=String(q||'').trim();if(q.length<2)return[];if(!token)throw Error('Mapbox-token ontbreekt.');
  searchAbort?.abort();searchAbort=new AbortController();const sig=searchAbort.signal,p=s.pos,tk=encodeURIComponent(token),qq=encodeURIComponent(q);
  const box=`https://api.mapbox.com/search/searchbox/v1/forward?q=${qq}&country=nl&language=nl&limit=8&access_token=${tk}`;
  const urls=p?[`${box}&proximity=${p.longitude},${p.latitude}`,`${box}&bbox=${p.longitude-SEARCH_LON},${p.latitude-SEARCH_LAT},${p.longitude+SEARCH_LON},${p.latitude+SEARCH_LAT}`]:[box];
  const got=await Promise.all(urls.map(u=>fetch(u,{signal:sig}).then(r=>r.ok?r.json():null,e=>{if(e?.name==='AbortError')throw e;return null})));
  const seen=new Set();let items=got.flatMap(d=>(d?.features||[]).map(f=>toItem(f,q))).filter(x=>{const k=x.id||`${x.name}|${x.longitude.toFixed(4)},${x.latitude.toFixed(4)}`;if(!Number.isFinite(x.longitude)||!Number.isFinite(x.latitude)||seen.has(k))return false;seen.add(k);return true});
  if(!items.length){
    const prox=p?`&proximity=${p.longitude},${p.latitude}`:'',r=await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${qq}&country=nl&language=nl&limit=6${prox}&access_token=${tk}`,{signal:sig});
    if(!r.ok){if(got.some(Boolean))return[];throw Error(`Zoeken mislukt (${r.status}).`)}
    items=((await r.json()).features||[]).map(f=>toItem(f,q)).filter(x=>Number.isFinite(x.longitude)&&Number.isFinite(x.latitude))
  }
  if(p)for(const x of items)x.km=hav(p,x)/1000;
  return(p?items.sort((a,b)=>a.km-b.km):items).slice(0,8)
}
const resultsHtml=()=>s.searchResults.map((x,i)=>`<button data-result-index="${i}"><b>${esc(x.name)}</b><small>${esc([x.address,Number.isFinite(x.km)?lower(dist(x.km*1000)):''].filter(Boolean).join(' · '))}</small></button>`).join('');
const routePoints=()=>[s.origin,...s.stops,s.destination].filter(Boolean);
// Elke aanvraag krijgt een volgnummer: een afgebroken of ingehaalde aanvraag mag niets meer
// zetten, melden of de laadstatus van een nieuwere aanvraag aanraken. quiet = achtergrond-
// of reroute-aanvraag: mislukt die terwijl er een geldige route is, dan blijft de oude route
// zonder foutbalk staan (tunnel, even geen bereik).
let routeSeq=0;
async function route(force=false,{quiet=false}={}){if(!s.origin||!s.destination)throw Error('Kies eerst een bestemming.');if(!token)throw Error('Mapbox-token ontbreekt.');if(!force&&Date.now()-s.lastRoute<15000&&s.route)return s.route;routeAbort?.abort();routeAbort=new AbortController();const my=++routeSeq;s.loading=true;render();const pts=routePoints().map(p=>`${p.longitude},${p.latitude}`).join(';'),qs=new URLSearchParams({access_token:token,alternatives:'false',steps:'true',banner_instructions:'true',geometries:'geojson',overview:'full',language:'nl',voice_units:'metric',roundabout_exits:'true',annotations:'maxspeed'});try{const r=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${pts}?${qs}`,{signal:routeAbort.signal});if(!r.ok)throw Error(`Route berekenen mislukt (${r.status}).`);const d=await r.json(),rt=d.routes?.[0];if(my!==routeSeq)return null;if(!rt)throw Error('Geen autoroute gevonden.');s.route=rt;s.steps=(rt.legs||[]).flatMap(l=>l.steps||[]);s.step=0;indexRoute(rt);s.proj=s.pos?projectOnRoute(s.pos,0):null;arriveHits=0;routeDone=false;s.off=0;s.lastRoute=Date.now();s.loading=false;publish();render();return rt}catch(e){if(e?.name==='AbortError'||my!==routeSeq)return null;s.loading=false;if(!(quiet&&s.route))s.error=e?.message||'Route kon niet worden berekend.';render();throw e}}
const mpoint=st=>Array.isArray(st?.maneuver?.location)?{longitude:Number(st.maneuver.location[0]),latitude:Number(st.maneuver.location[1])}:null;
const currentStep=()=>s.steps[Math.min(s.step,Math.max(0,s.steps.length-1))]||null,nextStep=()=>s.steps[Math.min(s.step+1,Math.max(0,s.steps.length-1))]||currentStep();
// --- Route-geometrie en projectie -------------------------------------------
// Alle afstanden liepen via hav(): hemelsbrede afstand tot het manoeuvrepunt. In een
// bocht is die rechte lijn veel korter dan de weg erheen, dus kwam de aanwijzing te
// vroeg - precies het gemelde symptoom. Mapbox levert al overview=full met
// geometries=geojson, dus de volledige lijn is beschikbaar. Daarop projecteren geeft
// twee dingen die hav() niet kan: afstand LANGS de route, en de dwarsafstand tot de
// route (nodig om te weten of je er echt af bent).
let geom=[],geomCum=[],stepAlong=[],legAlong=[],limits=[];
// Alles wat "langs de route" heet - positie, stappen, leg-einden, totale lengte - is hier
// gemeten op dezelfde maat: haversine over de geometrie. Eerder kwam legAlong uit
// leg.distance van Mapbox en along uit de geometrie; die twee wijken genoeg af om een
// aankomst te melden terwijl er kilometers over waren.
function indexRoute(rt){
  const c=rt?.geometry?.coordinates;
  geom=Array.isArray(c)?c.map(p=>({longitude:Number(p[0]),latitude:Number(p[1])})).filter(p=>Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)):[];
  geomCum=[];let acc=0;
  for(let i=0;i<geom.length;i++){if(i)acc+=hav(geom[i-1],geom[i]);geomCum.push(acc)}
  // Maneuvres liggen vaak kilometers uit elkaar: het zoekvenster loopt hier onbegrensd naar
  // voren (met het venster van 400 m bleef elke lange stap op de rand van het venster hangen).
  let hint=0;const at=p=>{const pr=p?windowed(p,hint-PROJ_BACK_M,Infinity):null;if(pr)hint=Math.max(hint,pr.along);return pr?pr.along:null};
  stepAlong=(s.steps||[]).map(st=>at(mpoint(st)));
  // Maximumsnelheid per routesegment (Directions annotations=maxspeed), alle legs achter elkaar. Klopt het
  // aantal niet met de geometrie, dan telt het niet: liever geen bordje dan een verkeerd bordje.
  limits=(rt?.legs||[]).flatMap(l=>Array.isArray(l?.annotation?.maxspeed)?l.annotation.maxspeed:[]);
  if(limits.length!==Math.max(0,geom.length-1))limits=[];
  hint=0;const n=(rt?.legs||[]).length;
  legAlong=(rt?.legs||[]).map((l,i)=>{if(i===n-1)return routeLength();const a=at(mpoint((l.steps||[]).at(-1)));return a==null?hint:a});
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
// vooruit kruipen langs de route waar hij al was. Zit de beste plek in het venster er
// duidelijk naast (lang GPS-gat, tunnel), dan telt de beste plek over de hele route.
// Een nieuwe route start met hint 0: het begint waar je nu bent, dus geen sprong.
const PROJ_BACK_M=150,PROJ_AHEAD_M=400;
function projectOnRoute(pos,hint){
  if(!pos||geom.length<2)return null;
  if(!Number.isFinite(hint))return windowed(pos,null,null);
  const w=windowed(pos,hint-PROJ_BACK_M,hint+PROJ_AHEAD_M);
  if(w&&w.distance<=offLimit(pos))return w;
  const all=windowed(pos,null,null);
  return !w||all.distance<w.distance-30?all:w
}
// ext: zoveel meter mag de projectie voorbij het einde van de lijn doorlopen (voor een gematchte lijn die achter de auto aan komt).
function windowed(pos,from,to,line=geom,cum=geomCum,ext=0){
  let best=null;
  for(let i=1;i<line.length;i++){
    if(from!==null&&((cum[i]||0)<from||(cum[i-1]||0)>to))continue;
    const a=line[i-1],b=line[i];
    const mx=111320*Math.cos((a.latitude+b.latitude)/2*Math.PI/180),my=110540;
    const bx=(b.longitude-a.longitude)*mx,by=(b.latitude-a.latitude)*my;
    const px=(pos.longitude-a.longitude)*mx,py=(pos.latitude-a.latitude)*my;
    const len2=bx*bx+by*by,len=Math.sqrt(len2),top=i===line.length-1&&len?1+ext/len:1;
    let u=len2?(px*bx+py*by)/len2:0;if(u<0)u=0;else if(u>top)u=top;
    const dx=px-bx*u,dy=py-by*u,d=Math.sqrt(dx*dx+dy*dy);
    if(!best||d<best.distance-0.5)best={distance:d,index:i,along:(cum[i-1]||0)+len*u,longitude:a.longitude+(b.longitude-a.longitude)*u,latitude:a.latitude+(b.latitude-a.latitude)*u};
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
// --- Weergavepositie: de pijl op de weg ---------------------------------------
// De pijl stond tussen de straten in: de ruwe GPS-fix ligt vaak 10-30 m naast de weg. De navigatie zelf rekent al met de
// projectie op de route; de pijl en de kaart volgen nu ook een punt op de weg. Met route: op de route. Zonder route:
// op de lijn die Map Matching van de laatste fixes maakt (die geeft ook de maximumsnelheid). Lukt geen van beide, dan
// de GPS-fix, licht afgevlakt met de voorspelling uit snelheid en richting: een losse sprong trekt de pijl maar half mee.
const MATCH_GAP_MS=4000,MATCH_FRESH_MS=15000,MATCH_AHEAD_M=80,TRAIL_MS=60000;
let disp=null,trail=[],match=null,matchBusy=false,matchLast=0,matches=0,matchFails=0,matchErr='',ov=null,ovBusy=false,ovLast=0;
const bearingOf=(a,b)=>{const r=x=>x*Math.PI/180,y=Math.sin(r(b.longitude-a.longitude))*Math.cos(r(b.latitude)),x=Math.cos(r(a.latitude))*Math.sin(r(b.latitude))-Math.sin(r(a.latitude))*Math.cos(r(b.latitude))*Math.cos(r(b.longitude-a.longitude));return y||x?(Math.atan2(y,x)*180/Math.PI+360)%360:null};
const moveBy=(p,m,deg)=>{const r=deg*Math.PI/180;return{longitude:p.longitude+m*Math.sin(r)/(111320*Math.cos(p.latitude*Math.PI/180)),latitude:p.latitude+m*Math.cos(r)/110540}};
function place(){
  const p=s.pos;if(!p)return;
  const now=Date.now(),off=offLimit(p);let q=null,src='gps',brg=null;
  if(s.routeActive&&s.proj&&s.proj.distance<=off){q=s.proj;src='route'}
  else if(!s.routeActive&&match&&now-match.at<MATCH_FRESH_MS){const m=windowed(p,null,null,match.line,match.cum,MATCH_AHEAD_M);if(m&&m.distance<=off){q=m;src='match';brg=bearingOf(match.line[m.index-1],match.line[m.index])}}
  if(!q){
    q=p;const v=spd,h=Number.isFinite(p.heading)?p.heading:null,dt=disp?(now-disp.at)/1000:99,acc=Number(p.accuracy||0);
    if(disp&&v!=null&&h!=null&&dt<3&&acc>10){const pre=moveBy(disp,v*dt,h),k=Math.max(.35,10/acc);q={longitude:pre.longitude+k*(p.longitude-pre.longitude),latitude:pre.latitude+k*(p.latitude-pre.latitude)}}
  }
  if(brg==null)brg=Number.isFinite(p.heading)?p.heading:disp&&hav(disp,q)>=8?bearingOf(disp,q):disp?.bearing??null;
  disp={longitude:q.longitude,latitude:q.latitude,src,bearing:brg,at:now}
}
// Map Matching zonder route: de laatste fixes (hooguit een minuut, minstens 25 m gereden), elke 4 s één aanvraag.
// Een aanvraag die niets geeft (time-out, fout, geen match, onbekende snelheid) mag het bordje niet leeg laten: dan
// vraagt OpenStreetMap (overpassLimit) naar de weg onder de auto. Fouten komen in het foutlog (Diagnostiek) zodat een
// echte rit laat zien waarom. De aanvraag heeft een time-out: een aanvraag die op iOS blijft hangen hield matchBusy voorgoed vast.
const MATCH_TIMEOUT_MS=8000,OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
function matchFailed(why,p){matchFails++;matchErr=String(why);try{window.MAIRRuntime?.caught?.('carmode.match',Error(matchErr))}catch{/* log kapot: onschuldig */}overpassLimit(p)}
function fetchJson(url,ms){const ac=new AbortController(),to=setTimeout(()=>ac.abort(),ms);return fetch(url,{signal:ac.signal}).then(r=>{if(!r.ok)throw Error('http '+r.status);return r.json()}).finally(()=>clearTimeout(to))}
// OSM-tag maxspeed: "50", "50 mph", "NL:urban"; andere symbolische waarden ("NL:motorway" is 100 of 130) tellen niet.
const osmSpeed=v=>{v=String(v||'').trim();const m=/^(\d+)\s*(mph)?$/i.exec(v);return m?Math.round(m[2]?m[1]*1.609344:+m[1]):v==='NL:urban'?50:v==='NL:rural'?80:null};
// Gratis terugval: dichtstbijzijnde weg (hooguit 20 m) met een maxspeed-tag, hooguit eens per 8 s.
async function overpassLimit(p){
  const now=Date.now();if(s.routeActive||ovBusy||!p||now-ovLast<8000)return;
  ovLast=now;ovBusy=true;
  const q=`[out:json][timeout:5];way(around:20,${p.latitude.toFixed(6)},${p.longitude.toFixed(6)})[highway][maxspeed];out tags geom 8;`;
  try{
    for(const url of OVERPASS){
      let d;try{d=await fetchJson(`${url}?data=${encodeURIComponent(q)}`,6000)}catch{continue}
      let best=null;
      for(const w of d?.elements||[]){
        const line=(w.geometry||[]).map(g=>({longitude:g.lon,latitude:g.lat})),v=osmSpeed(w.tags?.maxspeed);if(line.length<2||v==null)continue;
        const cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+hav(line[i-1],line[i]));
        const m=windowed(p,null,null,line,cum);if(m&&(!best||m.distance<best.d))best={d:m.distance,v}
      }
      if(s.routeActive)return;
      ov={at:Date.now(),pos:{longitude:p.longitude,latitude:p.latitude},limit:best?best.v:null};render();return;
    }
  }finally{ovBusy=false}
}
function trackFix(p){
  const now=Date.now();trail.push({longitude:p.longitude,latitude:p.latitude,acc:Number(p.accuracy||0),t:now});
  trail=trail.filter(x=>now-x.t<TRAIL_MS).slice(-8);
  if(s.routeActive||!token||!open||matchBusy||now-matchLast<MATCH_GAP_MS||trail.length<3||hav(trail[0],trail.at(-1))<25)return;
  matchLast=now;matchBusy=true;const pts=trail.slice(),here=pts.at(-1);
  const qs=new URLSearchParams({access_token:token,geometries:'geojson',overview:'full',annotations:'maxspeed',tidy:'true',radiuses:pts.map(x=>Math.round(Math.min(50,Math.max(5,x.acc*1.5)))).join(';'),timestamps:pts.map(x=>Math.round(x.t/1000)).join(';')});
  fetchJson(`https://api.mapbox.com/matching/v5/mapbox/driving/${pts.map(x=>`${x.longitude.toFixed(6)},${x.latitude.toFixed(6)}`).join(';')}?${qs}`,MATCH_TIMEOUT_MS).then(d=>{
    if(s.routeActive)return;
    const m=d?.code==='Ok'?d.matchings?.at(-1):null,c=m?.geometry?.coordinates;
    if(!m||!d.tracepoints?.at(-1)||!Array.isArray(c)||c.length<2){matchFailed(d?.code==='Ok'?'laatste punt niet gematcht':d?.code||'leeg antwoord',here);return}
    const line=c.map(x=>({longitude:Number(x[0]),latitude:Number(x[1])})),cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+hav(line[i-1],line[i]));
    const e=(m.legs||[]).flatMap(l=>l?.annotation?.maxspeed||[]).at(-1),v=Number(e?.speed);
    match={line,cum,at:Date.now(),limit:Number.isFinite(v)&&v>0?Math.round(e.unit==='mph'?v*1.609344:v):null};matches++;
    if(match.limit==null)overpassLimit(here);
    place();render()
  }).catch(e=>matchFailed(e?.name==='AbortError'?'time-out':e?.message||e,here)).finally(()=>{matchBusy=false})
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
  let el=overlay.querySelector(':scope>.car-toast');
  if(!el){el=document.createElement('div');el.className='car-toast';overlay.appendChild(el)}
  el.textContent=String(text||'');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{try{el.remove()}catch{}},ms);
}
// --- Aankomst bij een stop --------------------------------------------------
// Aankomst = echt dichtbij het doel (haversine tot het gekozen punt of het aangesloten
// routepunt), dichtbij de route en niet meer dan een paar honderd meter route te gaan,
// bevestigd over drie geaccepteerde metingen. Alleen "along ligt dicht bij het einde van
// de leg" was te weinig: na de eerste rotonde meldde dat al "bestemming bereikt".
// Leg 0 is altijd het huidige doel: een gehaalde stop gaat uit s.stops en de route wordt
// opnieuw berekend vanaf hier. Tot die nieuwe route er is kloppen legAlong en s.stops niet
// meer met elkaar (lengte-controle hieronder), dus dan beoordeelt niets de aankomst.
const ARRIVE_M=150,ARRIVE_ROUTE_M=500,PASSED_M=50,ARRIVE_CONFIRM=3;
let arriveHits=0,routeDone=false;
function dropStop(index,text){
  if(!s.stops[index])return;s.stops.splice(index,1);arriveHits=0;
  if(s.pos)s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};
  toast(text,7000);publish();render();recalcAfterStops(true)
}
function checkArrival(){
  if(!s.proj||!s.pos||legAlong.length!==s.stops.length+1)return;
  const end=legAlong[0],along=s.proj.along;
  if(s.stops.length&&along>end+PASSED_M){dropStop(0,`${s.stops[0]?.name||'Tussenstop'} ligt achter je. Route gaat verder.`);return}
  const last=!s.stops.length,target=last?s.destination:s.stops[0],snapped=last?geom[geom.length-1]:mpoint((s.route?.legs?.[0]?.steps||[]).at(-1));
  const d=Math.min(hav(s.pos,target),hav(s.pos,snapped));
  const arrived=d<ARRIVE_M&&s.proj.distance<=offLimit(s.pos)&&end-along<=ARRIVE_ROUTE_M;
  if(!arrived){arriveHits=0;return}
  if(++arriveHits<ARRIVE_CONFIRM)return;
  arriveHits=0;
  const name=last?(s.destination?.name||'je bestemming'):(s.stops[0]?.name||'stop 1');
  if(last){routeDone=true;s.routeActive=false;s.near=false;s.screen='music';toast(`Je bent bij ${name}. Route klaar.`,9000);stopRefresh();publish();render()}
  else dropStop(0,`Je bent bij ${name}. Volgende stop wordt gevolgd.`)
}
// --- Afwijken van de route --------------------------------------------------
// Dwarsafstand tot de route, niet afstand tot een manoeuvrepunt. De drempel schaalt mee
// met de nauwkeurigheid van de fix (acceptFix laat tot 60 m toe, dus een vaste 40 m gaf
// valse afwijkingen). Alleen gelukte herberekeningen tellen mee voor de limiet, en een
// echte verkeerde afslag (ver van de route) wordt nooit door de limiet tegengehouden.
const OFFROUTE_M=40,OFFROUTE_FAR_M=150,OFFROUTE_CONFIRM=3,REROUTE_MIN_GAP_MS=20000,REROUTE_MAX=3,REROUTE_WINDOW_MS=300000;
let rerouteTimes=[],lastRerouteTry=0,rerouteHeld=false;
const offLimit=p=>Math.max(OFFROUTE_M,1.5*Number(p?.accuracy||0));
function checkOffRoute(){
  if(!s.proj||!s.routeActive){s.off=0;return}
  if(s.proj.distance<=offLimit(s.pos)){s.off=0;rerouteHeld=false;return}
  if(s.loading)return;
  if(++s.off<OFFROUTE_CONFIRM)return;
  const now=Date.now();
  rerouteTimes=rerouteTimes.filter(x=>now-x<REROUTE_WINDOW_MS);
  if(now-lastRerouteTry<REROUTE_MIN_GAP_MS)return;
  if(rerouteTimes.length>=REROUTE_MAX&&s.proj.distance<=OFFROUTE_FAR_M){if(!rerouteHeld){rerouteHeld=true;toast('Je wijkt af van de route. MAIRFM wacht even met herberekenen.',7000)}s.off=0;return}
  s.off=0;rerouteHeld=false;lastRerouteTry=now;
  s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};
  toast('Nieuwe route wordt berekend…',5000);
  route(true,{quiet:true}).then(r=>{if(r){rerouteTimes.push(Date.now());toast('Nieuwe route berekend.',5000)}}).catch(()=>toast('Nieuwe route berekenen lukte niet.',6000));
}
// Resterende afstand = routelengte min afgelegd (beide uit de geometrie), tijd naar rato.
// Eerder werden hele stappen vanaf s.step opgeteld, dus alles stond stil tot de volgende afslag.
function metrics(){
  if(!s.route)return{distance:null,duration:null};
  const total=routeLength(),dur0=Number(s.route.duration||0);
  if(!s.proj||!total)return{distance:Number(s.route.distance||total||0),duration:dur0};
  const rem=Math.max(0,total-s.proj.along);
  return{distance:rem,duration:dur0*rem/total}
}
function progress(){const total=routeLength();return total&&s.proj?Math.max(0,Math.min(1,s.proj.along/total)):0}
// Afstand en tijd tot de eerstvolgende stop (leg 0), alleen als er tussenstops zijn.
function legMetric(){
  const end=legAlong[0],leg=s.route?.legs?.[0];
  if(!s.stops.length||legAlong.length!==s.stops.length+1||!s.proj||!Number.isFinite(end)||!leg)return null;
  const rem=Math.max(0,end-s.proj.along);
  return{name:s.stops[0]?.name||'Tussenstop',distance:rem,duration:Number(leg.duration||0)*(end?Math.min(1,rem/end):0)}
}
function nearDistance(){
  const i=s.steps.indexOf(displayStep());
  const along=i>=0?alongToStep(i):null;
  if(Number.isFinite(along))return along;
  const p=mpoint(displayStep());return s.pos&&p?hav(s.pos,p):Number(displayStep()?.distance||Infinity)
}
const STEP_TOL_M=5,WEAK_GPS_MS=20000;
function updateNav(){
  if(!s.pos)return;
  if(!s.routeActive||!s.steps.length){place();render();return}
  s.proj=projectOnRoute(s.pos,s.proj?.along);
  // Stap pas door als het manoeuvrepunt langs de route bereikt of gepasseerd is (kleine
  // tolerantie voor GPS-ruis), en zo nodig meerdere stappen in één keer als twee manoeuvres
  // vlak achter elkaar liggen of er een fix ontbrak.
  while(s.step+1<s.steps.length){
    const t=stepAlong[s.step+1];
    if(s.proj&&Number.isFinite(t)){if(s.proj.along>=t-STEP_TOL_M)s.step++;else break}
    else{const np=mpoint(s.steps[s.step+1]);if(np&&hav(s.pos,np)<45)s.step++;else break}
  }
  const d=nearDistance(),v=Math.max(0,Number(s.pos.speed||0));
  s.near=Number.isFinite(d)&&d<=(v>22?900:v>12?650:450);
  checkArrival();
  if(!routeDone)checkOffRoute();
  place();publish();render()
}
// Flitsmeldingen (mair-car-cams.js) krijgen na elke geaccepteerde fix positie, richting, snelheid en de route. Optioneel: een fout daar raakt de rest niet.
function camsFeed(){
  try{
    const c=window.MAIRCarCams;if(!c)return;
    c.feed({pos:s.pos,bearing:disp?.bearing??s.pos?.heading??null,speed:spd,route:s.routeActive&&geom.length>1?{geom,cum:geomCum,along:s.proj?.along,on:!!s.proj&&s.proj.distance<=offLimit(s.pos),project:p=>windowed(p,null,null,geom,geomCum)}:null})
  }catch(e){try{window.MAIRRuntime?.caught?.('carmode.cams',e)}catch{/* log kapot: onschuldig */}}
}
// Geen bruikbare fix gedurende WEAK_GPS_MS (tunnel, alles geweigerd door acceptFix): rustige indicator, geen foutmelding.
let weakTimer=null;
function watch(){unwatch();if(!navigator.geolocation)return;s.posAt=Date.now();s.weak=false;weakTimer=setInterval(()=>{const w=!!(s.routeActive&&Date.now()-s.posAt>WEAK_GPS_MS);if(w!==s.weak){s.weak=w;render()}},5000);s.watch=navigator.geolocation.watchPosition(p=>{const fix=fixOf(p.coords);feedSpeed(p.coords);if(s.geo.status!=='granted')setGeo('granted');if(!acceptFix(fix))return;s.pos=fix;s.posAt=Date.now();s.weak=false;updateNav();trackFix(fix);camsFeed()},e=>{const status=geoStatusOf(e);setGeo(status,GEO_TEXT[status]||GEO_TEXT.error);if(status==='denied')s.error=GEO_TEXT.denied;/* timeout/onbeschikbaar: geen foutbalk, de GPS-zwak-indicator dekt dat */render()},{enableHighAccuracy:true,maximumAge:0,timeout:15000})}
function unwatch(){if(s.watch!=null&&navigator.geolocation)navigator.geolocation.clearWatch(s.watch);s.watch=null;clearInterval(weakTimer);weakTimer=null;s.weak=false}
function startRefresh(){stopRefresh();if(!s.routeActive)return;refreshTimer=setInterval(()=>{if(!open||!s.routeActive||document.visibilityState!=='visible'||!s.pos||s.loading||Date.now()-s.posAt>30000)return;s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};route(true,{quiet:true}).catch(()=>{})},120000)}
function stopRefresh(){if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}}
function publish(){const m=metrics(),detail={active:!!s.routeActive,destination:s.destination?.name||'',stops:s.stops.map(x=>x.name),remainingTravelTime:m.duration,arrivalTime:Number.isFinite(m.duration)?Date.now()+m.duration*1000:null,remainingDistance:m.distance,routeProgress:progress(),stopsRemaining:s.stops.length,nextManeuver:nextStep()?.maneuver?.instruction||''};window.MAIRJourneyContext=detail;try{window.dispatchEvent(new CustomEvent('mair:journey-context',{detail}))}catch{}}
function transport(a){const id=a==='play'?'play':a==='prev'?'prev':a==='next'?'next':'',el=id?$(id):null;if(el){el.click();setTimeout(render,100);return}if(a==='play')window.JFMPlayback?.playPause?.()}
function like(){$('loveTrack')?.click()}
// Afslagpijlen als SVG, gekozen op manoeuvretype + modifier (Mapbox gebruikt spaties in de types:
// roundabout, rotary, roundabout turn, exit roundabout, exit rotary, off ramp, on ramp, fork, merge,
// turn, end of road, continue, new name, depart, arrive, notification).
// Regels: een afrit of splitsing (off ramp, fork) krijgt een pijl die rechtdoor gaat en schuin uitbuigt;
// de omkeerpijl (uturn) komt ALLEEN bij modifier "uturn"; een rotonde heeft een eigen ring-pijl.
function maneuverKind(type,mod){
  type=String(type||'');mod=String(mod||'');
  if(/^(roundabout|rotary|roundabout turn)$/.test(type))return'roundabout';
  if(type==='arrive')return'arrive';
  if(mod==='uturn')return'uturn';
  const side=/left/.test(mod)?'left':/right/.test(mod)?'right':'',deg=/^sharp/.test(mod)?'sharp-':/^slight/.test(mod)?'slight-':'';
  if(!side)return'straight';
  if(type==='off ramp'||type==='fork')return'ramp-'+side;
  // doorrijden, invoegen en oprit: altijd een lichte bocht, nooit een harde, scherpe of omkeerpijl
  if(/^(merge|on ramp|continue|new name|depart|notification)$/.test(type))return'slight-'+side;
  return deg+side
}
const SK='stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const HEAD=(x,y,a)=>`<path d="M0-15 13 3H-13z" transform="translate(${x} ${y}) rotate(${a})" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`;
const MIRROR=g=>`<g transform="matrix(-1 0 0 1 64 0)">${g}</g>`;
const ARROW_R={
  straight:`<path d="M32 60V26" ${SK}/>${HEAD(32,17,0)}`,
  right:`<path d="M20 60V40Q20 25 35 25H42" ${SK}/>${HEAD(52,25,90)}`,
  'slight-right':`<path d="M24 60V47Q24 39 30 31L38 21" ${SK}/>${HEAD(41,16,38)}`,
  'sharp-right':`<path d="M16 60V30Q16 20 26 24L40 40" ${SK}/>${HEAD(45,46,140)}`,
  'ramp-right':`<g opacity=".32"><path d="M20 60V30" ${SK}/>${HEAD(20,22,0)}</g><path d="M20 60V47Q20 36 30 28L40 19" ${SK}/>${HEAD(44,15,48)}`
};
const ARROW_SVG={
  ...ARROW_R,
  left:MIRROR(ARROW_R.right),'slight-left':MIRROR(ARROW_R['slight-right']),'sharp-left':MIRROR(ARROW_R['sharp-right']),'ramp-left':MIRROR(ARROW_R['ramp-right']),
  uturn:`<path d="M44 60V28Q44 10 29 10Q14 10 14 28V40" ${SK}/>${HEAD(14,50,180)}`,
  arrive:`<path d="M32 59C21 46 17 38 17 29a15 15 0 0 1 30 0c0 9-4 17-15 30z" ${SK}/><circle cx="32" cy="29" r="5.5" fill="currentColor"/>`
};
// Rotonde: ring met de instap eronder en een uitgaande pijl in de richting van de afslag (modifier), zodat het geen omkeerpijl lijkt.
const roundaboutSvg=mod=>{
  if(/right/.test(mod))return`<circle cx="25" cy="40" r="11" ${SK}/><path d="M25 62V51M36 40H44" ${SK}/>${HEAD(50,40,90)}`;
  if(/left/.test(mod))return MIRROR(roundaboutSvg('right'));
  return`<circle cx="32" cy="40" r="11" ${SK}/><path d="M32 62V51M32 29V26" ${SK}/>${HEAD(32,17,0)}`
};
const arrowSvg=st=>{const k=maneuverKind(st?.maneuver?.type,st?.maneuver?.modifier);return`<svg class="car-arrow" data-kind="${k}" viewBox="0 0 64 64" role="img" aria-label="${k}">${k==='roundabout'?roundaboutSvg(String(st?.maneuver?.modifier||'')):ARROW_SVG[k]||ARROW_SVG.straight}</svg>`};
// Bij een rotonde levert Mapbox het afslagnummer in maneuver.exit (omdat
// roundabout_exits=true wordt meegestuurd). De Nederlandse instructietekst noemt dat
// nummer meestal al, dus het staat hier als losse badge bij de pijl in plaats van in
// de tekst - anders zou het dubbel op het scherm staan.
const exitBadge=st=>{const n=Number(st?.maneuver?.exit||0);return isRoundabout(st)&&n>0?`<span class="car-nav-exit" aria-label="${n}e afslag">${n}e</span>`:''};
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
function searchMarkup(){const rs=resultsHtml();const title=s.searchPurpose==='stop'?'Tussenstop toevoegen':'Waar wil je heen?';return`<section class="car-search"><header><button class="car-back" data-act="searchback">‹</button><div><small>CAR MODE</small><strong>${title}</strong></div></header><label class="car-searchbox"><span>⌕</span><input id="carSearchInput" autocomplete="off" placeholder="Plek, winkel of adres" value="${esc(s.searchQuery)}"></label>${s.error?`<div class="car-search-error">${esc(s.error)}</div>`:''}<div id="carSearchStatus" class="car-search-status"></div><div id="carSearchResults" class="car-search-results">${rs}</div><button class="car-text-action" data-act="music">Verder zonder route</button></section>`}
function stopRows(){return s.stops.map((x,i)=>`<div class="car-stop-row"><div><small>TUSSENSTOP ${i+1}</small><b>${esc(x.name)}</b></div><div class="car-stop-actions"><button data-stop-up="${i}" ${i===0?'disabled':''}>↑</button><button data-stop-down="${i}" ${i===s.stops.length-1?'disabled':''}>↓</button><button data-stop-remove="${i}">×</button></div></div>`).join('')}
function previewMarkup(){const m=metrics();return`<section class="car-preview"><header><button class="car-back" data-act="search">‹</button><div><small>ROUTE</small><strong>${esc(s.destination?.name||'Bestemming')}</strong></div></header><div class="car-preview-card"><div><small>VAN</small><b>Huidige locatie</b></div><div><small>NAAR</small><b>${esc(s.destination?.name||'')}</b></div><div><small>AANKOMST</small><b>${eta(m.duration)}</b></div></div><div class="car-stops-list">${stopRows()}<button class="car-add-stop" data-act="addstop">＋ Tussenstop toevoegen</button></div><div class="car-preview-metrics"><div><small>TIJD</small><b>${dur(m.duration)}</b></div><div><small>AFSTAND</small><b>${dist(m.distance)}</b></div><div><small>VERKEER</small><b>LIVE</b></div></div><div class="car-preview-go">${vibeButton()}<button class="car-route-start" data-act="start">ROUTE STARTEN</button></div></section>`}
const weakChip=()=>s.weak?'<div class="car-gps-weak">GPS-signaal zwak</div>':'';
const lower=t=>String(t).toLowerCase();
const distHtml=m=>{const[n,u]=dist(m).split(' ');return u?`${esc(n)}<small>${lower(u)}</small>`:esc(n)};
const durShort=x=>{if(!Number.isFinite(x))return'—';const m=Math.max(0,Math.round(x/60));return m<60?`${m} min`:`${Math.floor(m/60)} u ${String(m%60).padStart(2,'0')} min`};
// Snelheid: kmh komt uit coords.speed (null = onbekend = "--"); een fix ouder dan 10 s telt niet meer.
const kmhNow=()=>spd!=null&&Date.now()-spdAt<10000?Math.round(spd*3.6):null;
// Maximumsnelheid van het routesegment waar je nu op zit (limits staan gelijk aan de geometrie). Onbekend of "geen" = null.
function limitNow(){
  if(!s.routeActive){
    // Map Matching eerst, anders OpenStreetMap (alleen als dat voor de plek geldt waar je nu bent); ouder dan 30 s of onbekend = geen bordje.
    const now=Date.now(),fresh=x=>x&&now-x.at<30000&&x.limit!=null;
    return fresh(match)?match.limit:fresh(ov)&&s.pos&&hav(ov.pos,s.pos)<80?ov.limit:null
  }
  if(!limits.length||!s.proj)return null;
  const e=limits[Math.max(0,Math.min(limits.length-1,s.proj.index-1))],v=Number(e?.speed);
  return Number.isFinite(v)&&v>0?Math.round(e.unit==='mph'?v*1.609344:v):null
}
// Rijstroken: Mapbox hangt de banner van een manoeuvre aan de stap ERVOOR (bannerInstructions). Een banner
// geldt zodra de resterende afstand <= distanceAlongGeometry; de laatste die nog past is de actuele.
function bannerNow(){
  const i=s.steps.indexOf(displayStep());
  if(i<1)return null;
  const rem=nearDistance();let pick=null;
  for(const b of s.steps[i-1]?.bannerInstructions||[])if(b?.distanceAlongGeometry>=rem&&(!pick||b.distanceAlongGeometry<pick.distanceAlongGeometry))pick=b;
  return pick
}
const LANE_ANG={straight:0,'slight right':30,right:65,'sharp right':110,'slight left':-30,left:-65,'sharp left':-110,uturn:180};
function laneSvg(l){
  const dirs=(l.directions||[]).filter(d=>d in LANE_ANG),act=l.active?String(l.active_direction||''):'';
  const lit=d=>!!l.active&&(!act||d===act);
  const one=d=>`<g class="${lit(d)?'on':'off'}" transform="rotate(${LANE_ANG[d]} 20 58)"><path d="M20 58V30" ${SK}/>${HEAD(20,22,0)}</g>`;
  return`<svg viewBox="-24 2 88 64" aria-hidden="true">${[...dirs.filter(d=>!lit(d)),...dirs.filter(lit)].map(one).join('')}</svg>`
}
function laneMarkup(){
  const b=bannerNow(),lanes=(b?.sub?.components||[]).filter(c=>c?.type==='lane');
  if(!lanes.length)return'';
  const comps=b.primary?.components||[],chip=comps.find(c=>c?.type==='icon'&&c.mapbox_shield)?.mapbox_shield?.display_ref||comps.find(c=>c?.type==='exit-number')?.text||'';
  return`<aside class="car-lane-card"><div class="car-lane-head">${chip?`<span class="car-lane-chip">${esc(chip)}</span>`:''}<b>${esc(b.primary?.text||'')}</b></div><div class="car-lanes">${lanes.map(l=>`<i class="car-lane${l.active?' active':''}">${laneSvg(l)}</i>`).join('')}</div></aside>`
}
const IC={prev:'<svg viewBox="0 0 24 24"><path d="M6 5h2.4v14H6zM20 5v14L9.5 12z" fill="currentColor"/></svg>',next:'<svg viewBox="0 0 24 24"><path d="M15.6 5H18v14h-2.4zM4 5l10.5 7L4 19z" fill="currentColor"/></svg>',play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',pause:'<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.4z" fill="currentColor"/></svg>',heart:'<svg viewBox="0 0 24 24"><path d="M12 20.5 4.6 13A4.6 4.6 0 0 1 12 7.5 4.6 4.6 0 0 1 19.4 13z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'};
// C2: bovenbalk met afslag, banen en aankomst; kaart links, snelheid en muziek als blokken rechts. Eén indeling voor het hele rijscherm:
// er is geen aparte "vlak bij de afslag"-indeling meer (die miste de voortgangsbalk en liet het scherm wisselen).
function navCards(){
  const st=displayStep(),m=metrics(),lm=legMetric(),k=kmhNow(),lim=limitNow();
  const stopLine=lm?`<em class="car-stop-line">${esc(lm.name)} · ${lower(dist(lm.distance))} · ${eta(lm.duration)}</em>`:'';
  return`<div class="car-topbar"><aside class="car-turn-card"><div class="car-turn-arrow">${arrowSvg(st)}${exitBadge(st)}</div><div class="car-turn-copy"><b class="car-turn-dist">${distHtml(nearDistance())}</b><strong class="car-turn-text">${esc(instr(st))}</strong></div></aside>`
   +laneMarkup()
   +`<aside class="car-eta-card"><b class="car-eta">${eta(m.duration)}</b><span>${durShort(m.duration)} · ${lower(dist(m.distance))}</span>${stopLine}</aside></div>`
   +`<aside class="car-speed-card"><div class="car-speed-box"><b class="car-speed${lim&&k>lim?' over':''}">${k??'--'}</b><small>KM/U</small></div>${lim?`<div class="car-limit" aria-label="Maximumsnelheid ${lim}">${lim}</div>`:''}</aside>`
   +weakChip()
}
const speedCard=()=>{const k=kmhNow(),lim=limitNow();return`<aside class="car-speed-card"><div class="car-speed-box"><b class="car-speed${lim&&k>lim?' over':''}">${k??'--'}</b><small>KM/U</small></div>${lim?`<div class="car-limit" aria-label="Maximumsnelheid ${lim}">${lim}</div>`:''}</aside>`+weakChip()};
function driveMarkup(withNav){
  const p=play(),pct=p.duration>0?Math.max(0,Math.min(100,p.progress/p.duration*100)):0;
  const bar=`<div class="car-music-bar"><img class="car-artwork" src="${esc(p.image||'mair-icon-512.png')}" alt=""><div class="car-track-copy"><h1>${esc(p.title)}</h1><p>${esc(p.artist)}</p><div class="car-track-progress"><i style="width:${pct}%"></i></div></div>${vibeButton()}<div class="car-controls"><button type="button" class="car-like" data-like aria-label="Meer van dit">${IC.heart}</button><button type="button" data-tr="prev" aria-label="Vorige">${IC.prev}</button><button type="button" class="car-play" data-tr="play" aria-label="${p.isPlaying?'Pauzeren':'Afspelen'}">${p.isPlaying?IC.pause:IC.play}</button><button type="button" data-tr="next" aria-label="Volgende">${IC.next}</button></div></div>`;
  return`<section class="car-drive ${withNav?'':'music-only'}"><header class="car-drive-head"><strong>MAIRFM <span>${withNav?'· JOURNEY':'· MUSIC'}</span></strong><span class="car-head-actions">${withNav?'':'<button type="button" class="car-find" data-act="search" aria-label="Bestemming zoeken">⌕ Zoek</button>'}<button type="button" class="car-more" data-act="menu" aria-label="Menu">•••</button></span></header><div class="car-map-slot"></div>${withNav&&s.steps.length?navCards():speedCard()}${window.MAIRCarCams?.cardHtml?.()||''}${bar}${s.error?`<div class="car-toast">${esc(s.error)} <button data-act="dismiss">×</button></div>`:''}</section>`
}
// Kaart: één instantie per sessie (zie mair-car-map.js). Alleen zichtbaar als er een rijdende route is.
let mapEl=null,mapRoute=null;
function routeBearing(){
  if(s.proj&&geom.length>1&&s.proj.distance<=offLimit(s.pos)){const i=Math.max(1,Math.min(geom.length-1,s.proj.index)),b=bearingOf(geom[i-1],geom[Math.min(geom.length-1,i+2)]);if(b!=null)return b}
  return disp?.bearing??s.pos?.heading??undefined
}
function syncMap(){
  const M=window.MAIRCarMap;if(!M||!overlay)return;
  // C2: kaart op het rijscherm én zonder bestemming. Zonder actieve route geen routelijn.
  const nav=s.routeActive&&!!s.route,want=open&&(s.screen==='drive'||s.screen==='music')&&!!token&&!!(s.pos||nav);
  overlay.classList.toggle('car-has-nav',open&&s.screen==='drive'&&!!s.steps.length);
  if(!want){overlay.classList.remove('has-map');M.hide();return}
  // De kaartlaag moet zichtbaar zijn voordat Mapbox zijn formaat meet; valt de kaart uit, dan gaat .has-map weer weg.
  if(!M.status().failed)overlay.classList.add('has-map');
  const key=nav?s.route:null,fresh=mapRoute!==key;mapRoute=key;
  M.show({el:mapEl,token,center:s.pos?[s.pos.longitude,s.pos.latitude]:geom[0]?[geom[0].longitude,geom[0].latitude]:undefined,coords:fresh?(nav?geom.map(g=>[g.longitude,g.latitude]):[]):undefined}).then(ok=>{overlay.classList.toggle('has-map',!!ok&&!M.status().failed)});
  const at=disp||s.pos;
  if(at)M.follow({lon:at.longitude,lat:at.latitude,bearing:nav?routeBearing():disp?.bearing??s.pos?.heading??undefined,kmh:s.pos?.kmh});
  if(nav)M.setProgress?.(progress())
}
// Vibe = de stemming van de programmering (JFMRotation-modus). Bewaard in mair_director_state_v3, dus ook de volgende rit.
// Met route doet de journey-director het verloop binnen deze vibe (mair-journey-director.js).
const VIBES=[['mair','MAIR'],['drive','Rijden'],['energy','Energie'],['chill','Chill'],['party','Feest'],['discover','Ontdekken'],['forgotten','Vergeten favorieten']];
const vibeNow=()=>{try{return window.JFMRotation?.state?.().mode||'mair'}catch{return'mair'}};
const vibeLabel=()=>(VIBES.find(v=>v[0]===vibeNow())||VIBES[0])[1];
const vibeButton=()=>window.JFMRotation?.setMode?`<button type="button" class="car-vibe" data-act="vibe"><small>VIBE</small><b>${esc(vibeLabel())}</b></button>`:'';
function vibeSheet(){const now=vibeNow();return`<div class="car-menu-backdrop"><section class="car-menu car-vibes"><div class="car-vibe-grid">${VIBES.map(([id,l])=>`<button type="button" data-act="setvibe" data-vibe="${id}"${id===now?' class="on" aria-pressed="true"':''}>${esc(l)}</button>`).join('')}</div><button class="muted" data-act="menuclose">Annuleren</button></section></div>`}
// Nieuwe vibe: huidige nummer speelt door, de rest van de wachtrij wordt opnieuw gepland en Spotify krijgt de nieuwe volgorde.
// Alleen opnieuw ordenen veranderde tijdens een rit niets merkbaars (zelfde nummers, de journey-score weegt zwaar). Daarom komen de
// nummers na het huidige uit het station dat bij de vibe past. MAIR en Vergeten favorieten ordenen de eigen wachtrij opnieuw.
// Een station bouwen kost tijd: Spotify-zoekopdrachten lopen één voor één met minstens 1,5 s ertussen (spotify-test-config.js), dus
// 5 zoekopdrachten is al ~7,5 s zonder netwerk, en daarna nog het categoriefilter. 12 s was te krap op een telefoon: dan viel de
// vibe stil terug op opnieuw ordenen, en dat verandert met een route niets. Nu 30 s, met een melding vooraf en achteraf.
// Lukt het station niet, dan ook gewoon opnieuw ordenen: de muziek loopt altijd door.
const VIBE_STATION={drive:'hits',energy:'hits',chill:'chill',party:'party',discover:'new'};
const POOL_MS=30000;
async function vibePool(id){const st=VIBE_STATION[id];if(!st||!window.MAIRStationController?.buildPool)return null;let timer;try{const b=await Promise.race([window.MAIRStationController.buildPool(st),new Promise(r=>{timer=setTimeout(r,POOL_MS)})]);return b?.tracks?.length>=5?b.tracks:null}catch(e){window.MAIRRuntime?.caught?.('carmode.vibe-pool',e);return null}finally{clearTimeout(timer)}}
let vibeSeq=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
// Wat Spotify zelf als volgende klaar heeft staan, niet onze lokale lijst. programNext ververst de wachtrij ook, maar zonder te wachten.
async function spotifyNext(){const u=window.JFMSpotifyUpcomingTruth;if(!u?.sync)return null;await pause(1400);try{await u.sync(true)}catch(e){window.MAIRRuntime?.caught?.('carmode.vibe-sync',e)}const t=u.items?.[0];return t?{uri:t.uri||'',label:`${t.name}${t.artists?.length?' van '+t.artists.join(', '):''}`}:null}
async function applyVibe(id,seq){
  const name=(VIBES.find(v=>v[0]===id)||[id,id])[1],station=!!(VIBE_STATION[id]&&window.MAIRStationController?.buildPool);
  if(station)toast(`Vibe: ${name}. Nieuwe nummers zoeken…`,POOL_MS);
  const pool=await vibePool(id);if(seq!==vibeSeq)return;
  let ok=await window.JFMProgramDirector?.replan?.('vibe',true,pool);
  // replan geeft false als er al een replan loopt (bijvoorbeeld van de route) en slaat de wissel dan stil over
  if(!ok){await pause(2500);if(seq!==vibeSeq)return;ok=await window.JFMProgramDirector?.replan?.('vibe',true,pool)}
  if(seq!==vibeSeq)return;
  const want=window.JFMQueue?.current?.()?.[1]?.uri||'',next=ok?await spotifyNext():null;if(seq!==vibeSeq)return;
  if(next&&(!want||next.uri===want))toast(`Vibe: ${name}${station&&!pool?', nieuwe nummers laden lukte niet.':','} volgend nummer is ${next.label}`,9000);
  else toast(`Vibe: ${name} gekozen, maar Spotify heeft de nieuwe volgorde nog niet overgenomen${next?'. Volgend nummer blijft '+next.label:''}`,9000)
}
function setVibe(id){if(!window.JFMRotation?.setMode?.(id))return;render();const seq=++vibeSeq;applyVibe(id,seq).catch(e=>{window.MAIRRuntime?.caught?.('carmode.vibe',e);if(seq===vibeSeq)toast('Vibe wisselen lukte niet. De muziek speelt door.',7000)})}
const camsButton=()=>window.MAIRCarCams?`<button data-act="cams" aria-pressed="${window.MAIRCarCams.isOn()}">Flitsers: ${window.MAIRCarCams.isOn()?'aan':'uit'}</button>`:'';
function menu(){return`<div class="car-menu-backdrop"><section class="car-menu"><button data-act="vibe">Vibe: ${esc(vibeLabel())}</button>${camsButton()}${s.routeActive?'<button data-act="addstop">Tussenstop toevoegen</button><button data-act="search">Bestemming wijzigen</button><button data-act="waze">Open in Waze</button><button data-act="music">Verder zonder route</button>':'<button data-act="search">Bestemming toevoegen</button>'}<button class="danger" data-act="close">Car Mode sluiten</button><button class="muted" data-act="menuclose">Annuleren</button></section></div>`}
function openSearch(purpose='destination'){closeMenu();s.searchPurpose=purpose;s.searchQuery='';s.searchResults=[];s.error='';s.screen='search';render();queueMicrotask(bindSearch);
  // Hier is locatie voor het eerst echt nodig (proximity bij zoeken en straks als
  // vertrekpunt), dus hier hoort de iOS-prompt. Niet blokkerend: zoeken werkt ook
  // zonder fix, alleen zonder nabijheidsvoorkeur.
  ensureLocation().catch(()=>{})}
async function recalcAfterStops(quiet=false){if(!s.origin||!s.destination)return;try{await route(true,{quiet})}catch{}}
function ensure(){if(overlay)return overlay;overlay=document.createElement('div');overlay.id='mairCarWaveOverlay';overlay.className='mair-car-wave-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');mapEl=document.createElement('div');mapEl.id='carMap';overlay.appendChild(mapEl);screenHost=document.createElement('div');screenHost.id='carScreen';overlay.appendChild(screenHost);document.body.appendChild(overlay);overlay.addEventListener('click',async e=>{const tr=e.target.closest('[data-tr]');if(tr){transport(tr.dataset.tr);return}if(e.target.closest('[data-like]')){like();return}const rr=e.target.closest('[data-recent]');if(rr){const d=recents[Number(rr.dataset.recent)];if(d){s.destination=d;s.error='';await prepare()}return}const up=e.target.closest('[data-stop-up]');if(up){const i=Number(up.dataset.stopUp);if(i>0){[s.stops[i-1],s.stops[i]]=[s.stops[i],s.stops[i-1]];await recalcAfterStops();render()}return}const down=e.target.closest('[data-stop-down]');if(down){const i=Number(down.dataset.stopDown);if(i>=0&&i<s.stops.length-1){[s.stops[i],s.stops[i+1]]=[s.stops[i+1],s.stops[i]];await recalcAfterStops();render()}return}const rem=e.target.closest('[data-stop-remove]');if(rem){s.stops.splice(Number(rem.dataset.stopRemove),1);await recalcAfterStops();render();return}const res=e.target.closest('[data-result-index]');if(res){const d=s.searchResults[Number(res.dataset.resultIndex)];if(d){if(s.searchPurpose==='stop'){s.stops.push({...d});s.error='';if(s.routeActive){s.screen='drive';if(s.pos)s.origin={name:'Huidige locatie',latitude:s.pos.latitude,longitude:s.pos.longitude};await recalcAfterStops()}else{s.screen='preview';await recalcAfterStops()}render()}else{s.destination={...d};s.error='';await prepare()}}return}const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;if(a!=='menu')closeMenu();if(a==='home'){s.routeActive=false;s.screen='home';unwatch();stopRefresh();publish();render()}else if(a==='search'){openSearch('destination')}else if(a==='searchback'){s.screen=s.destination?'preview':'home';render()}else if(a==='addstop'){openSearch('stop')}else if(a==='music'){s.routeActive=false;s.screen='music';watch();stopRefresh();publish();render()}else if(a==='start'){const change=s.routeActive;s.routeActive=true;s.screen='drive';try{window.dispatchEvent(new CustomEvent('mair:car-route-start',{detail:{destination:s.destination?{...s.destination}:null,duration:Number(s.route?.duration||0),change}}))}catch{/* alleen voor de DJ (mair-car-ride-dj.js) */}if(s.destination)recents=[s.destination,...recents.filter(x=>x.longitude!==s.destination.longitude||x.latitude!==s.destination.latitude)].slice(0,5);watch();startRefresh();publish();render()}else if(a==='vibe'){overlay.insertAdjacentHTML('beforeend',vibeSheet())}else if(a==='setvibe'){setVibe(e.target.closest('[data-vibe]')?.dataset.vibe)}else if(a==='menu'){if(!overlay.querySelector('.car-menu-backdrop'))overlay.insertAdjacentHTML('beforeend',menu())}else if(a==='cams'){window.MAIRCarCams?.toggle();closeMenu();render()}else if(a==='menuclose')closeMenu();else if(a==='dismiss'){s.error='';render()}else if(a==='locate'){ensureLocation({force:true}).catch(()=>{})}else if(a==='waze'){if(s.destination)location.href=`https://waze.com/ul?ll=${encodeURIComponent(`${s.destination.latitude},${s.destination.longitude}`)}&navigate=yes`}else if(a==='close'){closeMenu();setOpen(false)}});return overlay}
function closeMenu(){overlay?.querySelector('.car-menu-backdrop')?.remove()}
function bindSearch(){const input=$('carSearchInput'),out=$('carSearchResults'),status=$('carSearchStatus');if(!input||input.dataset.bound)return;input.dataset.bound='1';input.focus();input.addEventListener('input',()=>{clearTimeout(searchTimer);const q=input.value.trim();s.searchQuery=q;s.error='';if(q.length<2){s.searchResults=[];out.innerHTML='';status.textContent='';return}searchTimer=setTimeout(async()=>{status.textContent='Zoeken…';try{const items=await search(q);if(q!==s.searchQuery)return;s.searchResults=items;status.textContent=items.length?'':'Geen bestemmingen gevonden.';out.innerHTML=resultsHtml()}catch(e){if(e?.name!=='AbortError')status.textContent=e?.message||'Zoeken mislukt.'}},350)})}
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
  if(out)out.innerHTML=resultsHtml();
  const err=overlay?.querySelector('.car-search-error');
  if(err){err.textContent=s.error||'';err.hidden=!s.error}
  return true;
}
// Alleen bijwerken wat veranderd is. Eerder werd overlay.innerHTML bij elke GPS-fix, elk
// trackevent en elke voortgangstik vervangen: een tik die tussen touchstart en touchend viel
// verdween, de hoes laadde opnieuw en het menu klapte dicht. morphKids past de bestaande DOM
// aan (zelfde element blijft hetzelfde element). Het schermdeel zit in #carScreen, zodat menu
// en meldingen daarbuiten blijven staan. De Passenger-chip is van een andere module en blijft staan.
let screenHost=null,lastHtml='',mountedScreen='';
function morphKids(from,to){
  const f=[...from.childNodes],t=[...to.childNodes];
  for(let i=0;i<t.length;i++){
    const a=f[i],b=t[i];
    if(!a){from.appendChild(b);continue}
    if(a.nodeType!==b.nodeType||(a.nodeType===1&&a.tagName!==b.tagName)){from.replaceChild(b,a);continue}
    if(a.nodeType===3){if(a.data!==b.data)a.data=b.data;continue}
    // style blijft staan als de nieuwe markup er geen heeft: mair-car-autofit zet daar zijn lettergrootte
    for(const at of [...a.attributes])if(at.name!=='style'&&!b.hasAttribute(at.name))a.removeAttribute(at.name);
    for(const at of b.attributes)if(a.getAttribute(at.name)!==at.value)a.setAttribute(at.name,at.value);
    morphKids(a,b)
  }
  for(let i=f.length-1;i>=t.length;i--)if(!f[i].matches?.('.car-passenger-chip'))from.removeChild(f[i])
}
function mount(key,html){
  if(key!==mountedScreen){screenHost.textContent='';lastHtml='';mountedScreen=key}
  if(html===lastHtml)return;lastHtml=html;
  const tpl=document.createElement('template');tpl.innerHTML=html;morphKids(screenHost,tpl.content)
}
// In de iOS-app (contentInset) laat de webview de veilige zijkanten al vrij, maar env(safe-area-inset-*) telt ze nog een
// keer: dubbele zwarte randen. Is het venster smaller dan het scherm, dan zijn de zijkanten al vrij.
const insetByShell=()=>innerWidth<Math.max(screen.width,screen.height)-20;
function render(){ensure();if(!open)return;overlay.dataset.screen=s.screen;overlay.classList.toggle('car-inset',insetByShell());if(s.screen==='search'&&$('carSearchInput'))return void patchSearch();
  if(s.screen==='home')mount('home',startMarkup());
  else if(s.screen==='search'){mount('search',searchMarkup());queueMicrotask(bindSearch)}
  else if(s.screen==='preview')mount('preview',s.loading?`<section class="car-loading"><b>${esc(s.destination?.name||'Bestemming geselecteerd')}</b><span>GPS en verkeer ophalen…</span></section>`:previewMarkup());
  else if(s.screen==='drive')mount('drive',driveMarkup(true));
  else mount('music',driveMarkup(false));
  syncMap()}
const wakeSupported=()=>!!navigator.wakeLock?.request;function wakeRetryStart(){if(wakeRetry)clearTimeout(wakeRetry);if(open&&document.visibilityState==='visible'&&wakeSupported())wakeRetry=setTimeout(()=>requestWake(),1500)}async function requestWake(){if(!open||document.visibilityState!=='visible'||!wakeSupported())return false;if(wake&&!wake.released)return true;try{const l=await navigator.wakeLock.request('screen');wake=l;l.addEventListener('release',()=>{if(wake===l)wake=null;wakeRetryStart()},{once:true});return true}catch{wake=null;return false}}async function releaseWake(){if(wakeRetry){clearTimeout(wakeRetry);wakeRetry=null}const l=wake;wake=null;if(l&&!l.released)try{await l.release()}catch{}}
// Eén lay-out, ook na een update: de stylesheet meldt zijn lay-out via --car-layout. Komt dat niet overeen met
// deze JS (oude CSS uit een halve cache), dan wordt de CSS één keer vers opgehaald.
const LAYOUT='c2-20261016c';
function healLayout(){
  try{
    if(getComputedStyle(document.documentElement).getPropertyValue('--car-layout').trim().replace(/"/g,'')===LAYOUT)return;
    const l=document.querySelector('link[href*="mair-car-mode-wave.css"]');
    if(l&&!l.dataset.healed){l.dataset.healed='1';l.href=l.getAttribute('href').split('?')[0]+'?v='+LAYOUT}
  }catch{/* geen stylesheet-info: onschuldig */}
}
function setOpen(v){ensure();open=!!v;overlay.classList.toggle('is-open',open);document.body.classList.toggle('mair-car-mode-open',open);if(open){healLayout();document.body.dataset.mairCarMode='1';s.screen=s.routeActive?'drive':'home';if(s.routeActive){watch();startRefresh()}config().then(render);requestWake();render()}else{delete document.body.dataset.mairCarMode;unwatch();stopRefresh();closeMenu();releaseWake();try{window.MAIRCarCams?.reset?.()}catch{/* flitsers zijn optioneel: onschuldig */}try{window.MAIRCarMap?.destroy?.()}catch{/* kaart al weg: onschuldig */}mapRoute=null;disp=null;trail=[];match=null;ov=null}try{window.dispatchEvent(new CustomEvent('mair:car-mode',{detail:{open}}))}catch{}}
document.addEventListener('keydown',e=>{if(open&&e.key==='Escape')setOpen(false)});document.addEventListener('visibilitychange',()=>{if(!open)return;document.visibilityState==='visible'?requestWake():releaseWake()});window.addEventListener('pageshow',()=>{if(open)requestWake()});window.addEventListener('pagehide',()=>releaseWake());['jfm:trackchange','jfm:playback-state','jfm:upcoming-invalidated','mair:director-replanned','mair:channelchange'].forEach(n=>window.addEventListener(n,()=>{if(open)render()}));
window.MAIRCarModePrototype={version:'journey-nav-v8-c2-2026-10-16',open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!open),render,chooseDestination:()=>openSearch('destination'),addStop:()=>openSearch('stop'),status:()=>({open,screen:s.screen,routeActive:s.routeActive,destination:s.destination,stops:s.stops.slice(),wakeLockSupported:wakeSupported(),wakeLockActive:!!(wake&&!wake.released),geo:{...s.geo},hasPosition:!!s.pos,legMetrics:legMetric(),kmh:kmhNow(),limit:limitNow(),lanes:(bannerNow()?.sub?.components||[]).filter(x=>x?.type==='lane').length,rem:nearDistance(),stepIndex:s.step,layout:LAYOUT,display:disp?{...disp}:null,matches,matchFails,matchErr,limitFrom:s.routeActive?'route':match&&Date.now()-match.at<30000&&match.limit!=null?'match':ov&&Date.now()-ov.at<30000&&ov.limit!=null?'osm':null,map:window.MAIRCarMap?.status?.()||null,cams:window.MAIRCarCams?.status?.()||null,journey:window.MAIRJourneyContext||null}),requestLocation:()=>ensureLocation({force:true}),menuHtml:menu,vibe:vibeNow,toast,maneuverKind,arrowSvg};
})();