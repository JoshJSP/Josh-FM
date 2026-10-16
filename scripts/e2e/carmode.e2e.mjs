// Car Mode (ontwerp C2) in de echte app (headless Chrome) met nep-GPS en een nep-Mapbox.
//   node scripts/e2e/carmode.e2e.mjs [map-voor-screenshots]      (ONLY=nav|stops|concurrent|sizes|arrows|map|map2|search|portrait|snap|noroute|vibe|zoomout|vibewidth|viberide)
// Route: rechte lijn naar het oosten, rotonde op 1,5 km (2e afslag), afrit rechts op 25 km (met rijstroken-banner op
// 800 m ervoor), 25,5 km in totaal. Maximumsnelheid: 100 tot 5 km, 130 tot 8 km, onbekend tot 9 km, daarna 80.
// Het GPS-filter weigert sprongen sneller dan 110 m/s; Date.now() krijgt daarom een instelbare voorsprong
// (window.__skew) zodat de test grote stappen kan zetten zonder minutenlang te rijden.
// De kaart is echt Mapbox GL JS (vendor/mapbox-gl); alleen de netwerkantwoorden zijn nep: een minimale donkere stijl met wat
// wegen en water als decor. Daarmee test dit de echte kaartcode (laden, route-laag, volgen, draaien) zonder token of netwerk.
import {launch,boot,until,sleep,checker,ORIGIN} from './harness.mjs';
import fs from 'node:fs';

const outDir=process.argv[2]||'';
if(outDir)fs.mkdirSync(outDir,{recursive:true});
const c=checker();
const LAT0=52.0,LON0=5.0,MX=lat=>111320*Math.cos(lat*Math.PI/180),M_LAT=110540;
const DEST_M=25500,STOP_M=10000,RAMP_M=25000;
const lonAt=(m,lat=LAT0,lon0=LON0)=>lon0+m/MX(lat);

// ---- nep-Mapbox -------------------------------------------------------------
const LANES=[{type:'lane',text:'',directions:['left'],active:false},{type:'lane',text:'',directions:['straight','slight left'],active:true,active_direction:'slight left'},{type:'lane',text:'',directions:['straight'],active:false},{type:'lane',text:'',directions:['straight'],active:false}];
const limitAt=x=>x<5000?{speed:100,unit:'km/h'}:x<8000?{speed:130,unit:'km/h'}:x<9000?{unknown:true}:{speed:80,unit:'km/h'};
function makeRoute(pts,withRoundabout,{annotate=true}={}){
  const [lon0,lat0]=pts[0],mx=MX(lat0),xs=pts.map(p=>(p[0]-lon0)*mx);
  const loc=x=>[lon0+x/mx,lat0],coords=[];
  const last=xs.at(-1);for(let x=0;x<last;x+=100)coords.push(loc(x));coords.push(loc(last));
  const legs=[];let total=0,dur=0;
  for(let i=0;i<pts.length-1;i++){
    const a=xs[i],b=xs[i+1],len=b-a,marks=[[a,'depart',{}]];
    if(withRoundabout&&i===0&&len>2000)marks.push([a+1500,'roundabout',{exit:2,modifier:'right',instruction:'Ga Nelson Mandelaplein op en neem de 2e afslag richting N210/Zomerdijk/IJsselstein-Noord.'}],[a+1560,'exit roundabout',{modifier:'right'}]);
    if(len>2000)marks.push([b-500,'off ramp',{modifier:'right',instruction:'Neem de afrit rechts naar A27 richting Oosterhout.'}]);
    marks.push([b,'arrive',{instruction:'Je bent gearriveerd.'}]);
    const steps=marks.map(([x,type,o],k)=>{const d=k<marks.length-1?marks[k+1][0]-x:0;return{distance:d,duration:d/25,name:'',maneuver:{type,modifier:o.modifier,exit:o.exit,instruction:o.instruction||(type==='depart'?'Rijd naar het oosten.':'Ga verder.'),location:loc(x)}}});
    // banners staan op de stap vóór de manoeuvre; de afrit krijgt 800 m ervoor de rijstroken
    steps.forEach((st,k)=>{const nx=steps[k+1];if(!nx||nx.maneuver.type!=='off ramp')return;
      st.bannerInstructions=[{distanceAlongGeometry:st.distance,primary:{text:'Afrit rechts',components:[{type:'text',text:'Afrit rechts'}]},sub:null},
        {distanceAlongGeometry:800,primary:{text:'Afslag 16 · Oosterhout',components:[{type:'icon',text:'A27',mapbox_shield:{display_ref:'A27'}},{type:'exit-number',text:'16'},{type:'text',text:'Oosterhout'}]},sub:{text:'',components:LANES}}]});
    const annotation=annotate?{maxspeed:Array.from({length:Math.max(0,Math.round((Math.min(b,last)-a)/100)+(i===pts.length-2&&(last%100)?1:0))},(_,j)=>limitAt(a+j*100))}:undefined;
    legs.push({distance:len*1.003,duration:len/25,steps,annotation});total+=len*1.003;dur+=len/25;
  }
  // annotation per leg moet samen precies coords.length-1 segmenten zijn
  if(annotate){const all=legs.flatMap(l=>l.annotation.maxspeed),want=coords.length-1;while(all.length<want)all.push(limitAt(last));if(all.length>want)all.length=want;let k=0;legs.forEach((l,i)=>{const n=i===legs.length-1?want-k:l.annotation.maxspeed.length;l.annotation.maxspeed=all.slice(k,k+n);k+=n})}
  return{routes:[{distance:total,duration:dur,geometry:{type:'LineString',coordinates:coords},legs}]};
}
// Donker decor rond de route (alleen voor de screenshot): water, park en wat wegen. De route zelf tekent de app.
function decor(){
  const f=[],P=(x,y)=>[lonAt(x),LAT0+y/M_LAT];
  const road=(cls,...p)=>f.push({type:'Feature',properties:{cls},geometry:{type:'LineString',coordinates:p.map(q=>P(...q))}});
  for(let k=-6;k<=60;k++)road('street',[k*220,-1500],[k*220+160,1500]);
  for(let k=-8;k<=8;k++)road('street',[-1000,k*190],[70000,k*190+90]);
  road('main',[-1000,260],[3000,300],[7000,200],[30000,-120]);road('main',[24200,-1500],[24700,-300],[25000,-60],[25400,900]);
  f.push({type:'Feature',properties:{cls:'water'},geometry:{type:'Polygon',coordinates:[[P(3600,-900),P(4600,-700),P(5200,-300),P(5300,-1500),P(3500,-1500),P(3600,-900)].map(x=>x)]}});
  f.push({type:'Feature',properties:{cls:'park'},geometry:{type:'Polygon',coordinates:[[P(900,200),P(1500,350),P(1600,900),P(800,1000),P(900,200)]]}});
  return{type:'FeatureCollection',features:f};
}
// Zoals navigation-night: al vroeg een symbol-laag (eenrichtingspijlen), daarna nog wegen en bruggen, labels als laatste.
const STYLE_JSON=()=>({version:8,name:'e2e-nacht',sources:{decor:{type:'geojson',data:decor()},tiles:{type:'vector',tiles:['https://api.mapbox.com/v4/e2e/{z}/{x}/{y}.mvt'],maxzoom:14}},layers:[
  {id:'bg',type:'background',paint:{'background-color':'#10131c'}},
  {id:'park',type:'fill',source:'decor',filter:['==',['get','cls'],'park'],paint:{'fill-color':'#0f2420'}},
  {id:'water',type:'fill',source:'decor',filter:['==',['get','cls'],'water'],paint:{'fill-color':'#0c2339'}},
  {id:'streets',type:'line',source:'decor',filter:['==',['get','cls'],'street'],paint:{'line-color':'#232c42','line-width':2}},
  {id:'tile-roads',type:'line',source:'tiles','source-layer':'roads',paint:{'line-color':'#232c42','line-width':2}},
  {id:'oneway-arrows',type:'symbol',source:'decor',filter:['==',['get','cls'],'none'],layout:{'icon-image':'oneway'}},
  {id:'main',type:'line',source:'decor',filter:['==',['get','cls'],'main'],paint:{'line-color':'#35416a','line-width':9}},
  {id:'bridge-street',type:'line',source:'decor',filter:['==',['get','cls'],'main'],paint:{'line-color':'#3b4772','line-width':5}},
  {id:'road-label',type:'symbol',source:'decor',filter:['==',['get','cls'],'none'],layout:{'icon-image':'label'}}]});
async function mapbox(h,{token=process.env.REAL_MM_TOKEN||'pk.test'}={}){
  const m={directions:0,delayNext:0,failNext:false,roundabout:true,annotate:true,queries:[],params:[],styleReq:0,otherReq:[],box:[],geocode:[],matching:[],failMatch:false,hangMatch:false,matchHttp:0,overpass:[],ovSpeed:'80',failOverpass:false,failBox:false,failTiles:false,tiles:{ok:0,fail:0}};
  await h.page.route(ORIGIN+'/api/config',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({spotifyClientId:'mockclientid0123456789abcdef',mapboxPublicToken:token})}));
  await h.page.route('https://api.mapbox.com/**',async route=>{
    const u=new URL(route.request().url());
    const J=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)}).catch(()=>{});
    const F=(name,x,y=0,id='')=>({type:'Feature',geometry:{type:'Point',coordinates:[lonAt(x),LAT0+y/M_LAT]},properties:{mapbox_id:id,name,full_address:name+', Nederland',feature_type:'poi'}});
    const q=u.searchParams.get('q')||'';
    if(u.pathname.includes('/search/searchbox/')){
      // Search Box kent plekken. Een keten met alleen proximity: eerst ver weg (Amsterdam), met bbox: wat dichtbij is.
      const bbox=u.searchParams.get('bbox'),prox=u.searchParams.get('proximity');m.box.push({q,bbox,prox});m.queries.push(q);
      if(m.failBox)return J({message:'kapot'},500);
      if(/albert heijn/i.test(q))return J({type:'FeatureCollection',features:bbox?[F('Albert Heijn Dichtbij',2000,0,'ah-dichtbij'),F('Albert Heijn Vleuten',5000,0,'ah-vleuten')]:[F('Albert Heijn Amsterdam',0,41000,'ah-amsterdam'),F('Albert Heijn Vleuten',5000,0,'ah-vleuten')]});
      if(/susu/i.test(q))return J({type:'FeatureCollection',features:[F('Asian Fusion Susu Harmelen',3000,500,'susu')]});
      if(/kerkstraat/i.test(q))return J({type:'FeatureCollection',features:[]});
      const x=/stop/i.test(q)?STOP_M:DEST_M,name=/stop/i.test(q)?'Tussenstop A':'Testbestemming';
      return J({type:'FeatureCollection',features:[F(name,x,0,name)]});
    }
    if(u.pathname.includes('/search/geocode/')){
      m.geocode.push(q);m.queries.push(q);
      if(/kerkstraat/i.test(q))return J({features:[F('Kerkstraat 1',1200)]});
      const x=/stop/i.test(q)?STOP_M:DEST_M,name=/stop/i.test(q)?'Tussenstop A':'Testbestemming';
      return J({features:[{geometry:{coordinates:[lonAt(x),LAT0]},properties:{name,full_address:name+', Nederland'}}]});
    }
    if(u.pathname.includes('/matching/')&&process.env.REAL_MM_TOKEN){m.matching.push(Object.fromEntries(u.searchParams));return route.continue()}
    if(u.pathname.includes('/matching/')&&m.hangMatch){m.matching.push(Object.fromEntries(u.searchParams));return}
    if(u.pathname.includes('/matching/')&&m.matchHttp){m.matching.push(Object.fromEntries(u.searchParams));return J({message:'Too Many Requests'},m.matchHttp)}
    if(u.pathname.includes('/matching/')){
      // De "weg" is de lijn lat=LAT0: elke fix wordt daarop gezet, maximumsnelheid 50.
      const pts=decodeURIComponent(u.pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));m.matching.push(Object.fromEntries(u.searchParams));
      if(m.failMatch)return J({code:'NoMatch',message:'geen match'});
      const coords=pts.map(p=>[p[0],LAT0]);
      return J({code:'Ok',matchings:[{confidence:.9,geometry:{type:'LineString',coordinates:coords},legs:coords.slice(1).map(()=>({annotation:{maxspeed:[{speed:50,unit:'km/h'}]}}))}],tracepoints:coords.map((c,i)=>({location:c,waypoint_index:i,matchings_index:0}))});
    }
    if(u.pathname.startsWith('/v4/e2e/')){if(m.failTiles){m.tiles.fail++;return route.fulfill({status:503,body:'',headers:{'access-control-allow-origin':'*'}}).catch(()=>{})}m.tiles.ok++;return route.fulfill({status:200,contentType:'application/x-protobuf',body:Buffer.alloc(0),headers:{'access-control-allow-origin':'*'}}).catch(()=>{})}
    if(u.pathname.startsWith('/styles/v1/')){m.styleReq++;m.styleUrl=u.pathname;return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(STYLE_JSON())}).catch(()=>{})}
    if(!u.pathname.startsWith('/directions/')){m.otherReq.push(u.pathname);return route.fulfill({status:404,body:'{}',headers:{'access-control-allow-origin':'*'}}).catch(()=>{})}
    m.directions++;m.params.push(Object.fromEntries(u.searchParams));
    if(m.delayNext){const d=m.delayNext;m.delayNext=0;await sleep(d)}
    if(m.failNext){m.failNext=false;return route.fulfill({status:500,body:'{}'}).catch(()=>{})}
    const pts=decodeURIComponent(u.pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));
    const body=JSON.stringify(makeRoute(pts,m.roundabout&&m.directions===1,{annotate:m.annotate}));
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body}).catch(()=>{});
  });
  // OpenStreetMap (Overpass): een weg met maxspeed ter plekke van de vraag (lat=LAT0), plus een verdere weg met 30 als lokaas.
  await h.page.route(/https:\/\/overpass[^/]*\/api\/interpreter/,route=>{
    const q=new URL(route.request().url()).searchParams.get('data')||'',pos=/around:\d+,([\d.-]+),([\d.-]+)/.exec(q)||[];m.overpass.push({q,url:route.request().url().split('?')[0]});
    const H={'access-control-allow-origin':'*'};
    if(m.failOverpass)return route.fulfill({status:502,body:'busy',headers:H}).catch(()=>{});
    const lon=Number(pos[2]),way=(dlat,speed,id)=>({type:'way',id,tags:{highway:'residential',...(speed?{maxspeed:speed}:{})},geometry:[{lat:LAT0+dlat,lon:lon-0.01},{lat:LAT0+dlat,lon:lon+0.01}]});
    return route.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify({elements:m.ovSpeed===null?[]:[way(.00015,'30',2),way(0,m.ovSpeed,1)]})}).catch(()=>{});
  });
  return m;
}

