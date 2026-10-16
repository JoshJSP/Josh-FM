// Car Mode (ontwerp C2) in de echte app (headless Chrome) met nep-GPS en een nep-Mapbox.
//   node scripts/e2e/carmode.e2e.mjs [map-voor-screenshots]      (ONLY=nav|stops|concurrent|sizes|arrows|map)
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
const STYLE_JSON=()=>({version:8,name:'e2e-nacht',sources:{decor:{type:'geojson',data:decor()}},layers:[
  {id:'bg',type:'background',paint:{'background-color':'#10131c'}},
  {id:'park',type:'fill',source:'decor',filter:['==',['get','cls'],'park'],paint:{'fill-color':'#0f2420'}},
  {id:'water',type:'fill',source:'decor',filter:['==',['get','cls'],'water'],paint:{'fill-color':'#0c2339'}},
  {id:'streets',type:'line',source:'decor',filter:['==',['get','cls'],'street'],paint:{'line-color':'#232c42','line-width':2}},
  {id:'main',type:'line',source:'decor',filter:['==',['get','cls'],'main'],paint:{'line-color':'#35416a','line-width':9}}]});
async function mapbox(h,{token='pk.test'}={}){
  const m={directions:0,delayNext:0,failNext:false,roundabout:true,annotate:true,queries:[],params:[],styleReq:0,otherReq:[]};
  await h.page.route(ORIGIN+'/api/config',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({spotifyClientId:'mockclientid0123456789abcdef',mapboxPublicToken:token})}));
  await h.page.route('https://api.mapbox.com/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname.includes('/search/geocode/')){
      const q=u.searchParams.get('q')||'',x=/stop/i.test(q)?STOP_M:DEST_M,name=/stop/i.test(q)?'Tussenstop A':'Testbestemming';m.queries.push(q);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:[{geometry:{coordinates:[lonAt(x),LAT0]},properties:{name,full_address:name+', Nederland'}}]})});
    }
    if(u.pathname.startsWith('/styles/v1/')){m.styleReq++;m.styleUrl=u.pathname;return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(STYLE_JSON())}).catch(()=>{})}
    if(!u.pathname.startsWith('/directions/')){m.otherReq.push(u.pathname);return route.fulfill({status:404,body:'{}',headers:{'access-control-allow-origin':'*'}}).catch(()=>{})}
    m.directions++;m.params.push(Object.fromEntries(u.searchParams));
    if(m.delayNext){const d=m.delayNext;m.delayNext=0;await sleep(d)}
    if(m.failNext){m.failNext=false;return route.fulfill({status:500,body:'{}'}).catch(()=>{})}
    const pts=decodeURIComponent(u.pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));
    const body=JSON.stringify(makeRoute(pts,m.roundabout&&m.directions===1,{annotate:m.annotate}));
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body}).catch(()=>{});
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
  c.ok(`${tag}: C2: kaart links, snelheid en muziek rechts, muziek onder snelheid`,mp.r<=sp.x&&mp.r<=bar.x&&sp.b<=bar.y&&mp.w>vp.width*.5&&vp.height-bar.b<vp.height*.06,JSON.stringify({mp,sp,bar}));
  const btn=await page.evaluate(()=>[...document.querySelectorAll('#mairCarWaveOverlay .car-controls button')].map(b=>{const q=b.getBoundingClientRect();return[Math.round(q.width),Math.round(q.height)]}));
  c.ok(`${tag}: knoppen zijn groot genoeg (>=40 px)`,btn.length===4&&btn.every(([w,hh])=>w>=40&&hh>=40),JSON.stringify(btn));
  c.ok(`${tag}: geen VOLGENDE / volgend nummer`,!(await has(page,'.car-next'))&&!/VOLGENDE/.test(await txt(page,'.car-drive')),await txt(page,'.car-drive'));
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
    c.ok('overlay krijgt .has-map en de kaart staat links in het kaartvak onder de bovenbalk',navMap.has&&Math.abs(navMap.x-navMap.sx)<1&&Math.abs(navMap.y-navMap.sy)<1&&Math.abs(navMap.w-navMap.sw)<1&&navMap.w<page.viewportSize().width*.7&&navMap.y>page.viewportSize().height*.25,JSON.stringify(navMap));
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

const scenarios={nav:scenarioNav,arrows:scenarioArrows,bare:scenarioBare,map:scenarioMap,stops:scenarioStops,concurrent:scenarioConcurrent,sizes:scenarioSizes};
const only=process.env.ONLY;
for(const [name,fn] of Object.entries(scenarios)){if(only&&only!==name)continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,300))}}
process.exit(c.summary('MAIR e2e car mode')?0:1);
