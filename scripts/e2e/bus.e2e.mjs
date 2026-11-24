// e2e busradio (Josh 25-11): echte app, nep-Spotify, nep-stem, nep-GPS en echte Transitous-data (fixtures/bus-heen.json,
// verschoven naar nu). Test: wachten > instappen met startpraatje, halverwege starten en aankomen, overstap gemist,
// geen internet (vaste dienstregeling). Muziek moet steeds door blijven spelen.
//   node scripts/e2e/bus.e2e.mjs [instappen|halverwege|gemist|offline]   schermafbeeldingen in $BUS_SHOTS
import {launch,boot,until,checker,sleep,ORIGIN} from './harness.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const c=checker(),only=process.argv[2];
const SHOTS=process.env.BUS_SHOTS||path.join(os.tmpdir(),'mair-bus-shots');fs.mkdirSync(SHOTS,{recursive:true});
const FIX=JSON.parse(fs.readFileSync(new URL('./fixtures/bus-heen.json',import.meta.url),'utf8'));
const T=['start','end','scheduledStart','scheduledEnd','arrival','departure','scheduledArrival','scheduledDeparture'];
// Rit 2 (index 1) van de fixture: eerste bus vertrekt over startInMs. tweak mag de kopie aanpassen.
function data(startInMs,tweak){const d=structuredClone(FIX),off=Date.now()+startInMs-Date.parse(d.ritten[1].legs[0].start),sh=o=>{for(const k of T)if(o?.[k])o[k]=new Date(Date.parse(o[k])+off).toISOString()};
  d.ritten.forEach(r=>{sh(r);r.legs.forEach(l=>{sh(l);(l.stops||[]).forEach(sh)})});tweak?.(d.ritten[1]);return d}
const bus=l=>l.filter(x=>x.mode!=='WALK');
async function setup(d,{cache=null}={}){
  const h=await launch({trackMs:60000});let body=d&&JSON.stringify(d);h.setBus=x=>{body=x&&JSON.stringify(x)};
  await h.page.route(ORIGIN+'/api/bus*',r=>/dir=terug/.test(r.request().url())?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"ritten":[]}'}):body?r.fulfill({status:200,contentType:'application/json',body}):r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
  if(cache)await h.page.addInitScript(c=>localStorage.setItem('mair_bus_cache_v1',JSON.stringify(c)),cache);
  await h.ctx.grantPermissions(['geolocation'],{origin:ORIGIN});
  await boot(h);return h;
}
const gps=(h,p)=>h.ctx.setGeolocation({latitude:p.lat,longitude:p.lon,accuracy:10});
const line=(h,leg)=>h.page.evaluate(l=>window.MAIRBusCore.lineOf(l),leg);
const st=h=>h.page.evaluate(()=>({...window.MAIRBus.state(),dj:window.MAIRCarRideDJ.status(),playing:window.__mock.state().playing,title:document.getElementById('mairBusTitle')?.textContent||'',banner:document.getElementById('mairBusBanner')?.hidden===false?document.getElementById('mairBusBanner').textContent:'',src:document.getElementById('mairBusSource')?.textContent||''}));
const open=async h=>{const b=h.page.locator('#mairBusOpen');await b.waitFor({state:'visible',timeout:8000});await b.click();await sleep(1500)};
const noErrors=(name,h)=>{const e=[...h.log.pageErrors,...h.log.errors.filter(x=>!/Failed to load resource|mapbox|kaart/i.test(x))];c.ok(name,e.length===0,e.slice(0,3).join(' | '))};

