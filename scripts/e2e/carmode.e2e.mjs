// Car Mode-navigatie in de echte app (headless Chrome) met nep-GPS en een nep-Mapbox.
//   node scripts/e2e/carmode.e2e.mjs [map-voor-screenshots]
// Route: rechte lijn naar het oosten, rotonde op 1,5 km (2e afslag), afrit, 25,5 km in totaal.
// Het GPS-filter weigert sprongen sneller dan 110 m/s; Date.now() krijgt daarom een instelbare
// voorsprong (window.__skew) zodat de test grote stappen kan zetten zonder minutenlang te rijden.
import {launch,boot,until,sleep,checker,ORIGIN} from './harness.mjs';
import fs from 'node:fs';

const outDir=process.argv[2]||'';
if(outDir)fs.mkdirSync(outDir,{recursive:true});
const c=checker();
const LAT0=52.0,LON0=5.0,MX=lat=>111320*Math.cos(lat*Math.PI/180),M_LAT=110540;
const DEST_M=25500,STOP_M=10000;
const lonAt=(m,lat=LAT0,lon0=LON0)=>lon0+m/MX(lat);

// ---- nep-Mapbox -------------------------------------------------------------
function makeRoute(pts,withRoundabout){
  const [lon0,lat0]=pts[0],mx=MX(lat0),xs=pts.map(p=>(p[0]-lon0)*mx);
  const loc=x=>[lon0+x/mx,lat0],coords=[];
  const last=xs.at(-1);for(let x=0;x<last;x+=100)coords.push(loc(x));coords.push(loc(last));
  const legs=[];let total=0,dur=0;
  for(let i=0;i<pts.length-1;i++){
    const a=xs[i],b=xs[i+1],len=b-a,marks=[[a,'depart',{}]];
    if(withRoundabout&&i===0&&len>2000)marks.push([a+1500,'roundabout',{exit:2,instruction:'Ga Nelson Mandelaplein op en neem de 2e afslag richting N210/Zomerdijk/IJsselstein-Noord.'}],[a+1560,'exit roundabout',{modifier:'right'}]);
    if(len>2000)marks.push([b-500,'off ramp',{modifier:'right',instruction:'Neem de afrit rechts.'}]);
    marks.push([b,'arrive',{instruction:'Je bent gearriveerd.'}]);
    const steps=marks.map(([x,type,o],k)=>{const d=k<marks.length-1?marks[k+1][0]-x:0;return{distance:d,duration:d/25,name:'',maneuver:{type,modifier:o.modifier,exit:o.exit,instruction:o.instruction||(type==='depart'?'Rijd naar het oosten.':'Ga verder.'),location:loc(x)}}});
    legs.push({distance:len*1.003,duration:len/25,steps});total+=len*1.003;dur+=len/25;
  }
  return{routes:[{distance:total,duration:dur,geometry:{type:'LineString',coordinates:coords},legs}]};
}
async function mapbox(h,{token='pk.test'}={}){
  const m={directions:0,delayNext:0,failNext:false,roundabout:true,queries:[]};
  await h.page.route(ORIGIN+'/api/config',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({spotifyClientId:'mockclientid0123456789abcdef',mapboxPublicToken:token})}));
  await h.page.route('https://api.mapbox.com/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname.includes('/search/geocode/')){
      const q=u.searchParams.get('q')||'',x=/stop/i.test(q)?STOP_M:DEST_M,name=/stop/i.test(q)?'Tussenstop A':'Testbestemming';m.queries.push(q);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:[{geometry:{coordinates:[lonAt(x),LAT0]},properties:{name,full_address:name+', Nederland'}}]})});
    }
    m.directions++;
    if(m.delayNext){const d=m.delayNext;m.delayNext=0;await sleep(d)}
    if(m.failNext){m.failNext=false;return route.fulfill({status:500,body:'{}'}).catch(()=>{})}
    const pts=decodeURIComponent(u.pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));
    const body=JSON.stringify(makeRoute(pts,m.roundabout&&m.directions===1));
    return route.fulfill({status:200,contentType:'application/json',body}).catch(()=>{});
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
    window.__toasts=[];window.__clicks=0;
    const grab=el=>{const t=el?.closest?.('#mairCarWaveOverlay>.car-toast');if(t&&t.textContent)window.__toasts.push(t.textContent)};
    new MutationObserver(ms=>{for(const m of ms){if(m.target.nodeType===1&&m.target.matches('.car-toast'))grab(m.target);m.addedNodes.forEach(n=>{if(n.nodeType===1)grab(n)})}}).observe(document,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('[data-tr="play"]'))window.__clicks++},true);
  });
  const mb=await mapbox(h);
  await boot(h);
  await until(h.page,()=>window.MAIRCarModePrototype&&window.MAIRCarMenuSticky,null,15000,'car mode geladen');
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
const rect=(page,sel)=>page.evaluate(s=>{const e=document.querySelector('#mairCarWaveOverlay '+s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left,y:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}},sel);
const hit=(a,b)=>a&&b&&a.x<b.r-0.5&&b.x<a.r-0.5&&a.y<b.b-0.5&&b.y<a.b-0.5;
const kmOf=s=>{const m=/([\d.]+)\s*(KM|M)/.exec(s);return m?Number(m[1])*(m[2]==='KM'?1000:1):NaN};
const LONG='Te Laat Voor Dit (feat. Heel Lange Artiest Naam) - Extended Radio Edit 2026';
async function longNext(page){await page.evaluate(t=>{window.jfmUpcoming=()=>[{name:t,artists:['Jairzinho','Sevn Alias','BKO','Boef']}];window.dispatchEvent(new Event('jfm:upcoming-invalidated'))},LONG);await sleep(500)}
async function layoutChecks(t,tag){
  const {page}=t,vp=page.viewportSize();
  const ex=await rect(page,'.car-nav-exit'),dist=await rect(page,'.car-nav-maneuver b'),ins=await rect(page,'.car-nav-maneuver strong'),arrow=await rect(page,'.car-nav-arrow');
  c.ok(`${tag}: afslag-label bestaat ("2e")`,(await txt(page,'.car-nav-exit'))==='2e');
  c.ok(`${tag}: afslag-label overlapt de afstand niet`,ex&&dist&&!hit(ex,dist),JSON.stringify({ex,dist}));
  c.ok(`${tag}: afslag-label overlapt de tekst niet`,ex&&ins&&!hit(ex,ins),JSON.stringify({ex,ins}));
  c.ok(`${tag}: afslag-label zit binnen de pijlkolom`,ex&&arrow&&ex.x>=arrow.x-1&&ex.r<=arrow.r+1);
  const nb=await rect(page,'.car-next b'),nl=await rect(page,'.car-next small'),ns=await rect(page,'.car-next span');
  c.ok(`${tag}: volgende-titel staat onder "VOLGENDE"`,nb&&nl&&nb.y>=nl.b-1,JSON.stringify({nb,nl}));
  c.ok(`${tag}: artiest staat onder de titel`,nb&&ns&&ns.y>=nb.b-1,JSON.stringify({nb,ns}));
  const full=await page.evaluate(()=>{const b=document.querySelector('#mairCarWaveOverlay .car-next b');if(!b)return null;const lh=parseFloat(getComputedStyle(b).lineHeight)||parseFloat(getComputedStyle(b).fontSize)*1.2;return{text:b.textContent,lines:Math.round(b.scrollHeight/lh),cut:b.scrollHeight>b.clientHeight+2||b.scrollWidth>b.clientWidth+2,fs:getComputedStyle(b).fontSize}});
  c.ok(`${tag}: volgende-titel voluit en niet afgekapt, max 2 regels`,full&&full.text===LONG&&!full.cut&&full.lines<=(vp.width<700?3:2),JSON.stringify(full));
  const inside=await page.evaluate(()=>[...document.querySelectorAll('#mairCarWaveOverlay .car-music,#mairCarWaveOverlay .car-turn-music,#mairCarWaveOverlay .car-nav-card')].map(e=>{const r=e.getBoundingClientRect();return{c:e.className,b:r.bottom,r:r.right,t:r.top,l:r.left}}));
  c.ok(`${tag}: kaarten blijven binnen het scherm (${vp.width}x${vp.height})`,inside.length>=2&&inside.every(x=>x.b<=vp.height+1&&x.r<=vp.width+1&&x.t>=-1&&x.l>=-1),JSON.stringify(inside));
  const nav=await rect(page,'.car-nav-card'),mus=await rect(page,'.car-music, .car-turn-music');
  c.ok(`${tag}: muziek en navigatie overlappen niet`,!hit(nav,mus),JSON.stringify({nav,mus}));
}