// ---- hulpjes ----------------------------------------------------------------
async function setup({width=844,height=390}={}){
  const h=await launch({trackMs:900000,width,height});
  await h.ctx.grantPermissions(['geolocation'],{origin:ORIGIN});
  await h.ctx.setGeolocation({latitude:LAT0,longitude:LON0,accuracy:10});
  await h.page.addInitScript(()=>{
    window.__skew=0;const n=Date.now.bind(Date);Date.now=()=>n()+window.__skew;
    window.__toasts=[];window.__clicks=0;window.__speed=null;
    // Playwright kan geen snelheid zetten: coords.speed komt uit window.__speed (m/s of null, zoals iOS zonder snelheid)
    try{Object.defineProperty(GeolocationCoordinates.prototype,'speed',{get(){return window.__speed}})}catch{}
    window.__heading=null;try{Object.defineProperty(GeolocationCoordinates.prototype,'heading',{get(){return window.__heading}})}catch{}
    const grab=el=>{const t=el?.closest?.('#mairCarWaveOverlay>.car-toast');if(t&&t.textContent)window.__toasts.push(t.textContent)};
    new MutationObserver(ms=>{for(const m of ms){if(m.target.nodeType===1&&m.target.matches('.car-toast'))grab(m.target);m.addedNodes.forEach(n=>{if(n.nodeType===1)grab(n)})}}).observe(document,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('[data-tr="play"]'))window.__clicks++},true);
  });
  const mb=await mapbox(h);
  await boot(h);
  await until(h.page,()=>window.MAIRCarModePrototype&&window.MAIRCarMenuSticky&&window.MAIRCarMap,null,15000,'car mode geladen');
  return{h,mb,page:h.page,base:{lon:LON0,lat:LAT0},async at(m,{acc=10,dy=0,jump=true}={}){
    const b=this.base;if(jump&&m!==this.last)await this.page.evaluate(ms=>{window.__skew+=ms},Math.min(60000,Math.max(1500,Math.abs(m-(this.last??0))/25*1000)));
    this.last=m;await this.h.ctx.setGeolocation({latitude:b.lat+dy/M_LAT,longitude:lonAt(m,b.lat,b.lon),accuracy:acc});await sleep(350);
  }};
}
async function startRoute(t,{stop=false}={}){
  const {page}=t;
  await page.evaluate(()=>window.MAIRCarModePrototype.open());
  await page.locator('[data-act="search"]').first().click();
  await page.fill('#carSearchInput','test');await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});await page.locator('[data-result-index="0"]').first().click();
  await page.locator('[data-act="start"]').waitFor({timeout:8000});
  if(stop){await page.locator('[data-act="addstop"]').first().click();await page.fill('#carSearchInput','stop');await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});await page.locator('[data-result-index="0"]').first().click();await page.waitForSelector('[data-act="start"]',{timeout:8000});await sleep(500)}
  await page.locator('[data-act="start"]').click();
  await until(page,()=>window.MAIRCarModePrototype.status().screen==='drive',null,8000,'rijscherm');
  t.last=0;await sleep(400);
}
const status=page=>page.evaluate(()=>window.MAIRCarModePrototype.status());
const txt=(page,sel)=>page.evaluate(s=>document.querySelector('#mairCarWaveOverlay '+s)?.textContent?.trim()||'',sel);
const has=(page,sel)=>page.evaluate(s=>!!document.querySelector('#mairCarWaveOverlay '+s),sel);
const count=(page,sel)=>page.evaluate(s=>document.querySelectorAll('#mairCarWaveOverlay '+s).length,sel);
const rect=(page,sel)=>page.evaluate(s=>{const e=document.querySelector('#mairCarWaveOverlay '+s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left,y:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}},sel);
const hit=(a,b)=>a&&b&&a.x<b.r-0.5&&b.x<a.r-0.5&&a.y<b.b-0.5&&b.y<a.b-0.5;
const kmOf=s=>{const m=/([\d.]+)\s*(km|m)\b/i.exec(s);return m?Number(m[1])*(m[2].toLowerCase()==='km'?1000:1):NaN};
const kind=page=>page.evaluate(()=>document.querySelector('#mairCarWaveOverlay .car-turn-arrow .car-arrow')?.dataset.kind||'');
const leftKm=async page=>kmOf((await txt(page,'.car-eta-card>span')).split('·').pop());
const LONG='Te Laat Voor Dit (feat. Heel Lange Artiest Naam) - Extended Radio Edit 2026';
async function longNext(page){await page.evaluate(t=>{window.jfmUpcoming=()=>[{name:t,artists:['Jairzinho','Sevn Alias','BKO','Boef']}];window.dispatchEvent(new Event('jfm:upcoming-invalidated'))},LONG);await sleep(500)}
const SIGNATURE=['.car-drive-head','.car-topbar','.car-map-slot','.car-turn-card','.car-eta-card','.car-speed-card','.car-music-bar','.car-track-progress','.car-controls [data-tr="prev"]','.car-controls [data-tr="play"]','.car-controls [data-tr="next"]'];
async function layoutChecks(t,tag){
  const {page}=t,vp=page.viewportSize();
  const ids=['.car-turn-card','.car-eta-card','.car-speed-card','.car-music-bar','.car-map-slot'];
  const r={};for(const s of ids)r[s]=await rect(page,s);
  const ex=await rect(page,'.car-nav-exit'),dist=await rect(page,'.car-turn-dist'),arrow=await rect(page,'.car-turn-arrow');
  if(ex){c.ok(`${tag}: afslag-label overlapt de afstand niet`,!hit(ex,dist),JSON.stringify({ex,dist}));c.ok(`${tag}: afslag-label zit binnen de pijlkolom`,ex.x>=arrow.x-1&&ex.r<=arrow.r+1)}
  const lane=await rect(page,'.car-lane-card');if(lane)r['.car-lane-card']=lane;
  const all=Object.entries(r).filter(([,v])=>v);
  c.ok(`${tag}: alle kaartjes blijven binnen het scherm (${vp.width}x${vp.height})`,all.length>=5&&all.every(([,x])=>x.b<=vp.height+1&&x.r<=vp.width+1&&x.y>=-1&&x.x>=-1),JSON.stringify(all));
  const bad=[];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)if(hit(all[i][1],all[j][1]))bad.push(all[i][0]+'×'+all[j][0]);
  c.ok(`${tag}: kaartjes overlappen elkaar niet`,!bad.length,bad.join(','));
  const bar=r['.car-music-bar'],sp=r['.car-speed-card'],mp=r['.car-map-slot'],top=await rect(page,'.car-topbar');
  c.ok(`${tag}: C2: bovenbalk over de hele breedte, afslag en aankomst erin`,top&&top.w>vp.width*.9&&top.b<=mp.y+1&&[r['.car-turn-card'],r['.car-eta-card']].every(x=>x.y>=top.y-1&&x.b<=top.b+1),JSON.stringify(top));
  c.ok(`${tag}: C2: kaart links, snelheid en muziek rechts, muziek onder snelheid`,mp.r<=sp.x&&mp.r<=bar.x&&sp.b<=bar.y&&vp.height-bar.b<vp.height*.06,JSON.stringify({mp,sp,bar}));
  c.ok(`${tag}: kaart groot: >=62% van de breedte en >=75% van de hoogte, rechterkolom rond 30%`,mp.w>=vp.width*.62&&mp.h>=vp.height*.75&&sp.w<=vp.width*.36&&sp.w>=vp.width*.24,JSON.stringify({mp,sp,w:vp.width}));
  c.ok(`${tag}: weinig rand: kaart begint vlak onder de bovenbalk en loopt tot vlak boven de onderkant`,mp.y-top.b<=vp.height*.04&&vp.height-mp.b<=vp.height*.04&&mp.x<=vp.width*.03,JSON.stringify({mp,top}));
  const btn=await page.evaluate(()=>[...document.querySelectorAll('#mairCarWaveOverlay .car-controls button, #mairCarWaveOverlay .car-head-actions button')].map(b=>{const q=b.getBoundingClientRect();return[Math.round(q.width),Math.round(q.height)]}));
  c.ok(`${tag}: knoppen zijn groot genoeg om in de auto te raken (>=40 px)`,btn.length===5&&btn.every(([w,hh])=>w>=40&&hh>=40),JSON.stringify(btn));
  const inBar=await page.evaluate(()=>{const b=document.querySelector('#mairCarWaveOverlay .car-music-bar').getBoundingClientRect();return[...document.querySelectorAll('#mairCarWaveOverlay .car-controls button')].every(x=>{const q=x.getBoundingClientRect();return q.left>=b.left-1&&q.right<=b.right+1&&q.bottom<=b.bottom+1})});
  c.ok(`${tag}: muziekknoppen passen in de smallere kolom`,inBar);
  c.ok(`${tag}: geen VOLGENDE / volgend nummer`,!(await has(page,'.car-next'))&&!/VOLGENDE/.test(await txt(page,'.car-drive')),await txt(page,'.car-drive'));
  const tj=await rect(page,'.mair-traffic-journey-toast');if(tj)c.ok(`${tag}: verkeersmelding valt niet over de bovenbalk`,!hit(tj,top)&&tj.x>=mp.x-1&&tj.r<=mp.r+1,JSON.stringify({tj,top}));
  const cut=await page.evaluate(()=>{const e=document.querySelector('#mairCarWaveOverlay .car-turn-text');return e?e.scrollHeight>e.clientHeight+2:false});
  c.ok(`${tag}: aanwijzingstekst past in het kaartje`,!cut);
}