async function instappen(){
  const d=data(60000),[b1]=bus(d.ritten[1].legs),h=await setup(d);
  try{
    await gps(h,b1.from);await open(h);
    await until(h.page,()=>window.__mock.state().playing,null,25000,'muziek start bij Bus');
    let s=await st(h);
    c.ok('instappen: wachten op de 500 bij Lekbrug',s.phase==='wachten'&&/^Wachten op de 500/.test(s.title),s.title+' '+s.phase);
    c.ok('instappen: bus-mix is Josh eigen mix',await h.page.evaluate(()=>localStorage.getItem('jfm_music_channel_v1'))==='mix');
    c.ok('instappen: live OV-data in beeld',/^Live OV-data/.test(s.src),s.src);
    await h.page.screenshot({path:path.join(SHOTS,'bus-wachten.png')});
    const l=await line(h,b1);await sleep(2500);await gps(h,l[Math.min(l.length-1,8)]);// tientallen meters in 2,5 s: sneller dan lopen
    await until(h.page,()=>window.MAIRBus.state().phase==='in-1',null,15000,'ingestapt');
    await until(h.page,()=>/^Je zit in de 500, overstap om/.test(window.MAIRCarRideDJ.status().lastText),null,30000,'startpraatje');
    await sleep(1500);s=await st(h);
    c.ok('instappen: startpraatje pas na het instappen',/^Je zit in de 500, overstap om \d\d:\d\d, je bent om \d\d:\d\d op school\.$/.test(s.dj.lastText),s.dj.lastText);
    c.ok('instappen: muziek speelt door na het praatje',s.playing===true);
    c.ok('instappen: scherm toont de rit',/^In de 500/.test(s.title),s.title);
    await h.page.screenshot({path:path.join(SHOTS,'bus-in-500.png')});
    noErrors('instappen: geen fouten',h);
  }finally{await h.close()}
}
async function halverwege(){
  const d=data(-40*60000),[,b2]=bus(d.ritten[1].legs),h=await setup(d);
  try{
    const l=await line(h,b2);await gps(h,l[Math.floor(l.length/2)]);await open(h);await h.page.locator('#mairBusOverlay [data-bus="heen"]').click();// onderweg beslist de klok, dus zelf kiezen
    await until(h.page,()=>window.MAIRBus.state().phase==='in-2',null,15000,'halverwege in de 502');
    await until(h.page,()=>/^Je zit in de 502, je bent om/.test(window.MAIRCarRideDJ.status().lastText),null,30000,'startpraatje 502');
    c.ok('halverwege: herkent de 502 en zegt alleen de aankomst',true);
    await h.page.screenshot({path:path.join(SHOTS,'bus-in-502.png')});
    await sleep(2500);await gps(h,b2.to);
    await until(h.page,()=>!window.MAIRBus.state().active,null,15000,'aangekomen');
    await until(h.page,()=>/^Je bent er\./.test(window.MAIRCarRideDJ.status().lastText),null,30000,'aankomst-DJ');
    const s=await st(h),rides=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('mair_car_rides_v1')||'[]'));
    c.ok('halverwege: ritsamenvatting zoals Car Mode',/minuten onderweg|uur/.test(s.dj.lastText)&&s.title==='Je bent er',s.dj.lastText);
    c.ok('halverwege: busrit staat in de ritlijst van Profiel',rides[0]?.name==='Bus naar BUas'&&rides[0].arrived===true,JSON.stringify(rides[0]));
    c.ok('halverwege: muziek speelt door',s.playing===true);
    await h.page.screenshot({path:path.join(SHOTS,'bus-aangekomen.png')});
    noErrors('halverwege: geen fouten',h);
  }finally{await h.close()}
}
async function gemist(){
  // De 500 komt 3 minuten na vertrek van de 502 aan in Sleeuwijk.
  const d=data(-10*60000,r=>{const[b1,b2]=bus(r.legs);b1.end=b1.to.arrival=new Date(Date.parse(b2.start)+3*60000).toISOString()}),[b1]=bus(d.ritten[1].legs),h=await setup(d);
  try{
    const l=await line(h,b1);await gps(h,l[Math.floor(l.length/2)]);await open(h);await h.page.locator('#mairBusOverlay [data-bus="heen"]').click();
    await until(h.page,()=>/Je haalt de 502/.test(document.getElementById('mairBusBanner')?.textContent||''),null,15000,'melding overstap gemist');
    await until(h.page,()=>/^Je haalt de 502 van/.test(window.MAIRCarRideDJ.status().lastText),null,60000,'DJ meldt gemiste overstap');
    const s=await st(h);
    c.ok('gemist: DJ noemt de volgende 502',/De volgende gaat om \d\d:\d\d, dan ben je om \d\d:\d\d op school\./.test(s.dj.lastText),s.dj.lastText);
    c.ok('gemist: rit rekent verder met de volgende 502',!!s.trip2);
    c.ok('gemist: muziek speelt door',s.playing===true);
    await h.page.screenshot({path:path.join(SHOTS,'bus-gemist.png')});
    noErrors('gemist: geen fouten',h);
  }finally{await h.close()}
}
async function offline(){
  const y=data(10*60000-86400000),h=await setup(null,{cache:{heen:{at:Date.now()-86400000,ritten:y.ritten}}});
  try{
    await gps(h,bus(y.ritten[1].legs)[0].from);await open(h);
    await until(h.page,()=>/^Vaste dienstregeling/.test(document.getElementById('mairBusSource')?.textContent||''),null,15000,'terugval');
    const s=await st(h);
    c.ok('offline: vaste dienstregeling van gisteren, naar vandaag geschoven',/^Wachten op de 500/.test(s.title),s.title+' | '+s.src);
    noErrors('offline: geen fouten',h);
  }finally{await h.close()}
}
for(const[n,f]of Object.entries({instappen,halverwege,gemist,offline}))if(!only||only===n){try{await f()}catch(e){c.ok(n+': liep door',false,String(e.message||e).slice(0,400))}}
process.exit(c.summary('MAIR bus e2e')?0:1);