// ---- scenario 1: gewone route ------------------------------------------------
async function scenarioNav(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t);
    c.ok('route gestart met één Directions-aanvraag',mb.directions===1,String(mb.directions));
    await longNext(page);
    // verre rotonde: gewone navigatiekaart
    c.ok('nav-kaart toont de afstand met de rotonde (1.5 KM)',(await txt(page,'.car-nav-maneuver b'))==='1.5 KM',await txt(page,'.car-nav-maneuver b'));
    await layoutChecks(t,'nav-kaart');
    if(outDir)await page.screenshot({path:outDir+'/carmode-nav-kaart.png'});
    // geen extra Mapbox-aanvragen van mair-car-stop-metrics (die vroeg elke 15 s eigen GPS + route)
    const before=mb.directions;await sleep(17000);
    c.ok('geen extra Mapbox-aanvragen in 17 s (stop-metrics)',mb.directions===before,`${before}→${mb.directions}`);
    // 70/30 vlak bij de rotonde
    await t.at(1250);await longNext(page);
    c.ok('bij de rotonde: 70/30-indeling',!!(await rect(page,'.car-turn-split')),'');
    c.ok('rotondepijl staat nog (↺)',(await txt(page,'.car-nav-arrow')).startsWith('↺'),await txt(page,'.car-nav-arrow'));
    await layoutChecks(t,'70/30');
    if(outDir)await page.screenshot({path:outDir+'/carmode-70-30.png'});
    // tikken en menu overleven GPS-fixes
    await page.evaluate(()=>{window.__play=document.querySelector('#mairCarWaveOverlay [data-tr="play"]');window.__img=document.querySelector('#mairCarWaveOverlay .car-artwork');window.__src=window.__img?.getAttribute('src')});
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
    // stap pas na passeren
    await t.at(1480);
    c.ok('5+ m voor de rotonde: rotonde blijft staan',(await txt(page,'.car-nav-arrow')).startsWith('↺'),await txt(page,'.car-nav-arrow'));
    await t.at(1530);
    c.ok('op de rotonde (1530): rotonde-aanwijzing blijft staan',(await txt(page,'.car-nav-arrow')).startsWith('↺'),await txt(page,'.car-nav-arrow'));
    await t.at(1600);
    c.ok('na de rotonde: volgende aanwijzing (afrit) met afstand ~23 KM',/KM$/.test(await txt(page,'.car-nav-maneuver b'))&&Math.abs(kmOf(await txt(page,'.car-nav-maneuver b'))-23000)<1500,await txt(page,'.car-nav-maneuver b'));
    // eerste rotonde voorbij: geen valse aankomst, afstand klopt
    for(const m of [1650,1700,1750,1800])await t.at(m,{jump:false});
    const st=await status(page);
    c.ok('na de rotonde: route nog actief, geen "bestemming bereikt"',st.routeActive===true&&!(await page.evaluate(()=>window.__toasts)).some(x=>/Route klaar|Je bent bij/.test(x)),JSON.stringify(await page.evaluate(()=>window.__toasts)));
    const rest1=kmOf(await txt(page,'.car-nav-bottom span:last-child'));
    c.ok('resterende afstand klopt (~23.7 KM na 1800 m)',Math.abs(rest1-(DEST_M-1800))<400,String(rest1));
    // afstand loopt tussen afslagen door af
    await t.at(5000);const r5=kmOf(await txt(page,'.car-nav-bottom span:last-child')),e5=await txt(page,'.car-nav-top span:last-child');
    await t.at(8000);const r8=kmOf(await txt(page,'.car-nav-bottom span:last-child'));
    c.ok('resterende afstand loopt af tussen twee afslagen (5 → 8 km gereden)',r8<r5-2500&&Math.abs(r5-(DEST_M-5000))<700,`${r5} → ${r8}`);
    const d5=await txt(page,'.car-nav-bottom span:first-child');await t.at(12000);const d12=await txt(page,'.car-nav-bottom span:first-child');
    c.ok('resterende tijd loopt af',d5!==d12&&parseInt(d12)<parseInt(d5)||/U/.test(d5),`${d5} → ${d12}`);
    c.ok('afstand tot afrit loopt mee (12.5 KM)',Math.abs(kmOf(await txt(page,'.car-nav-maneuver b'))-13000)<600,await txt(page,'.car-nav-maneuver b'));
    // GPS-nauwkeurigheid 55 m en 50 m naast de route: geen reroute
    const d0=mb.directions;
    for(let i=0;i<5;i++)await t.at(12100+i*30,{acc:55,dy:50,jump:false});
    c.ok('50 m ernaast bij 55 m nauwkeurigheid: geen herberekening',mb.directions===d0&&!(await page.evaluate(()=>window.__toasts)).some(x=>/Nieuwe route/.test(x)),`${d0}→${mb.directions}`);
    await t.at(12300,{jump:false});
    // zwak GPS
    await page.evaluate(()=>{window.__skew+=26000});await page.waitForSelector('#mairCarWaveOverlay .car-gps-weak',{timeout:8000}).catch(()=>{});
    c.ok('na 20 s zonder fix: rustige "GPS-signaal zwak"',!!(await rect(page,'.car-gps-weak')));
    c.ok('GPS zwak is geen foutmelding',!(await rect(page,'.car-toast')));
    if(outDir)await page.screenshot({path:outDir+'/carmode-gps-zwak.png'});
    await t.at(12400,{jump:false});await sleep(300);
    c.ok('nieuwe fix: indicator weg',!(await rect(page,'.car-gps-weak')));
    // mislukte reroute: oude route blijft, geen blijvende foutbalk
    mb.failNext=true;
    for(let i=0;i<3;i++){await page.evaluate(()=>{window.__skew+=3000});await t.at(12500+i*30,{dy:200,jump:false})}
    await sleep(800);
    c.ok('reroute mislukt: er was een aanvraag',mb.directions>d0);
    c.ok('reroute mislukt: wel melding, geen blijvende foutbalk',!(await rect(page,'.car-toast [data-act="dismiss"]')),'foutbalk staat er');
    c.ok('reroute mislukt: oude route blijft (nav-kaart staat)',!!(await rect(page,'.car-nav-card')));
    // echte afwijking: reroute; daarna limiet 3 per 5 min telt alleen gelukte
    t.base={lon:lonAt(12400),lat:LAT0};
    let made=0;
    for(let k=0;k<3;k++){
      await page.evaluate(()=>{window.__skew+=22000});
      const x=mb.directions;
      for(let i=0;i<3;i++)await t.at(i*30,{dy:200,jump:false});
      await sleep(900);
      if(mb.directions>x)made++;
      // de nieuwe route begint bij de afwijkende positie: daar verder rijden
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
  }finally{await h.close()}
}