// ---- scenario 1: gewone route ------------------------------------------------
async function scenarioNav(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t);
    c.ok('route gestart met één Directions-aanvraag',mb.directions===1,String(mb.directions));
    c.ok('Directions vraagt banner_instructions, steps en maxspeed-annotaties',mb.params[0]?.banner_instructions==='true'&&mb.params[0]?.steps==='true'&&/maxspeed/.test(mb.params[0]?.annotations||''),JSON.stringify(mb.params[0]));
    await longNext(page);
    const css=await page.evaluate(()=>({links:[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.getAttribute('href')).filter(h=>/car/i.test(h)),layout:getComputedStyle(document.documentElement).getPropertyValue('--car-layout').trim().replace(/"/g,'')}));
    c.ok('één Car Mode-stylesheet, statisch gelinkt, en hij hoort bij deze JS (geen mengelmoes van versies)',css.links.length===1&&/mair-car-mode-wave\.css/.test(css.links[0])&&css.layout===(await status(page)).layout,JSON.stringify(css));
    c.ok('portretstand: "Draai je iPhone"-melding blijft',await page.evaluate(()=>{const o=document.getElementById('mairCarWaveOverlay');return /Draai je iPhone/.test([...document.styleSheets].flatMap(s=>{try{return[...s.cssRules]}catch{return[]}}).map(r=>r.cssText).join(''))}));
    const sigStart=await page.evaluate(s=>s.map(x=>!!document.querySelector('#mairCarWaveOverlay '+x)),SIGNATURE);
    c.ok('rijscherm heeft de C2-onderdelen (bovenbalk met afslag en aankomst, kaartvak, snelheid, muziekblok met voortgangsbalk en knoppen)',sigStart.every(Boolean),JSON.stringify(sigStart));
    c.ok('afstand bij de rotonde: 1.5 km',(await txt(page,'.car-turn-dist'))==='1.5km',await txt(page,'.car-turn-dist'));
    c.ok('rotonde krijgt de ring-pijl met label "2e"',(await kind(page))==='roundabout'&&(await txt(page,'.car-nav-exit'))==='2e',await kind(page));
    await layoutChecks(t,'start');
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-start.png'});
    const before=mb.directions;await sleep(17000);
    c.ok('geen extra Mapbox-aanvragen in 17 s',mb.directions===before,`${before}→${mb.directions}`);
    // vlak bij de rotonde: precies dezelfde indeling (geen wisselen naar een 70/30-scherm)
    await t.at(1250);await longNext(page);
    const sigNear=await page.evaluate(s=>s.map(x=>!!document.querySelector('#mairCarWaveOverlay '+x)),SIGNATURE);
    c.ok('vlak bij een afslag: dezelfde indeling, voortgangsbalk er nog',sigNear.every(Boolean)&&!(await has(page,'.car-turn-split'))&&!(await has(page,'.car-turn-focus')),JSON.stringify(sigNear));
    await layoutChecks(t,'bij rotonde');
    // tikken en menu overleven GPS-fixes
    await page.evaluate(()=>{window.__play=document.querySelector('#mairCarWaveOverlay [data-tr="play"]');window.__img=document.querySelector('#mairCarWaveOverlay .car-artwork')});
    const pb=await rect(page,'[data-tr="play"]');
    await page.mouse.move(pb.x+pb.w/2,pb.y+pb.h/2);await page.mouse.down();
    await t.at(1300);await t.at(1310);
    await page.mouse.up();await sleep(200);
    c.ok('een tik die over GPS-fixes heen loopt komt aan',await page.evaluate(()=>window.__clicks)>=1,String(await page.evaluate(()=>window.__clicks)));
    c.ok('play-knop is hetzelfde element gebleven',await page.evaluate(()=>window.__play===document.querySelector('#mairCarWaveOverlay [data-tr="play"]')&&window.__play.isConnected));
    c.ok('hoes is niet opnieuw geladen',await page.evaluate(()=>window.__img===document.querySelector('#mairCarWaveOverlay .car-artwork')));
    await page.locator('#mairCarWaveOverlay [data-act="menu"]').first().click();await sleep(200);
    await t.at(1340);await t.at(1370);await sleep(300);
    c.ok('menu blijft open tijdens GPS-fixes',!!(await rect(page,'.car-menu')));
    await page.locator('#mairCarWaveOverlay [data-act="menuclose"]').click();
    await t.at(1480);
    c.ok('5+ m voor de rotonde: rotonde blijft staan',(await kind(page))==='roundabout',await kind(page));
    await t.at(1530);
    c.ok('op de rotonde (1530): rotonde-aanwijzing blijft staan',(await kind(page))==='roundabout',await kind(page));
    await t.at(1600);
    c.ok('na de rotonde: afrit rechts met pijl die rechtdoor gaat en uitbuigt, afstand ~23 km',(await kind(page))==='ramp-right'&&Math.abs(kmOf(await txt(page,'.car-turn-dist'))-23000)<1500,`${await kind(page)} ${await txt(page,'.car-turn-dist')}`);
    for(const m of [1650,1700,1750,1800])await t.at(m,{jump:false});
    const st=await status(page);
    c.ok('na de rotonde: route nog actief, geen "bestemming bereikt"',st.routeActive===true&&!(await page.evaluate(()=>window.__toasts)).some(x=>/Route klaar|Je bent bij/.test(x)),JSON.stringify(await page.evaluate(()=>window.__toasts)));
    const rest1=await leftKm(page);
    c.ok('resterende afstand klopt (~23.7 km na 1800 m)',Math.abs(rest1-(DEST_M-1800))<400,String(rest1));
    await t.at(5000);const r5=await leftKm(page);
    await t.at(8000);const r8=await leftKm(page);
    c.ok('resterende afstand loopt af tussen twee afslagen (5 → 8 km gereden)',r8<r5-2500&&Math.abs(r5-(DEST_M-5000))<700,`${r5} → ${r8}`);
    const e5=await txt(page,'.car-eta-card>span');await t.at(12000);const e12=await txt(page,'.car-eta-card>span');
    c.ok('resterende tijd loopt af',e5!==e12,`${e5} → ${e12}`);
    c.ok('afstand tot afrit loopt mee (13 km)',Math.abs(kmOf(await txt(page,'.car-turn-dist'))-13000)<600,await txt(page,'.car-turn-dist'));
    // GPS-nauwkeurigheid 55 m en 50 m naast de route: geen reroute
    const d0=mb.directions;
    for(let i=0;i<5;i++)await t.at(12100+i*30,{acc:55,dy:50,jump:false});
    c.ok('50 m ernaast bij 55 m nauwkeurigheid: geen herberekening',mb.directions===d0&&!(await page.evaluate(()=>window.__toasts)).some(x=>/Nieuwe route/.test(x)),`${d0}→${mb.directions}`);
    await t.at(12300,{jump:false});
    await page.evaluate(()=>{window.__skew+=26000});await page.waitForSelector('#mairCarWaveOverlay .car-gps-weak',{timeout:8000}).catch(()=>{});
    c.ok('na 20 s zonder fix: rustige "GPS-signaal zwak"',!!(await rect(page,'.car-gps-weak')));
    c.ok('GPS zwak is geen foutmelding',!(await rect(page,'.car-toast')));
    await t.at(12400,{jump:false});await sleep(300);
    c.ok('nieuwe fix: indicator weg',!(await rect(page,'.car-gps-weak')));
    mb.failNext=true;
    for(let i=0;i<3;i++){await page.evaluate(()=>{window.__skew+=3000});await t.at(12500+i*30,{dy:200,jump:false})}
    await sleep(800);
    c.ok('reroute mislukt: er was een aanvraag',mb.directions>d0);
    c.ok('reroute mislukt: wel melding, geen blijvende foutbalk',!(await rect(page,'.car-toast [data-act="dismiss"]')),'foutbalk staat er');
    c.ok('reroute mislukt: oude route blijft (afslagkaart staat)',!!(await rect(page,'.car-turn-card')));
    t.base={lon:lonAt(12400),lat:LAT0};
    let made=0;
    for(let k=0;k<3;k++){
      await page.evaluate(()=>{window.__skew+=22000});
      const x=mb.directions;
      for(let i=0;i<3;i++)await t.at(i*30,{dy:200,jump:false});
      await sleep(900);
      if(mb.directions>x)made++;
      t.base={lon:lonAt(60,t.base.lat,t.base.lon),lat:t.base.lat+200/M_LAT};
    }
    c.ok('echte afwijking (200 m): drie keer herberekend na elkaar',made===3,String(made));
    const toastsBefore=(await page.evaluate(()=>window.__toasts)).filter(x=>/wacht even/.test(x)).length;
    const d1=mb.directions;
    for(let i=0;i<5;i++){await page.evaluate(()=>{window.__skew+=22000});await t.at(30+i*30,{dy:100,jump:false})}
    await sleep(500);
    const toasts=(await page.evaluate(()=>window.__toasts)).filter(x=>/wacht even/.test(x)).length-toastsBefore;
    c.ok('kleine afwijking (100 m) na 3 gelukte reroutes: begrensd, geen nieuwe aanvraag',mb.directions===d1,`${d1}→${mb.directions}`);
    c.ok('limiet-melding komt één keer, niet bij elke fix',toasts===1,String(toasts));
    const d2=mb.directions;
    for(let i=0;i<3;i++){await page.evaluate(()=>{window.__skew+=22000});await t.at(200+i*30,{dy:400,jump:false})}
    await sleep(900);
    c.ok('echte verkeerde afslag (400 m): geen 5 minuten zonder route',mb.directions>d2,`${d2}→${mb.directions}`);
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
    c.ok('geen CSP-fouten',h.log.csp.length===0,h.log.csp.join('|'));
  }finally{await h.close()}
}

// ---- scenario 2: snelheid, maximumsnelheid, rijstroken, pijlen --------------
async function scenarioArrows(){
  const t=await setup(),{page,h,mb}=t;
  try{
    // alle manoeuvre-combinaties: de omkeerpijl komt alleen bij een echte u-turn
    const grid=await page.evaluate(()=>{const f=window.MAIRCarModePrototype.maneuverKind,types=['turn','new name','depart','arrive','merge','on ramp','off ramp','fork','end of road','continue','roundabout','rotary','roundabout turn','exit roundabout','exit rotary','notification',''],mods=['uturn','sharp right','right','slight right','straight','slight left','left','sharp left',undefined,''],out=[];for(const ty of types)for(const mo of mods)out.push([ty,mo??'',f(ty,mo)]);return out});
    const known=new Set(['straight','left','right','slight-left','slight-right','sharp-left','sharp-right','ramp-left','ramp-right','uturn','roundabout','arrive']);
    c.ok(`manoeuvre-mapping: alle ${grid.length} combinaties geven een bekende pijl`,grid.every(g=>known.has(g[2])),JSON.stringify(grid.filter(g=>!known.has(g[2]))));
    c.ok('omkeerpijl alleen bij modifier "uturn" (en nooit bij rotonde of aankomst)',grid.every(g=>(g[2]==='uturn')===(g[1]==='uturn'&&!/^(roundabout|rotary|roundabout turn|arrive)$/.test(g[0]))),JSON.stringify(grid.filter(g=>(g[2]==='uturn')!==(g[1]==='uturn'&&!/^(roundabout|rotary|roundabout turn|arrive)$/.test(g[0])))));
    const get=(ty,mo)=>grid.find(g=>g[0]===ty&&g[1]===(mo??''))?.[2];
    c.ok('afrit/splitsing links en rechts: pijl rechtdoor met uitbuiging',['slight left','left','sharp left'].every(m=>get('off ramp',m)==='ramp-left'&&get('fork',m)==='ramp-left')&&['slight right','right','sharp right'].every(m=>get('off ramp',m)==='ramp-right'&&get('fork',m)==='ramp-right'));
    c.ok('gewone bochten: links/rechts/scherp/licht, rechtdoor, aankomst, rotondes',get('turn','left')==='left'&&get('turn','right')==='right'&&get('turn','sharp left')==='sharp-left'&&get('turn','slight right')==='slight-right'&&get('turn','straight')==='straight'&&get('end of road','right')==='right'&&get('arrive','')==='arrive'&&['roundabout','rotary','roundabout turn'].every(ty=>get(ty,'right')==='roundabout'));
    c.ok('invoegen/oprit/doorrijden: altijd een lichte bocht, nooit hard, scherp of omkeerpijl',['merge','on ramp','continue','new name','depart'].every(ty=>['sharp left','left','slight left'].every(m=>get(ty,m)==='slight-left')&&['sharp right','right','slight right'].every(m=>get(ty,m)==='slight-right')));
    await startRoute(t);
    // snelheid
    await t.at(2000);
    await page.evaluate(()=>{window.__speed=null});await t.at(2010,{jump:false});
    c.ok('geen snelheid (coords.speed = null): "--"',(await txt(page,'.car-speed'))==='--',await txt(page,'.car-speed'));
    await page.evaluate(()=>{window.__speed=27.78});await t.at(2020,{jump:false});await sleep(300);
    c.ok('coords.speed 27,78 m/s: 100 km/u',(await txt(page,'.car-speed'))==='100',await txt(page,'.car-speed'));
    await page.evaluate(()=>{window.__speed=0});await t.at(2030,{jump:false});await sleep(300);
    const half=Number(await txt(page,'.car-speed'));
    c.ok('snelheid licht afgevlakt: 100 → 0 geeft eerst een tussenwaarde (50)',half===50,String(half));
    for(let i=1;i<=8;i++)await t.at(2030+i*2,{jump:false});
    c.ok('stilstaan (0 m/s): na een paar fixes 0 km/u, geen "--"',(await txt(page,'.car-speed'))==='0',await txt(page,'.car-speed'));
    await page.evaluate(()=>{window.__speed=36.1});for(let i=1;i<=9;i++)await t.at(2050+i*2,{jump:false});await sleep(300);
    c.ok('36,1 m/s: 130 km/u afgerond',(await txt(page,'.car-speed'))==='130',await txt(page,'.car-speed'));
    // maximumsnelheid
    c.ok('bordje met maximumsnelheid 100 (route 0-5 km)',(await txt(page,'.car-limit'))==='100',await txt(page,'.car-limit'));
    c.ok('te hard rijden kleurt de snelheid rood (130 op 100)',await page.evaluate(()=>!!document.querySelector('#mairCarWaveOverlay .car-speed.over')));
    await page.evaluate(()=>{window.__skew+=6000;window.__speed=11.11});await t.at(2080,{jump:false});
    c.ok('na een gat van >5 s geen naijlen: meteen 40 km/u',(await txt(page,'.car-speed'))==='40',await txt(page,'.car-speed'));
    await page.evaluate(()=>{window.__speed=27.78});
    await t.at(6000);await sleep(300);
    c.ok('bordje 130 op het volgende stuk',(await txt(page,'.car-limit'))==='130',await txt(page,'.car-limit'));
    await t.at(8500);await sleep(300);
    c.ok('onbekende maximumsnelheid: bordje verborgen',!(await has(page,'.car-limit')));
    await t.at(9500);await sleep(300);
    c.ok('daarna 80',(await txt(page,'.car-limit'))==='80',await txt(page,'.car-limit'));
    // rijstroken
    for(const m of [14000,19000])await t.at(m);
    await t.at(22000);await sleep(300);
    c.ok('ver voor de afrit (3 km): geen rijstrokenkaartje',!(await has(page,'.car-lane-card')));
    await t.at(24500);await sleep(400);
    c.ok('800 m voor de afrit: afrit-pijl met uitbuiging',(await kind(page))==='ramp-right',await kind(page));
    c.ok('rijstrokenkaartje met 4 banen',(await count(page,'.car-lane'))===4,String(await count(page,'.car-lane')));
    c.ok('precies één actieve baan (baan 2)',await page.evaluate(()=>{const l=[...document.querySelectorAll('#mairCarWaveOverlay .car-lane')];return l.filter(x=>x.classList.contains('active')).length===1&&l[1].classList.contains('active')}));
    c.ok('rijstroken tonen de richtingen (baan 2: 2 pijlen, baan 1: 1 pijl)',await page.evaluate(()=>{const l=[...document.querySelectorAll('#mairCarWaveOverlay .car-lane')];return l[1].querySelectorAll('g').length===2&&l[0].querySelectorAll('g').length===1}));
    c.ok('kaartje noemt wegnummer en afslag (A27, Afslag 16)',(await txt(page,'.car-lane-chip'))==='A27'&&/Afslag 16/.test(await txt(page,'.car-lane-head b')),await txt(page,'.car-lane-card'));
    await layoutChecks(t,'rijstroken');await sleep(1500);
    const pp=await page.evaluate(()=>({proj:window.MAIRCarMap.project(5+24500/68537,52),puck:window.MAIRCarMap.puckAt()}));
    c.ok('positiepijl staat precies op de plek van de auto op de kaart (en de route loopt eronder door)',pp.proj&&pp.puck&&Math.abs(pp.proj.x-pp.puck.x)<4&&Math.abs(pp.proj.y-pp.puck.y)<4,JSON.stringify(pp));
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-rijstroken.png'});
    await t.at(25200);await sleep(400);
    c.ok('na de afrit: kaartje weg, aankomst-pijl',!(await has(page,'.car-lane-card'))&&(await kind(page))==='arrive',await kind(page));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 3: route zonder annotaties / banners --------------------------
async function scenarioBare(){
  const t=await setup(),{page,h,mb}=t;
  try{
    mb.annotate=false;
    await startRoute(t);await t.at(3000);
    await page.evaluate(()=>{window.__speed=20});await t.at(3010,{jump:false});await sleep(300);
    c.ok('zonder maxspeed in de route: geen bordje, wel snelheid',!(await has(page,'.car-limit'))&&(await txt(page,'.car-speed'))==='72',await txt(page,'.car-speed'));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 4: de kaart ---------------------------------------------------
async function scenarioMap(){
  const t=await setup(),{page,h,mb}=t;
  try{
    c.ok('kaart nog niet geladen vóór een route',!(await page.evaluate(()=>window.mapboxgl))&&mb.styleReq===0);
    await startRoute(t);
    await until(page,()=>window.MAIRCarMap.status().ready,null,25000,'kaart klaar').catch(e=>{console.log('kaart niet klaar: '+e.message.slice(0,200))});
    let ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('kaart is geladen (echte Mapbox GL JS, WebGL)',ms.created&&ms.ready&&!ms.failed,JSON.stringify(ms));
    c.ok('donkere navigatiestijl gevraagd (navigation-night)',/navigation-night/.test(mb.styleUrl||''),mb.styleUrl);
    c.ok('route staat als lijn op de kaart',ms.hasRoute);
    const navMap=await page.evaluate(()=>{const o=document.getElementById('mairCarWaveOverlay'),r=document.getElementById('carMap').getBoundingClientRect(),q=o.querySelector('.car-map-slot').getBoundingClientRect();return{has:o.classList.contains('has-map'),x:r.left,y:r.top,w:r.width,h:r.height,sx:q.left,sy:q.top,sw:q.width,sh:q.height}});
    c.ok('overlay krijgt .has-map en de kaart staat links in het kaartvak onder de bovenbalk',navMap.has&&Math.abs(navMap.x-navMap.sx)<1&&Math.abs(navMap.y-navMap.sy)<1&&Math.abs(navMap.w-navMap.sw)<1&&navMap.w>=page.viewportSize().width*.62&&navMap.w<page.viewportSize().width*.75&&navMap.y>page.viewportSize().height*.15,JSON.stringify(navMap));
    // kaart en rechterkolom naast elkaar: geen kaartcanvas onder de panelen, ook als de overlay smaller is dan 100vw (iOS-app)
    const side=()=>page.evaluate(()=>{const o=document.getElementById('mairCarWaveOverlay'),cv=o.querySelector('#carMap canvas.mapboxgl-canvas').getBoundingClientRect(),m=document.getElementById('carMap').getBoundingClientRect(),cols=[...o.querySelectorAll('.car-drive-head,.car-speed-card,.car-music-bar')].map(e=>e.getBoundingClientRect()).filter(r=>r.width),colL=Math.min(...cols.map(r=>r.left)),hits=cols.flatMap(r=>[[r.left+4,r.top+r.height/2],[r.left+r.width/2,r.top+r.height/2],[r.right-4,r.top+4]]).map(([x,y])=>document.elementFromPoint(x,y)).filter(e=>e&&e.closest('#carMap')).length;return{mapR:m.right,cvR:cv.right,colL,hits}});
    let sd=await side();
    c.ok('kaart en kaartcanvas stoppen voor de rechterkolom, niets van de kaart onder de panelen',sd.mapR<=sd.colL&&sd.cvR<=sd.colL+1&&sd.hits===0,JSON.stringify(sd));
    await page.evaluate(()=>{document.getElementById('mairCarWaveOverlay').style.cssText='left:60px;right:60px'});await sleep(800);
    sd=await side();
    c.ok('overlay smaller dan 100vw (iOS-app): kaart wordt mee smaller en blijft naast de kolom',sd.mapR<=sd.colL&&sd.cvR<=sd.colL+1&&sd.hits===0,JSON.stringify(sd));
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-ios-app.png'});
    await page.evaluate(()=>{document.getElementById('mairCarWaveOverlay').style.cssText=''});await sleep(500);
    const lay=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('route is een eigen dikke lijn met rand en gloed op de kaart',lay.routeLayers===4,JSON.stringify(lay));
    await t.at(2000);await t.at(2050,{jump:false});await sleep(1500);
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('kaart draait mee met de rijrichting (oosten ≈ 90°)',ms.bearing!=null&&Math.abs(ms.bearing-90)<8,String(ms.bearing));
    const ctr=await page.evaluate(()=>{const m=document.querySelector('.mapboxgl-canvas');return m?{w:m.width,h:m.height}:null});
    c.ok('kaart geladen met pitch (3D-blik) en zoom naar snelheid',ms.zoom>14&&ms.zoom<17,String(ms.zoom));
    c.ok('exact één kaartlading en één stijlaanvraag',ms.loads===1&&mb.styleReq===1,`${ms.loads}/${mb.styleReq}`);
    // reroute: kaart blijft, route-laag wordt bijgewerkt, geen nieuwe lading
    const d0=mb.directions;
    await page.evaluate(()=>{window.__skew+=22000});
    for(let i=0;i<3;i++)await t.at(2100+i*30,{dy:200,jump:false});
    await sleep(1200);
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('na een reroute: nog steeds één kaartlading',mb.directions>d0&&ms.loads===1&&mb.styleReq===1,`${d0}→${mb.directions} loads=${ms.loads}`);
    // menu → verder zonder route: kaart verborgen, niet verwijderd
    await page.evaluate(()=>document.querySelector('#mairCarWaveOverlay [data-act="menu"]').click());await sleep(200);
    await page.locator('#mairCarWaveOverlay .car-menu [data-act="music"]').click();await sleep(500);
    await sleep(800);
    const free=await page.evaluate(()=>{const o=document.getElementById('mairCarWaveOverlay'),r=document.getElementById('carMap').getBoundingClientRect();return{has:o.classList.contains('has-map'),top:!!o.querySelector('.car-topbar'),find:!!o.querySelector('.car-find'),y:r.top,h:r.height,route:window.MAIRCarMap.status().hasRoute}});
    c.ok('zonder bestemming: kaart blijft, bovenbalk weg, kaart hoger, geen routelijn',free.has&&!free.top&&free.y<navMap.y-40&&free.h>navMap.h+40&&!free.route,JSON.stringify(free));
    c.ok('zonder bestemming: kleine zoekknop, snelheid en muziekblok rechts',free.find&&await has(page,'.car-speed-card')&&await has(page,'.car-music-bar')&&await has(page,'.car-track-progress'));
    await page.locator('#mairCarWaveOverlay .car-find').click();
    c.ok('zoekknop opent het zoekveld',await page.locator('#carSearchInput').isVisible());
    await page.locator('#mairCarWaveOverlay [data-act="music"]').click();await sleep(1500);
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-zonder-bestemming.png'});
    // Car Mode dicht = kaart opgeruimd; nieuwe sessie = nieuwe lading (één per sessie)
    await page.evaluate(()=>window.MAIRCarModePrototype.close());await sleep(300);
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('Car Mode dicht: kaart opgeruimd',!ms.created&&!ms.ready,JSON.stringify(ms));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
    c.ok('geen CSP-fouten',h.log.csp.length===0,h.log.csp.join('|'));
  }finally{await h.close()}
}

// ---- scenario 5: tussenstop, aankomst ---------------------------------------
async function scenarioStops(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t,{stop:true});
    let st=await status(page);
    c.ok('tussenstop staat in de route',st.stops.length===1,JSON.stringify(st.stops));
    c.ok('aankomstkaartje toont de tussenstop met naam en afstand',/Tussenstop A/.test(await txt(page,'.car-stop-line'))&&/km/.test(await txt(page,'.car-stop-line')),await txt(page,'.car-eta-card'));
    c.ok('aankomsttijd en totaal staan bovenaan',/^\d\d:\d\d$/.test(await txt(page,'.car-eta'))&&/min|u/.test(await txt(page,'.car-eta-card>span')),await txt(page,'.car-eta-card'));
    const stopLeft=kmOf((await txt(page,'.car-stop-line')).split('·')[1]);
    c.ok('afstand tot stop klopt (~10 km)',Math.abs(stopLeft-STOP_M)<500,String(stopLeft));
    for(const m of [3000,6000,9000])await t.at(m);
    st=await status(page);
    c.ok('onderweg naar de stop: stop en route intact, niet aangekomen',st.stops.length===1&&st.routeActive,JSON.stringify(st.stops));
    const d0=mb.directions;
    for(let i=0;i<3;i++)await t.at(9970+i*5,{jump:i===0});
    await sleep(1200);
    st=await status(page);
    c.ok('aangekomen bij de stop: stop weg, route loopt door',st.stops.length===0&&st.routeActive===true,JSON.stringify(st.stops));
    c.ok('route opnieuw berekend na de stop (één aanvraag)',mb.directions===d0+1,`${d0}→${mb.directions}`);
    c.ok('melding bij de stop',(await page.evaluate(()=>window.__toasts)).some(x=>/Je bent bij Tussenstop A/.test(x)));
    for(const m of [13000,17000,21000,24000])await t.at(m);
    c.ok('1,5 km voor de bestemming: nog niet aangekomen',(await status(page)).routeActive===true);
    await t.at(24985);
    c.ok('15 m voor de afrit: afrit-aanwijzing blijft',(await kind(page))==='ramp-right',await kind(page));
    await t.at(25010,{jump:false});
    c.ok('10 m na de afrit: volgende aanwijzing (aankomst)',(await kind(page))==='arrive',await kind(page));
    c.ok('15 m voor/na de afrit: nog geen aankomst',(await status(page)).routeActive===true);
    for(let i=0;i<4;i++)await t.at(DEST_M-120+i*20,{jump:i===0});
    await sleep(600);
    st=await status(page);
    c.ok('bij de bestemming: route klaar',st.routeActive===false,JSON.stringify(st));
    c.ok('melding "Route klaar"',(await page.evaluate(()=>window.__toasts)).some(x=>/Route klaar/.test(x)));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 6: gelijktijdige route-aanvragen ------------------------------
async function scenarioConcurrent(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t);
    await t.at(2000);
    mb.delayNext=3000;
    for(let i=0;i<3;i++){await page.evaluate(()=>{window.__skew+=3000});await t.at(2000+i*30,{dy:200,jump:false})}
    await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-act="menu"]').first().click();
    await page.locator('#mairCarWaveOverlay [data-act="addstop"]').first().click();
    await page.fill('#carSearchInput','stop');await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});
    await page.locator('[data-result-index="0"]').first().click();
    await sleep(4500);
    const toasts=await page.evaluate(()=>window.__toasts);
    c.ok('ingehaalde reroute meldt geen "Nieuwe route berekend"',!toasts.some(x=>/Nieuwe route berekend/.test(x)),JSON.stringify(toasts));
    const st=await status(page);
    c.ok('na de tussenstop: rijscherm met stop in de route',st.screen==='drive'&&st.stops.length===1,JSON.stringify({s:st.screen,stops:st.stops.length}));
    c.ok('geen foutbalk',!(await rect(page,'.car-toast [data-act="dismiss"]')));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 7: andere schermformaten (alleen layout) ----------------------
async function scenarioSizes(){
  for(const [w,hh] of [[844,390],[932,430],[667,375]]){
    const t=await setup({width:w,height:hh}),{page,h}=t;
    try{
      await startRoute(t);await longNext(page);
      await page.evaluate(()=>{window.__speed=27.78});for(const m of [5000,10000,15000,20000,24500])await t.at(m);await sleep(500);
      await layoutChecks(t,`C2 ${w}x${hh}`);await sleep(1500);
      if(outDir)await page.screenshot({path:`${outDir}/carmode-c2-${w}x${hh}.png`});
    }finally{await h.close()}
  }
}


// ---- scenario 8: lagen, melding, wegschuiven, zwarte kaart --------------------
async function scenarioMap2(){
  const t=await setup(),{page,h,mb}=t;
  try{
    mb.failTiles=true;
    await startRoute(t);
    await until(page,()=>window.MAIRCarMap.status().ready,null,25000,'kaart klaar');
    await sleep(800);mb.failTiles=false;
    // route boven alle wegen, ook bruggen; alleen labels erboven
    const L=(await page.evaluate(()=>window.MAIRCarMap.status())).layers,ix=id=>L.indexOf(id);
    c.ok('route ligt boven alle weg- en bruglagen (ook na een vroege symbol-laag), labels erboven',ix('car-route-done')>ix('bridge-street')&&ix('car-route-line')>ix('bridge-street')&&ix('car-route-line')<ix('road-label')&&ix('oneway-arrows')<ix('car-route-done'),JSON.stringify(L));
    // melding: bovenop en zichtbaar in de kaart, niet achter de muziek
    await page.evaluate(()=>window.MAIRCarModePrototype.toast('Je bent bij Susu Harmelen. Route klaar.'));await sleep(200);
    const vis=await page.evaluate(()=>{const e=document.querySelector('#mairCarWaveOverlay>.car-toast');if(!e)return null;const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),bar=document.querySelector('#mairCarWaveOverlay .car-music-bar').getBoundingClientRect(),map=document.querySelector('#mairCarWaveOverlay .car-map-slot').getBoundingClientRect();const z=x=>Number(getComputedStyle(x).zIndex)||0;return{on:!!top?.closest('.car-toast')&&z(e)>z(document.getElementById('carScreen')),inMap:r.left>=map.left&&r.right<=map.right&&r.top>=map.top&&r.bottom<=map.bottom,overBar:!(r.right<bar.left||r.left>bar.right||r.bottom<bar.top||r.top>bar.bottom)}});
    c.ok('melding staat bovenop (niet achter het scherm), in de kaart en niet achter de muziek',!!vis&&vis.on&&vis.inMap&&!vis.overBar,JSON.stringify(vis));
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-melding.png'});
    // autopijl vast midden onder
    await t.at(2000);await t.at(2050,{jump:false});await sleep(1500);
    const pk=await page.evaluate(()=>{const p=window.MAIRCarMap.puckAt(),m=document.getElementById('carMap');return{x:p.x/m.clientWidth,y:p.y/m.clientHeight}});
    c.ok('autopijl staat vast midden onder in de kaart (x 50%, y ~75%)',Math.abs(pk.x-.5)<.02&&pk.y>.7&&pk.y<.8,JSON.stringify(pk));
    const carAt=()=>page.evaluate(()=>{const st=window.MAIRCarModePrototype.status().display,p=st&&window.MAIRCarMap.project(st.longitude,st.latitude),q=window.MAIRCarMap.puckAt();return p&&q?Math.round(Math.hypot(p.x-q.x,p.y-q.y)):999});
    c.ok('kaart volgt: de auto staat onder de pijl',(await carAt())<5,String(await carAt()));
    // wegschuiven, knop Terug, vanzelf terug. Weggeschoven staat de pijl op de auto zelf, dus meten hoe ver de auto van zijn volgplek (midden, 75%) is
    const carOff=()=>page.evaluate(()=>{const st=window.MAIRCarModePrototype.status().display,p=window.MAIRCarMap.project(st.longitude,st.latitude),m=document.getElementById('carMap');return Math.round(Math.hypot(p.x-m.clientWidth/2,p.y-m.clientHeight*.75))});
    const mr=await rect(page,'.car-map-slot'),drag=async dx=>{await page.mouse.move(mr.x+mr.w/2,mr.y+mr.h/2);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(mr.x+mr.w/2+i*dx,mr.y+mr.h/2-i*8);await page.mouse.up();await sleep(400)};
    await drag(15);
    let ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('kaart wegschuiven kan (vegen komt door het scherm heen bij de kaart)',ms.free&&(await carOff())>40,JSON.stringify({free:ms.free,d:await carOff()}));
    c.ok('weggeschoven: pijl schuift mee en staat op de echte positie',(await carAt())<5,String(await carAt()));
    c.ok('na wegschuiven: knop "Terug" zichtbaar',await page.locator('#carMap .car-map-back').isVisible());
    if(outDir)await page.screenshot({path:outDir+'/carmode-c2-terug.png'});
    await t.at(2100,{jump:false});await sleep(600);
    c.ok('weggeschoven: een nieuwe GPS-fix trekt de kaart niet meteen terug, pijl gaat mee naar de nieuwe plek',(await carOff())>40&&(await carAt())<5,`${await carOff()} ${await carAt()}`);
    await page.locator('#carMap .car-map-back').click();await sleep(1500);
    c.ok('knop Terug: kaart meteen terug op de auto, knop weg',!(await page.evaluate(()=>window.MAIRCarMap.status().free))&&(await carAt())<5&&!(await page.locator('#carMap .car-map-back').isVisible()),String(await carAt()));
    await drag(-15);await sleep(2600);
    c.ok('na 3 s nog weggeschoven',await page.evaluate(()=>window.MAIRCarMap.status().free));
    await sleep(5000);
    c.ok('na een paar seconden gaat de kaart vanzelf terug naar de auto',!(await page.evaluate(()=>window.MAIRCarMap.status().free))&&(await carAt())<5,String(await carAt()));
    // tegels die wegvielen komen terug
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('mislukte tegels: kaart haalt ze vanzelf opnieuw op',mb.tiles.fail>0&&ms.tileReloads>=1&&mb.tiles.ok>0&&ms.tilesLoaded===true,JSON.stringify({tiles:mb.tiles,r:ms.tileReloads,l:ms.tilesLoaded}));
    // WebGL-context kwijt (iOS in de achtergrond)
    const lose=restore=>page.evaluate(r=>{const g=document.querySelector('#carMap canvas.mapboxgl-canvas').getContext('webgl2'),x=g.getExtension('WEBGL_lose_context');x.loseContext();if(r)setTimeout(()=>x.restoreContext(),300)},restore);
    await lose(true);await sleep(4500);
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('context even kwijt en terug: kaart herstelt zelf, niet opnieuw opgebouwd',ms.ready&&!ms.lost&&ms.rebuilds===0&&ms.loads===1,JSON.stringify({...ms,layers:0}));
    await lose(false);
    await until(page,()=>{const m=window.MAIRCarMap.status();return m.rebuilds===1&&m.ready&&m.routeLayers===4},null,15000,'kaart opnieuw').catch(()=>{});
    ms=await page.evaluate(()=>window.MAIRCarMap.status());
    c.ok('context kwijt en niet terug (zwarte kaart): kaart bouwt zichzelf opnieuw op, met de route',ms.rebuilds===1&&ms.ready&&ms.loads===2&&ms.routeLayers===4&&ms.hasRoute,JSON.stringify({...ms,layers:0}));
    await t.at(2200,{jump:false});await sleep(1500);
    c.ok('na herstel: pijl en kaart volgen weer',(await carAt())<5,String(await carAt()));
    // iOS-app: de webview laat de zijkanten al vrij, dan geen tweede veilige rand
    const inset=await page.evaluate(()=>{Object.defineProperty(screen,'width',{get:()=>innerWidth+120,configurable:true});window.MAIRCarModePrototype.render();return document.getElementById('mairCarWaveOverlay').classList.contains('car-inset')});
    c.ok('venster smaller dan het scherm (iOS-app): geen dubbele zijranden',inset);
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 9: zoeken op naam ---------------------------------------------
async function scenarioSearch(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await page.evaluate(()=>window.MAIRCarModePrototype.open());
    await page.locator('[data-act="search"]').first().click();
    await until(page,()=>window.MAIRCarModePrototype.status().hasPosition,null,8000,'positie');
    const find=async q=>{await page.fill('#carSearchInput','');await page.fill('#carSearchInput',q);await page.locator('#carSearchResults [data-result-index]').first().waitFor({timeout:8000}).catch(()=>{});await sleep(300);return page.evaluate(()=>[...document.querySelectorAll('#carSearchResults [data-result-index]')].map(b=>b.textContent))};
    c.ok('zoekveld vraagt om een plek, winkel of adres',/Plek/.test(await page.getAttribute('#carSearchInput','placeholder')));
    let r=await find('Albert Heijn');
    c.ok('keten: dichtbij eerst, dubbele eruit (Dichtbij, Vleuten, Amsterdam)',r.length===3&&/Dichtbij/.test(r[0])&&/Vleuten/.test(r[1])&&/Amsterdam/.test(r[2]),JSON.stringify(r));
    c.ok('resultaat toont de afstand',/2\.0 km/.test(r[0]),r[0]);
    if(outDir)await page.screenshot({path:outDir+'/carmode-zoeken-albert-heijn.png'});
    const ah=mb.box.filter(x=>/albert/i.test(x.q));
    const bb=(ah.find(x=>x.bbox)?.bbox||'').split(',').map(Number);
    c.ok('Search Box: één aanvraag met proximity en één binnen ~20 km (bbox)',ah.some(x=>x.prox&&!x.bbox)&&bb.length===4&&Math.abs((bb[3]-bb[1])/2*110.54-20)<2&&Math.abs((bb[2]-bb[0])/2*MX(LAT0)/1000-20)<2,JSON.stringify(ah));
    r=await find('Susu Harmelen');
    c.ok('plek op naam: Susu Harmelen gevonden',/Asian Fusion Susu Harmelen/.test(r[0]||''),JSON.stringify(r));
    r=await find('Kerkstraat 1');
    c.ok('Search Box vindt niets: Geocode v6 als terugval (adres)',/Kerkstraat 1/.test(r[0]||'')&&mb.geocode.some(q=>/kerkstraat/i.test(q)),JSON.stringify(r));
    mb.failBox=true;r=await find('test');mb.failBox=false;
    c.ok('Search Box stuk: Geocode v6 als terugval',/Testbestemming/.test(r[0]||''),JSON.stringify(r));
    await find('Susu Harmelen');await page.locator('[data-result-index="0"]').first().click();
    await page.locator('[data-act="start"]').waitFor({timeout:8000});
    c.ok('gekozen plek wordt de bestemming',/Susu/.test((await status(page)).destination?.name||''));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 10: rechtop typen ---------------------------------------------
async function scenarioPortrait(){
  const t=await setup({width:390,height:844}),{page,h}=t;
  try{
    await page.evaluate(()=>window.MAIRCarModePrototype.open());await sleep(300);
    const after=()=>page.evaluate(()=>getComputedStyle(document.getElementById('mairCarWaveOverlay'),'::after').content);
    c.ok('rechtop: startscherm te gebruiken (geen draai-melding ervoor)',(await after())==='none'&&await page.locator('[data-act="search"]').first().isVisible(),await after());
    await page.locator('[data-act="search"]').first().click();await sleep(200);
    c.ok('rechtop: zoekscherm niet afgedekt',(await after())==='none',await after());
    c.ok('rechtop: invoerveld zichtbaar en bovenop',await page.evaluate(()=>{const i=document.getElementById('carSearchInput'),r=i.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===i&&r.top>=0&&r.bottom<=innerHeight}));
    await page.locator('#carSearchInput').click();await page.keyboard.type('Susu Harmelen');
    await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});
    c.ok('rechtop: typen werkt en geeft resultaten',/Susu/.test(await txt(page,'#carSearchResults')));
    c.ok('rechtop: resultaten in één kolom over de breedte',await page.evaluate(()=>{const b=document.querySelector('#carSearchResults [data-result-index]').getBoundingClientRect();return b.right<=innerWidth+1&&b.width>innerWidth*.6}));
    if(outDir)await page.screenshot({path:outDir+'/carmode-rechtop-zoeken.png'});
    await page.locator('[data-result-index="0"]').first().click();await page.locator('[data-act="start"]').waitFor({timeout:8000});
    c.ok('rechtop: routekeuze ook te gebruiken',(await after())==='none'&&await page.locator('[data-act="start"]').isVisible());
    await page.locator('[data-act="start"]').click();await sleep(400);
    c.ok('rechtop: rijscherm vraagt om te draaien',/Draai je iPhone/.test(await after()),await after());
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 11: GPS vastzetten op de weg ----------------------------------
async function scenarioSnap(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t);
    await t.at(2000,{dy:25});await sleep(300);
    let d=(await status(page)).display;
    c.ok('met route: fix 25 m naast de weg, pijl staat op de route',d?.src==='route'&&Math.abs((d.latitude-LAT0)*M_LAT)<1.5,JSON.stringify(d));
    await page.evaluate(()=>{window.__skew+=3000});await t.at(2050,{dy:120,jump:false});
    d=(await status(page)).display;
    c.ok('met route: echt van de route af (120 m), dan de GPS-positie',d?.src==='gps'&&Math.abs((d.latitude-LAT0)*M_LAT-120)<3,JSON.stringify(d));
    // zonder route: Map Matching
    await page.evaluate(()=>document.querySelector('#mairCarWaveOverlay [data-act="menu"]').click());await sleep(200);
    await page.locator('#mairCarWaveOverlay .car-menu [data-act="music"]').click();await sleep(300);
    for(const m of [2100,2130,2160,2190,2220,2250])await t.at(m,{dy:20});
    await until(page,()=>window.MAIRCarModePrototype.status().display?.src==='match',null,8000,'match').catch(()=>{});
    d=(await status(page)).display;
    c.ok('zonder route: Map Matching zet de pijl op de weg',d?.src==='match'&&Math.abs((d.latitude-LAT0)*M_LAT)<1.5,JSON.stringify(d));
    c.ok('Map Matching vraagt maxspeed, radiuses en timestamps',mb.matching.length>=1&&/maxspeed/.test(mb.matching[0].annotations||'')&&!!mb.matching[0].radiuses&&!!mb.matching[0].timestamps,JSON.stringify(mb.matching[0]));
    await sleep(300);
    c.ok('zonder route: bordje maximumsnelheid uit Map Matching (50)',(await txt(page,'.car-limit'))==='50',await txt(page,'.car-limit'));
    if(outDir){await sleep(1200);await page.screenshot({path:outDir+'/carmode-zonder-route-bordje.png'})}
    await sleep(1200);
    const mbear=(await status(page)).map?.bearing;
    c.ok('zonder route: kaart draait mee in de rijrichting (oosten ≈ 90°)',mbear!=null&&Math.abs(mbear-90)<8,String(mbear));
    const n=mb.matching.length;for(const m of [2251,2252,2253,2254])await t.at(m,{dy:20,jump:false});
    c.ok('Map Matching niet bij elke fix (hooguit eens per 4 s)',mb.matching.length<=n+1,`${n}→${mb.matching.length}`);
    // afvlakken: geen match, wel snelheid en richting
    mb.failMatch=true;await page.evaluate(()=>{window.__skew+=20000;window.__speed=20;window.__heading=90});
    for(let i=0;i<4;i++)await t.at(2300+i*7,{acc:25,jump:false});
    await t.at(2330,{acc:25,dy:30,jump:false});
    d=(await status(page)).display;const off=d?(d.latitude-LAT0)*M_LAT:NaN;
    c.ok('losse GPS-sprong van 30 m opzij: pijl gaat maar een stuk mee',d?.src==='gps'&&off>3&&off<20,JSON.stringify({off,d}));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// REAL_MM_TOKEN=<token>: echte Map Matching en een echte weg (A12 bij Utrecht, ~25 m tussen de fixes, 25 m/s). Alleen handmatig.
async function realRoad(){
  const tk=process.env.REAL_MM_TOKEN;if(!tk)return null;
  const d=await (await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/4.9210,52.0850;5.0900,52.0900?access_token=${tk}&geometries=geojson&overview=full`)).json();
  const g=d.routes[0].geometry.coordinates,out=[],R=6371000,hv=(a,b)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(b[1]-a[1])/2)**2+Math.cos(r(a[1]))*Math.cos(r(b[1]))*Math.sin(r(b[0]-a[0])/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  let acc=0,next=6000;for(let i=1;i<g.length&&out.length<14;i++){const l=hv(g[i-1],g[i]);while(acc+l>=next&&out.length<14){const u=(next-acc)/l;out.push([g[i-1][0]+(g[i][0]-g[i-1][0])*u,g[i-1][1]+(g[i][1]-g[i-1][1])*u]);next+=25}acc+=l}
  return out;
}
// ---- scenario 12: rijden zonder bestemming, bordje maximumsnelheid --------------
// Verse start (nooit een route gehad): Car Mode open, "Start zonder route", ~1 fix per seconde met snelheid langs de weg.
async function scenarioNoRoute(){
  const t=await setup(),{page,h,mb}=t;
  const lim=()=>txt(page,'.car-limit');
  const ride=async(from,n)=>{for(let m=from;m<from+n*25;m+=25){await t.at(m,{acc:6,jump:false});await page.evaluate(()=>{window.__skew+=1000})}};
  try{
    const road=await realRoad();
    if(road)await t.h.ctx.setGeolocation({latitude:road[0][1],longitude:road[0][0],accuracy:6});
    await page.evaluate(()=>window.MAIRCarModePrototype.open());await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-act="music"]').first().click();await sleep(300);
    await page.evaluate(()=>{window.__speed=25;window.__heading=90});
    if(road){for(const p of road){await t.h.ctx.setGeolocation({latitude:p[1],longitude:p[0],accuracy:6});await sleep(350);await page.evaluate(()=>{window.__skew+=1000})}}
    else await ride(1000,12);
    await until(page,()=>window.MAIRCarModePrototype.status().limit!=null,null,6000,'limit').catch(()=>{});
    let st=await status(page);
    c.ok('zonder route (verse start): Map Matching wordt aangeroepen en het bordje toont een getal',mb.matching.length>=1&&/^\d+$/.test(await lim()),`limit=${st.limit} matches=${st.matches} screen=${st.screen} requests=${mb.matching.length}`);
    if(outDir)await page.screenshot({path:outDir+'/carmode-noroute.png'});
    c.ok('Map Matching gaf het bordje: OpenStreetMap niet gevraagd',mb.overpass.length===0,String(mb.overpass.length));
    if(!road){
    // Map Matching geeft niets (geen match): het bordje komt dan van OpenStreetMap, van de dichtstbijzijnde weg (80, niet het lokaas 30)
    mb.failMatch=true;await page.evaluate(()=>{window.__skew+=40000});
    await ride(1400,8);
    await until(page,()=>window.MAIRCarModePrototype.status().limitFrom==='osm',null,6000,'osm').catch(()=>{});
    st=await status(page);
    c.ok('Map Matching geeft geen match: bordje van OpenStreetMap, de dichtstbijzijnde weg (80)',(await lim())==='80'&&st.limitFrom==='osm',`${await lim()} ${st.limitFrom} ${JSON.stringify(mb.overpass.map(x=>x.url))}`);
    c.ok('de OpenStreetMap-vraag zoekt alleen wegen met maxspeed binnen 20 m',/around:20,/.test(mb.overpass[0]?.q||'')&&/\[maxspeed\]/.test(mb.overpass[0]?.q||''),mb.overpass[0]?.q);
    c.ok('de fout staat in het foutlog (Diagnostiek) met de reden',await page.evaluate(()=>(window.MAIRRuntime?.errorLog?.()||[]).some(e=>/carmode\.match/.test(JSON.stringify(e)))),JSON.stringify(await page.evaluate(()=>(window.MAIRRuntime?.errorLog?.()||[]).slice(-3))).slice(0,300));
    // HTTP 429 van Mapbox: zelfde terugval
    mb.failMatch=false;mb.matchHttp=429;mb.ovSpeed='60';await page.evaluate(()=>{window.__skew+=40000});
    await ride(1700,8);await until(page,()=>window.MAIRCarModePrototype.status().limit===60,null,6000,'60').catch(()=>{});
    c.ok('Mapbox 429: bordje van OpenStreetMap (60)',(await lim())==='60',await lim());
    // Nergens een maximumsnelheid bekend: bordje weg, geen oude waarde
    mb.ovSpeed=null;await page.evaluate(()=>{window.__skew+=40000});
    await ride(2000,8);await sleep(500);
    c.ok('geen maximumsnelheid bekend (Mapbox en OpenStreetMap leeg): bordje weg, geen oude waarde',!(await has(page,'.car-limit')),await lim());
    c.ok('de snelheid zelf blijft staan',(await txt(page,'.car-speed'))==='90',await txt(page,'.car-speed'));
    // Mapbox-aanvraag blijft hangen (iOS): na de time-out moet er weer een nieuwe aanvraag komen
    mb.matchHttp=0;mb.hangMatch=true;mb.ovSpeed='80';await page.evaluate(()=>{window.__skew+=40000});
    await ride(2300,6);const hung=mb.matching.length;
    await sleep(9500);mb.hangMatch=false;await page.evaluate(()=>{window.__skew+=40000});await ride(2500,8);
    await until(page,()=>window.MAIRCarModePrototype.status().limitFrom==='match',null,6000,'match na hangen').catch(()=>{});
    c.ok('hangende Map Matching-aanvraag houdt de rest niet voorgoed vast (time-out, daarna weer een aanvraag)',mb.matching.length>hung&&(await lim())==='50',`${hung}→${mb.matching.length} limit=${await lim()}`);
    }
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 13: vibe kiezen -------------------------------------------------
// Josh kiest met één tik een vibe (stemming van de programmering). De keuze blijft na herladen staan, de wachtrij wordt meteen
// opnieuw gepland (huidige nummer speelt door, Spotify krijgt de nieuwe volgorde, geen dubbel nummer) en met route schuift de
// journey-director zijn boog mee.
async function scenarioVibe(){
  const t=await setup(),{page,h}=t;
  const remote=()=>page.evaluate(()=>{const m=window.__mock;return{uri:m.uris[m.idx],next:m.uris.slice(m.idx+1),pos:m.state().position,playing:m.playing}});
  const inBar=()=>page.evaluate(()=>{const b=document.querySelector('#mairCarWaveOverlay .car-music-bar').getBoundingClientRect();return[...document.querySelectorAll('#mairCarWaveOverlay .car-music-bar button')].every(x=>{const q=x.getBoundingClientRect();return q.top>=b.top-1&&q.bottom<=b.bottom+1})});
  try{
    await page.locator('nav button, [role=tab]',{hasText:'Stations'}).locator('visible=true').first().click();await sleep(500);
    await page.locator('[data-mair-station]').locator('visible=true').first().click();
    await until(page,()=>window.__mock.state().playing&&window.__mock.state().uris>=10&&queue.length>=10,null,25000,'station speelt');
    await sleep(1500);
    // nep-nummers zijn allemaal even populair; geef ze verschillende energie zodat een andere vibe een andere volgorde geeft
    await page.evaluate(()=>queue.forEach((x,i)=>{x.popularity=[15,95,40,85,25,70,10,90,55,30][i%10]}));
    const before=await remote();
    await page.evaluate(()=>window.MAIRCarModePrototype.open());await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-act="music"]').first().click();await sleep(400);
    c.ok('vibe: knop in het muziekblok toont de huidige vibe (MAIR)',/MAIR/.test(await txt(page,'.car-music-bar .car-vibe')),await txt(page,'.car-music-bar .car-vibe'));
    c.ok('vibe: vibe-knop en muziekknoppen passen in het muziekblok',await inBar());
    await page.locator('#mairCarWaveOverlay .car-music-bar [data-act="vibe"]').click();
    const n=await count(page,'.car-vibes [data-vibe]'),on=await txt(page,'.car-vibes .on');
    c.ok('vibe: blad met 7 knoppen, de huidige staat aan',n===7&&on==='MAIR',n+' '+on);
    const big=await rect(page,'.car-vibes [data-vibe="chill"]');
    c.ok('vibe: knoppen zijn groot genoeg voor in de auto (>=64 px hoog)',!!big&&big.h>=64,JSON.stringify(big));
    if(outDir)await page.screenshot({path:outDir+'/carmode-vibe-blad.png'});
    await page.locator('#mairCarWaveOverlay [data-vibe="chill"]').click();
    // wacht tot Spotify de nieuwe wachtrij volgt (niet alleen tot er iets verandert: er kan nog een tussenstand zijn)
    await until(page,n=>{const m=window.__mock,next=m.uris.slice(m.idx+1);return next.join()!==n&&queue[0]?.uri===m.uris[m.idx]&&next.slice(0,5).join()===queue.slice(1,6).map(x=>x.uri).join()},before.next.join(),10000,'Spotify volgt de nieuwe wachtrij').catch(()=>{});
    const after=await remote(),local=await page.evaluate(()=>queue.map(x=>x.uri));
    c.ok('vibe: keuze opgeslagen (JFMRotation en localStorage)',await page.evaluate(()=>window.JFMRotation.state().mode==='chill'&&JSON.parse(localStorage.getItem('mair_director_state_v3')).mode==='chill'));
    c.ok('vibe: blad dicht, muziekblok toont Chill',!(await has(page,'.car-vibes'))&&/Chill/.test(await txt(page,'.car-music-bar .car-vibe')),await txt(page,'.car-music-bar .car-vibe'));
    c.ok('vibe: wachtrij is meteen opnieuw gepland (andere volgorde bij Spotify)',after.next.join()!==before.next.join(),after.next.slice(0,4).join(' '));
    c.ok('vibe: huidige nummer speelt door zonder gat (zelfde nummer, niet terug naar 0)',after.uri===before.uri&&after.playing&&after.pos>=before.pos,`${before.uri}@${before.pos} -> ${after.uri}@${after.pos} playing=${after.playing}`);
    c.ok('vibe: Spotify speelt hierna precies de nieuwe wachtrij',local[0]===after.uri&&after.next.slice(0,5).join()===local.slice(1,6).join(),`${after.next.slice(0,3)} | ${local.slice(1,4)}`);
    c.ok('vibe: geen dubbel nummer in wat Spotify gaat spelen',new Set([after.uri,...after.next]).size===after.next.length+1);
    c.ok('vibe: geen Volgende-nummer in beeld',!/volgende|hierna|next up/i.test(await page.evaluate(()=>document.getElementById('mairCarWaveOverlay').innerText)));
    if(outDir)await page.screenshot({path:outDir+'/carmode-vibe-muziek.png'});
    // volgende rit: herladen, route kiezen
    await page.reload({waitUntil:'load'});
    await until(page,()=>window.MAIRCarModePrototype&&window.JFMRotation&&window.MAIRCarMenuSticky,null,15000,'herladen');await sleep(1500);
    c.ok('vibe: na herladen nog steeds Chill',await page.evaluate(()=>window.JFMRotation.state().mode)==='chill');
    await page.evaluate(()=>window.MAIRCarModePrototype.open());
    await page.locator('[data-act="search"]').first().click();
    await page.fill('#carSearchInput','test');await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});await page.locator('[data-result-index="0"]').first().click();
    await page.locator('[data-act="start"]').waitFor({timeout:8000});
    c.ok('vibe: bij het starten van een route staat de vibe-knop er, met Chill',/Chill/.test(await txt(page,'.car-preview .car-vibe')),await txt(page,'.car-preview .car-vibe'));
    if(outDir)await page.screenshot({path:outDir+'/carmode-vibe-route.png'});
    await page.locator('[data-act="start"]').click();
    await until(page,()=>window.MAIRCarModePrototype.status().screen==='drive'&&window.MAIRJourneyDirector?.state?.().active,null,10000,'rit actief');
    t.last=0;await t.at(300);await sleep(500);
    await layoutChecks(t,'vibe rijscherm');
    c.ok('vibe: vibe-knop en muziekknoppen passen in het muziekblok (rijscherm)',await inBar());
    const j1=await page.evaluate(()=>window.MAIRJourneyDirector.state());
    await page.locator('#mairCarWaveOverlay [data-act="menu"]').click();await sleep(300);
    c.ok('vibe: menu in de bovenbalk toont de vibe',/Vibe: Chill/.test(await txt(page,'.car-menu')),await txt(page,'.car-menu'));
    await page.locator('#mairCarWaveOverlay .car-menu [data-act="vibe"]').click();await sleep(300);
    c.ok('vibe: menu dicht en het vibe-blad open (menu komt niet terug)',(await count(page,'.car-menu-backdrop'))===1&&(await has(page,'.car-vibes')));
    await page.locator('#mairCarWaveOverlay [data-vibe="energy"]').click();await sleep(800);
    const j2=await page.evaluate(()=>window.MAIRJourneyDirector.state());
    c.ok('vibe met route: journey-director houdt het verloop (zelfde fase), binnen de vibe (Energie mikt hoger dan Chill)',j2.active&&j2.phase===j1.phase&&j2.targetMomentum>j1.targetMomentum,`${j1.phase}:${j1.targetMomentum} -> ${j2.phase}:${j2.targetMomentum}`);
    c.ok('vibe met route: geen menu of blad meer open',(await count(page,'.car-menu-backdrop'))===0);
    if(outDir)await page.screenshot({path:outDir+'/carmode-vibe-rijscherm.png'});
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 14: ver uitzoomen en zelf schuiven ----------------------------
// Josh' foto: uitgezoomd tot Europa was het bovenste kwart zwart en wees de pijl naar Marokko terwijl hij in IJsselstein reed.
async function scenarioZoomOut(){
  const t=await setup(),{page,h}=t;
  try{
    await page.evaluate(()=>window.MAIRCarModePrototype.open());await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-act="music"]').first().click();await sleep(300);
    await page.evaluate(()=>{window.__speed=25;window.__heading=90});
    for(let m=1000;m<1300;m+=25){await t.at(m,{acc:6,jump:false});await page.evaluate(()=>{window.__skew+=1000})}
    await until(page,()=>window.MAIRCarMap.status().ready&&window.MAIRCarModePrototype.status().display,null,25000,'kaart klaar');await sleep(1500);
    // leeg = waar de kaart niets tekent; de kaartbak is daarvoor fel magenta gemaakt (uitlezen op een lege pagina: de app-CSP weigert data:)
    await page.addStyleTag({content:'#carMap{background:#ff00ff!important}'});
    const empty=async()=>{const r=await rect(page,'.car-map-slot'),png=await page.screenshot({clip:{x:r.x+2,y:r.y+2,width:r.w-4,height:Math.round(r.h*.25)}});
      const pg=await h.ctx.newPage();try{return await pg.evaluate(async b64=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),cv=new OffscreenCanvas(img.width,img.height),g=cv.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,img.width,img.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<60&&d[i+2]>200)n++;return Math.round(n/(d.length/4)*100)},png.toString('base64'))}finally{await pg.close()}};
    const carAt=()=>page.evaluate(()=>{const st=window.MAIRCarModePrototype.status().display,p=st&&window.MAIRCarMap.project(st.longitude,st.latitude),q=window.MAIRCarMap.puckAt();return p&&q?Math.round(Math.hypot(p.x-q.x,p.y-q.y)):999});
    const puckOn=()=>page.locator('#carMap .car-map-puck').isVisible();
    c.ok('volgmodus: geen leeg stuk boven in de kaart',(await empty())===0,String(await empty()));
    c.ok('volgmodus: auto onder de pijl',(await carAt())<5,String(await carAt()));
    const mr=await rect(page,'.car-map-slot');
    await page.mouse.move(mr.x+mr.w*.3,mr.y+mr.h*.7);
    for(let i=0;i<40;i++){await page.mouse.wheel(0,400);await sleep(60)}
    await sleep(2500);
    const {zoom:z,pitch:pz}=await page.evaluate(()=>window.MAIRCarMap.status());
    if(outDir)await page.screenshot({path:outDir+'/carmode-uitgezoomd.png'});
    const e1=await empty();
    c.ok('ver uitgezoomd: bovenste kwart van de kaart is niet leeg (zwart)',e1<=1,`leeg ${e1}% zoom ${z}`);
    // de foto keek naar het noorden (geen route): ook dan geen zwart, want plat bekeken past de wereld altijd in beeld
    c.ok('ver uitgezoomd: kaart ligt plat en zoomt niet verder uit dan Europa',pz<1&&z>=2.9,`pitch ${pz} zoom ${z}`);
    const d1=await carAt();
    c.ok('ver uitgezoomd: pijl staat op de echte gps-positie',(await puckOn())&&d1<8,`afstand ${d1}px`);
    // schuif de kaart ver weg: de auto valt buiten beeld, de pijl moet dan weg zijn
    for(let k=0;k<3;k++){await page.mouse.move(mr.x+mr.w*.2,mr.y+mr.h*.5);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(mr.x+mr.w*.2+i*40,mr.y+mr.h*.5+i*4);await page.mouse.up();await sleep(300)}
    await sleep(800);
    const off=await page.evaluate(()=>{const st=window.MAIRCarModePrototype.status().display,p=window.MAIRCarMap.project(st.longitude,st.latitude),m=document.getElementById('carMap');return p.x<0||p.y<0||p.x>m.clientWidth||p.y>m.clientHeight});
    c.ok('auto buiten beeld geschoven: pijl is weg',off&&!(await puckOn()),JSON.stringify({off,puck:await puckOn()}));
    await t.at(1325,{acc:6,jump:false});await sleep(600);
    c.ok('weggeschoven: nieuwe gps-fix trekt de kaart niet terug',(await page.evaluate(()=>window.MAIRCarMap.status().free))&&!(await puckOn()));
    await page.locator('#carMap .car-map-back').click();await sleep(1800);
    const pk=await page.evaluate(()=>{const p=window.MAIRCarMap.puckAt(),m=document.getElementById('carMap');return{x:p.x/m.clientWidth,y:p.y/m.clientHeight,z:window.MAIRCarMap.status().zoom}});
    c.ok('knop Terug: pijl weer vast midden onder (75%) op de auto, ingezoomd',(await puckOn())&&Math.abs(pk.x-.5)<.02&&pk.y>.7&&pk.y<.8&&(await carAt())<5&&pk.z>14,JSON.stringify(pk));
    c.ok('na Terug: geen leeg stuk boven in de kaart',(await empty())===0,String(await empty()));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 15: vibe-knop op het routescherm, ook op een smalle iPhone rechtop ------------
// Josh zag naast ROUTE STARTEN alleen "VIBE M...": de knop was te smal en de gekozen vibe viel weg.
async function scenarioVibeWidth(){
  for(const [width,height] of [[390,844],[844,390]]){
    const t=await setup({width,height}),{page,h}=t;
    try{
      await page.evaluate(()=>window.MAIRCarModePrototype.open());
      await page.locator('[data-act="search"]').first().click();
      await page.fill('#carSearchInput','test');await page.locator('[data-result-index="0"]').first().waitFor({timeout:8000});await page.locator('[data-result-index="0"]').first().click();
      await page.locator('[data-act="start"]').waitFor({timeout:8000});
      const modes=await page.evaluate(()=>!!window.JFMRotation?.setMode);
      c.ok(`vibe-knop ${width}px: knop staat op het routescherm`,modes&&await has(page,'.car-preview .car-vibe'));
      const bad=[];
      for(const id of ['mair','drive','energy','chill','party','discover','forgotten']){
        await page.evaluate(m=>{window.JFMRotation.setMode(m);window.MAIRCarModePrototype.render()},id);await sleep(150);
        const r=await page.evaluate(()=>{const o=document.getElementById('mairCarWaveOverlay'),v=o.querySelector('.car-preview .car-vibe'),b=v.querySelector('b'),go=o.querySelector('.car-route-start'),gr=go.getBoundingClientRect(),vr=v.getBoundingClientRect();
          return{name:b.textContent,b:[b.scrollWidth,b.clientWidth],v:[v.scrollWidth,v.clientWidth],ell:getComputedStyle(b).textOverflow,go:[Math.round(gr.width),Math.round(gr.height),go.scrollWidth<=go.clientWidth],inside:vr.right<=gr.left+1&&gr.right<=o.clientWidth}});
        if(!(r.b[0]<=r.b[1]&&r.v[0]<=r.v[1]&&r.ell!=='ellipsis'&&r.go[0]>=140&&r.go[1]>=56&&r.go[2]&&r.inside))bad.push(JSON.stringify(r));
      }
      c.ok(`vibe-knop ${width}px: elke vibe-naam past helemaal (scrollWidth <= clientWidth, geen puntjes), Route starten blijft >=140x56`,bad.length===0,bad.join(' | '));
      if(outDir)await page.screenshot({path:`${outDir}/carmode-vibe-route-${width}.png`});
      c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
    }finally{await h.close()}
  }
}

// ---- scenario 14: vibe wisselen midden in een rit --------------------------------
// Bug op v174 (iPhone, echte rit): vibe wisselen tijdens een journey veranderde de muziek niet. Dit rijdt een route met een
// spelend station, wisselt halverwege de vibe en kijkt wat Spotify daarna gaat spelen.
async function scenarioVibeRide(){
  const t=await setup(),{page,h}=t;
  const snap=()=>page.evaluate(()=>{const m=window.__mock;return{cur:m.uris[m.idx],pos:m.state().position,playing:m.playing,next:m.uris.slice(m.idx+1),local:queue.map(x=>x.uri),mode:window.JFMRotation.state().mode,journey:window.MAIRJourneyDirector?.state?.()||null}});
  try{
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mair_director_state_v3')||'{}');s.mode='party';localStorage.setItem('mair_director_state_v3',JSON.stringify(s))});
    await page.reload({waitUntil:'load'});await until(page,()=>window.MAIRCarModePrototype&&window.JFMRotation&&window.__mock,null,15000,'herladen');await sleep(1500);
    await page.locator('nav button, [role=tab]',{hasText:'Stations'}).locator('visible=true').first().click();await sleep(500);
    await page.locator('[data-mair-station]').locator('visible=true').first().click();
    await until(page,()=>window.__mock.state().playing&&window.__mock.state().uris>=10&&queue.length>=10,null,25000,'station speelt');
    await sleep(1500);
    await startRoute(t);
    for(let m=500;m<=6000;m+=500)await t.at(m);
    await until(page,()=>window.MAIRJourneyDirector?.state?.().active,null,8000,'journey actief');
    await sleep(9000); // eventuele journey-replan na het starten laten uitrazen
    const before=await snap(),beforeDj=await page.evaluate(()=>window.MAIRDJ?.state?.()?.phase||'');
    await page.evaluate(()=>{window.__rp=[];addEventListener('mair:director-replanned',e=>window.__rp.push(e.detail))});
    await page.locator('#mairCarWaveOverlay [data-act="menu"]').click();await sleep(300);
    await page.locator('#mairCarWaveOverlay .car-menu [data-act="vibe"]').click();await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-vibe="chill"]').click();
    await until(page,n=>{const m=window.__mock,next=m.uris.slice(m.idx+1);return next.slice(0,8).join()!==n&&queue[0]?.uri===m.uris[m.idx]&&next.slice(0,5).join()===queue.slice(1,6).map(x=>x.uri).join()},before.next.slice(0,8).join(),15000,'Spotify volgt de nieuwe wachtrij').catch(()=>{});
    const after=await snap(),rp=await page.evaluate(()=>window.__rp);
    const fresh=after.next.slice(0,8).filter(u=>!before.next.slice(0,40).includes(u)).length;
    console.log('  voor :',before.cur.slice(-3),before.next.slice(0,6).map(u=>u.slice(-3)).join(' '),'| journey',JSON.stringify(before.journey?.phase));
    console.log('  na   :',after.cur.slice(-3),after.next.slice(0,6).map(u=>u.slice(-3)).join(' '),'| replans',JSON.stringify(rp));
    c.ok('vibe tijdens rit: journey is actief en blijft actief',!!before.journey?.active&&!!after.journey?.active);
    c.ok('vibe tijdens rit: keuze is chill',after.mode==='chill');
    c.ok('vibe tijdens rit: volgende nummer bij Spotify is veranderd',after.next[0]!==before.next[0],`${before.next[0]} -> ${after.next[0]}`);
    c.ok('vibe tijdens rit: komende wachtrij vervangen door nieuwe nummers (minstens 5 van de eerste 8 nieuw)',fresh>=5,`nieuw: ${fresh}/8`);
    c.ok('vibe tijdens rit: Spotify speelt hierna precies de nieuwe wachtrij',after.local[0]===after.cur&&after.next.slice(0,5).join()===after.local.slice(1,6).join(),`${after.next.slice(0,3).map(u=>u.slice(-3))} | ${after.local.slice(1,4).map(u=>u.slice(-3))}`);
    c.ok('vibe tijdens rit: huidige nummer speelt uit (zelfde nummer, niet terug naar 0, blijft spelen)',after.cur===before.cur&&after.playing&&after.pos>=before.pos,`${before.cur.slice(-3)}@${before.pos} -> ${after.cur.slice(-3)}@${after.pos}`);
    c.ok('vibe tijdens rit: geen dubbel nummer in wat Spotify gaat spelen',new Set([after.cur,...after.next]).size===after.next.length+1);
    c.ok('vibe tijdens rit: geen DJ-break midden in het nummer (DJ praat niet, muziek speelt)',await page.evaluate(()=>window.MAIRDJ?.state?.()?.phase!=='SPEAKING'&&window.__mock.playing),beforeDj+' -> '+await page.evaluate(()=>window.MAIRDJ?.state?.()?.phase));
    // het huidige nummer speelt uit; daarna moet het eerste nummer van de nieuwe vibe komen
    const firstNew=after.next[0];await page.evaluate(()=>window.__mock.finishTrack(300));
    await until(page,u=>window.__mock.uris[window.__mock.idx]===u&&window.__mock.playing,firstNew,8000,'volgende nummer').catch(()=>{});
    const now=await page.evaluate(()=>({uri:window.__mock.uris[window.__mock.idx],playing:window.__mock.playing}));
    c.ok('vibe tijdens rit: na het uitspelen komt het eerste nummer van de nieuwe vibe en de muziek loopt door',now.uri===firstNew&&now.playing,JSON.stringify(now)+' verwacht '+firstNew);
    // station faalt bij de volgende wissel: muziek loopt door, wachtrij valt terug op opnieuw ordenen
    await page.evaluate(()=>{window.MAIRStationController.buildPool=async()=>{throw Error('e2e: station kapot')}});
    const pre=await snap();
    await page.locator('#mairCarWaveOverlay [data-act="menu"]').click();await sleep(300);
    await page.locator('#mairCarWaveOverlay .car-menu [data-act="vibe"]').click();await sleep(300);
    await page.locator('#mairCarWaveOverlay [data-vibe="party"]').click();await sleep(3000);
    const post=await snap();
    c.ok('vibe tijdens rit, station faalt: muziek speelt door (zelfde nummer), keuze staat op Feest, er staat nog een volgend nummer klaar',post.cur===pre.cur&&post.playing&&post.mode==='party'&&post.next.length>0,JSON.stringify({cur:post.cur.slice(-3),playing:post.playing,mode:post.mode,next:post.next.length}));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

const scenarios={viberide:scenarioVibeRide,nav:scenarioNav,arrows:scenarioArrows,bare:scenarioBare,map:scenarioMap,stops:scenarioStops,concurrent:scenarioConcurrent,sizes:scenarioSizes,map2:scenarioMap2,search:scenarioSearch,portrait:scenarioPortrait,snap:scenarioSnap,noroute:scenarioNoRoute,vibe:scenarioVibe,zoomout:scenarioZoomOut,vibewidth:scenarioVibeWidth};
const only=process.env.ONLY;
for(const [name,fn] of Object.entries(scenarios)){if(only&&only!==name)continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,300))}}
process.exit(c.summary('MAIR e2e car mode')?0:1);