// ---- scenario 2: tussenstop, aankomst ---------------------------------------
async function scenarioStops(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t,{stop:true});
    let st=await status(page);
    c.ok('tussenstop staat in de route',st.stops.length===1,JSON.stringify(st.stops));
    c.ok('nav toont TUSSENSTOP met naam en afstand erbij',(await txt(page,'.car-nav-top span:first-child'))==='TUSSENSTOP'&&(await txt(page,'.car-nav-bottom span:first-child'))==='Tussenstop A'&&/KM$/.test(await txt(page,'.car-nav-bottom span:last-child')),await txt(page,'.car-nav-card'));
    c.ok('eindbestemming staat eronder (één regel, geen dubbele voortgangsbalk)',(await txt(page,'.mair-stop-primary'))!==''&&await page.evaluate(()=>document.querySelectorAll('#mairCarWaveOverlay .mair-journey-line').length===0&&document.querySelectorAll('#mairCarWaveOverlay .car-route-progress').length===1));
    const stopLeft=kmOf(await txt(page,'.car-nav-bottom span:last-child'));
    c.ok('afstand tot stop klopt (~10 KM)',Math.abs(stopLeft-STOP_M)<500,String(stopLeft));
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
    // stap pas door na passeren: 15 m voor de afrit (op 25000) staat de afrit er nog, 10 m erna de aankomst
    await t.at(24985);
    c.ok('15 m voor de afrit: afrit-aanwijzing blijft',(await txt(page,'.car-nav-arrow')).startsWith('⤷'),await txt(page,'.car-nav-arrow'));
    await t.at(25010,{jump:false});
    c.ok('10 m na de afrit: volgende aanwijzing (aankomst)',(await txt(page,'.car-nav-arrow')).startsWith('◉'),await txt(page,'.car-nav-arrow'));
    c.ok('15 m voor/na de afrit: nog geen aankomst',(await status(page)).routeActive===true);
    for(let i=0;i<4;i++)await t.at(DEST_M-120+i*20,{jump:i===0});
    await sleep(600);
    st=await status(page);
    c.ok('bij de bestemming: route klaar',st.routeActive===false,JSON.stringify(st));
    c.ok('melding "Route klaar"',(await page.evaluate(()=>window.__toasts)).some(x=>/Route klaar/.test(x)));
    c.ok('geen pageerrors',h.log.pageErrors.length===0,h.log.pageErrors.join('|'));
  }finally{await h.close()}
}

// ---- scenario 3: gelijktijdige route-aanvragen ------------------------------
async function scenarioConcurrent(){
  const t=await setup(),{page,h,mb}=t;
  try{
    await startRoute(t);
    await t.at(2000);
    // reroute A hangt 3 s; ondertussen een tussenstop toevoegen (aanvraag B haalt A in)
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

// ---- scenario 4: andere schermformaten (alleen layout) ----------------------
async function scenarioSizes(){
  for(const [w,hh] of [[932,430],[667,375]]){
    const t=await setup({width:w,height:hh}),{page,h}=t;
    try{
      await startRoute(t);await longNext(page);
      await layoutChecks(t,`nav ${w}x${hh}`);
      if(outDir)await page.screenshot({path:`${outDir}/carmode-nav-${w}x${hh}.png`});
      await t.at(1250);await longNext(page);
      await layoutChecks(t,`70/30 ${w}x${hh}`);
      if(outDir)await page.screenshot({path:`${outDir}/carmode-70-30-${w}x${hh}.png`});
    }finally{await h.close()}
  }
}

const scenarios={nav:scenarioNav,stops:scenarioStops,concurrent:scenarioConcurrent,sizes:scenarioSizes};
const only=process.env.ONLY;
for(const [name,fn] of Object.entries(scenarios)){if(only&&only!==name)continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,300))}}
process.exit(c.summary('MAIR e2e car mode')?0:1);
