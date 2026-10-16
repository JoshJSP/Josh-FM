// e2e: Sleep ontwerp 3 ("Zachte fade") in de echte app tegen een nep-Spotify.
//   node scripts/e2e/sleep.e2e.mjs [scenario]
// "Versnelde tijd": de app kent een start({stopInMs,fadeMs,dj}) die dezelfde timer start als de knoppen, maar met
// seconden in plaats van minuten. De fade volgt de klok, dus een fade van 10 s gedraagt zich als eentje van 10 minuten.
// Schermafbeeldingen van de echte layout komen in $SLEEP_SHOTS (standaard de tijdelijke map).
import {launch,boot,mock,until,checker,sleep} from './harness.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const c=checker();
const only=process.argv[2];
const SHOTS=process.env.SLEEP_SHOTS||path.join(os.tmpdir(),'mair-sleep-shots');fs.mkdirSync(SHOTS,{recursive:true});
const tab=async(page,name)=>{await page.locator('nav button, [role=tab]',{hasText:name}).locator('visible=true').first().click();await page.waitForTimeout(500)};
async function startStation(h){
  await boot(h);
  await tab(h.page,'Stations');
  await h.page.locator('[data-mair-station]').locator('visible=true').first().click();
  await until(h.page,()=>window.__mock.state().playing&&window.__mock.state().uris>=10,null,25000,'station speelt');
  await tab(h.page,'Radio');
  await h.page.waitForTimeout(800);
}
const vols=(page,since=0)=>page.evaluate(s=>(window.__mock.volLog||[]).filter(x=>x[0]>=s).map(x=>x[1]),since);
const sstatus=page=>page.evaluate(()=>window.MAIRSleep.status());
const noErrors=(name,h)=>{const e=[...h.log.pageErrors,...h.log.errors.filter(x=>!/Failed to load resource/.test(x))];c.ok(name,e.length===0,e.slice(0,3).join(' | '))};
const startSleep=(page,o)=>page.evaluate(o=>{window.__mock.volLog=[];window.__sleepT0=Date.now();return window.MAIRSleep.start(o)},o);
const nonIncreasing=a=>a.every((x,i)=>i===0||x<=a[i-1]+0.011);

// Lange fade: het volume zakt in kleine stappen, de muziek speelt door tot het eind, dan pauze en volume terug.
async function scenarioLongFade(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    await startSleep(h.page,{stopInMs:16000,fadeMs:10000,dj:false});
    await sleep(3000);
    let st=await mock(h.page),v=await vols(h.page);
    c.ok('lange fade: voor het begin van de fade blijft het volume gewoon staan',v.length===0&&Math.abs(st.volume-0.5)<0.02,'log '+v.join(','));
    await sleep(6000);
    st=await mock(h.page);v=await vols(h.page);
    const s=await sstatus(h.page);
    c.ok('lange fade: tijdens de fade speelt de muziek door',st.playing===true,JSON.stringify(st));
    c.ok('lange fade: de fade is bezig en het volume is al lager',s.fading===true&&st.volume<0.45,JSON.stringify({fading:s.fading,vol:st.volume}));
    await until(h.page,()=>!window.__mock.state().playing,null,25000,'pauze na de fade');
    await sleep(2500);
    st=await mock(h.page);v=await vols(h.page);
    const down=v.slice(0,-1).filter(x=>x<0.5);
    c.ok('lange fade: veel kleine stappen omlaag (geen sprong)',down.length>=10,'log '+v.join(','));
    c.ok('lange fade: de stappen zakken zonder terug te veren',nonIncreasing(v.slice(0,Math.max(0,v.length-1))),'log '+v.join(','));
    c.ok('lange fade: grootste stap is klein',v.slice(0,-1).every((x,i,a)=>i===0||a[i-1]-x<=0.1),'log '+v.join(','));
    c.ok('lange fade: het volume kwam bijna op nul voor de pauze',Math.min(...v)<=0.03,'min '+Math.min(...v));
    c.ok('lange fade: muziek is gepauzeerd',st.playing===false);
    c.ok('lange fade: volume is terug op 0,5 (volgende keer niet zacht)',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    const after=await sstatus(h.page);
    c.ok('lange fade: timer is opgeruimd',after.active===false&&after.fading===false);
    c.ok('lange fade: geen hersteldrempel blijft achter in opslag',await h.page.evaluate(()=>localStorage.getItem('jfm_sleep_fade_v1')===null));
    noErrors('lange fade: geen page errors',h);
  }finally{await h.close()}
}

// Annuleren midden in de fade: de fade stopt, het volume komt terug en de muziek loopt door.
async function scenarioCancelMid(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    await startSleep(h.page,{stopInMs:20000,fadeMs:14000,dj:false});
    await h.page.evaluate(()=>window.MAIRSleep.open());await sleep(300);
    await until(h.page,()=>window.__mock.state().volume<0.3,null,20000,'volume zakt');
    await h.page.locator('#mairSleepCancel').click();
    await sleep(1800);
    let st=await mock(h.page);
    c.ok('annuleren: volume is terug op 0,5',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    c.ok('annuleren: muziek speelt door',st.playing===true);
    const s=await sstatus(h.page);
    c.ok('annuleren: timer en fade zijn gestopt',s.active===false&&s.fading===false);
    const before=(await vols(h.page)).length;await sleep(4000);
    st=await mock(h.page);
    c.ok('annuleren: er komen geen fade-stappen meer bij',(await vols(h.page)).length===before&&Math.abs(st.volume-0.5)<0.02&&st.playing===true);
    c.ok('annuleren: knop Start slaaptimer is terug',await h.page.locator('#mairSleepStart').isVisible());
    noErrors('annuleren: geen page errors',h);
  }finally{await h.close()}
}

// Zelf aan het volume zitten: de fade stopt en jouw nieuwe stand blijft staan.
async function scenarioUserVolume(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    await startSleep(h.page,{stopInMs:22000,fadeMs:16000,dj:false});
    await until(h.page,()=>window.__mock.state().volume<0.35,null,20000,'volume zakt');
    await h.page.evaluate(()=>window.JFMPlayback.setVolume(0.8));
    await sleep(1200);
    const s=await sstatus(h.page),n0=(await vols(h.page)).length;
    c.ok('eigen volume: fade is afgebroken',s.fading===false&&s.fadeAborted===true,JSON.stringify(s));
    await sleep(3500);
    const st=await mock(h.page);
    c.ok('eigen volume: de fade drukt het volume niet meer omlaag',Math.abs(st.volume-0.8)<0.02&&st.playing===true,'volume '+st.volume);
    c.ok('eigen volume: geen nieuwe stappen na de afbreking',(await vols(h.page)).length===n0);
    // De timer zelf blijft staan: op het eind volgt een korte fade en daarna de pauze, met jouw volume terug.
    await until(h.page,()=>!window.__mock.state().playing,null,25000,'pauze op het eind');
    await sleep(2500);
    const end=await mock(h.page);
    c.ok('eigen volume: timer pauzeert alsnog en jouw volume komt terug',end.playing===false&&Math.abs(end.volume-0.8)<0.02,'volume '+end.volume);
    noErrors('eigen volume: geen page errors',h);
  }finally{await h.close()}
}

// De Spotify-SDK weigert een paar keer het volume: de fade gaat via de Web API of slaat een stap over, de muziek blijft doorlopen.
async function scenarioVolumeErrors(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    await startSleep(h.page,{stopInMs:14000,fadeMs:10000,dj:false});
    await sleep(4500);
    await h.page.evaluate(()=>{window.__mock.failVolume=4});
    await until(h.page,()=>!window.__mock.state().playing,null,25000,'pauze ondanks volume-fouten');
    await sleep(2500);
    const st=await mock(h.page);
    c.ok('volume-fouten: de timer pauzeert toch op tijd',st.playing===false);
    c.ok('volume-fouten: volume is daarna terug',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('volume-fouten: geen page errors',h);
  }finally{await h.close()}
}

// Welterusten lukt: de DJ praat vlak voor de fade (muziek gedimd), daarna zakt het volume en volgt de pauze.
async function scenarioGoodnightOk(){
  const h=await launch({trackMs:90000,ttsOk:true});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__speaking=[];window.addEventListener('mair:dj-speaking',e=>window.__speaking.push([Date.now(),!!e.detail.active,String(e.detail.breakId||'')]))});
    await startSleep(h.page,{stopInMs:26000,fadeMs:12000,dj:true});
    await until(h.page,()=>window.MAIRSleep.status().goodnight.result!=='',null,30000,'welterusten klaar');
    const s=await sstatus(h.page);
    c.ok('welterusten: de DJ heeft het gezegd',s.goodnight.result==='said',JSON.stringify(s.goodnight));
    c.ok('welterusten: de tts-route is aangeroepen',h.log.api.tts>=1,'tts '+h.log.api.tts);
    const sp=await h.page.evaluate(()=>window.__speaking);
    c.ok('welterusten: stem begon en eindigde onder een sleep-breakId',sp.some(x=>x[1]&&/sleep-goodnight/.test(x[2]))&&sp.some(x=>!x[1]&&/sleep-goodnight/.test(x[2])),JSON.stringify(sp));
    const v=await vols(h.page);
    c.ok('welterusten: de muziek werd even gedimd onder de stem',v.some(x=>x<=0.05)&&v.some(x=>x>=0.45),'log '+v.join(','));
    c.ok('welterusten: speelt nog door tot de fade',(await mock(h.page)).playing===true);
    await until(h.page,()=>!window.__mock.state().playing,null,30000,'pauze na welterusten');
    await sleep(2500);
    const st=await mock(h.page);
    c.ok('welterusten: daarna toch gepauzeerd en volume terug',st.playing===false&&Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('welterusten: geen page errors',h);
  }finally{await h.close()}
}

// Valt er een natuurlijke trackwissel in het venster voor de fade, dan zegt de DJ het daar en niet midden in een nummer.
async function scenarioGoodnightBoundary(){
  const h=await launch({trackMs:90000,ttsOk:true});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__said=0;window.addEventListener('mair:dj-speaking',e=>{if(e.detail.active&&/sleep-goodnight/.test(String(e.detail.breakId||''))&&!window.__said)window.__said=Date.now()})});
    await startSleep(h.page,{stopInMs:40000,fadeMs:10000,dj:true});
    const t0=await h.page.evaluate(()=>window.__sleepT0);
    await sleep(2500);
    c.ok('welterusten bij trackwissel: nog niets gezegd midden in het nummer',(await h.page.evaluate(()=>window.__said))===0);
    await h.page.evaluate(()=>window.__mock.finishTrack(800));
    await until(h.page,()=>window.__said>0,null,15000,'welterusten bij de wissel');
    const at=await h.page.evaluate(()=>window.__said)-t0;
    c.ok('welterusten bij trackwissel: gezegd direct na de wissel (ruim voor de fade op 30 s)',at<15000,'na '+at+' ms');
    await until(h.page,()=>window.MAIRSleep.status().goodnight.result!=='',null,15000,'welterusten klaar');
    c.ok('welterusten bij trackwissel: gelukt',(await sstatus(h.page)).goodnight.result==='said');
    await until(h.page,()=>!window.__mock.state().playing,null,40000,'pauze');
    await sleep(2500);
    const st=await mock(h.page);
    c.ok('welterusten bij trackwissel: pauze en volume terug',st.playing===false&&Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('welterusten bij trackwissel: geen page errors',h);
  }finally{await h.close()}
}

// Welterusten faalt (tts down): alles gaat gewoon door, de fade en de pauze komen op tijd.
async function scenarioGoodnightFails(){
  const h=await launch({trackMs:90000,ttsOk:false});
  try{
    await startStation(h);
    const t0=Date.now();
    await startSleep(h.page,{stopInMs:22000,fadeMs:12000,dj:true});
    await until(h.page,()=>window.MAIRSleep.status().goodnight.result!=='',null,30000,'welterusten afgehandeld');
    let s=await sstatus(h.page);
    c.ok('welterusten faalt: gemeld als mislukt',s.goodnight.result==='failed',JSON.stringify(s.goodnight));
    c.ok('welterusten faalt: de muziek speelt gewoon door',(await mock(h.page)).playing===true);
    await until(h.page,()=>!window.__mock.state().playing,null,30000,'pauze ondanks mislukte tts');
    const took=Date.now()-t0;
    await sleep(2500);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('welterusten faalt: er was toch een zachte fade',v.filter(x=>x<0.5).length>=8,'log '+v.join(','));
    c.ok('welterusten faalt: pauze kwam op tijd (22 s, niet veel later)',took<28000,'duur '+took);
    c.ok('welterusten faalt: volume terug op 0,5',st.playing===false&&Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('welterusten faalt: geen page errors',h);
  }finally{await h.close()}
}

// De DJ is niet beschikbaar (scherm verborgen): welterusten wordt overgeslagen, de fade loopt gewoon.
async function scenarioGoodnightHidden(){
  const h=await launch({trackMs:90000,ttsOk:true});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})});
    await h.page.evaluate(()=>{window.__gn=[];window.addEventListener('mair:sleep',e=>window.__gn.push(e.detail.goodnight.result))});
    await startSleep(h.page,{stopInMs:20000,fadeMs:10000,dj:true});
    await until(h.page,()=>!window.__mock.state().playing,null,30000,'pauze met verborgen scherm');
    await sleep(2500);
    const s=await sstatus(h.page),st=await mock(h.page);
    c.ok('verborgen: geen tts-aanroep voor welterusten',h.log.api.tts===0,'tts '+h.log.api.tts);
    const gn=await h.page.evaluate(()=>window.__gn);
    c.ok('verborgen: welterusten overgeslagen, pauze en volume gelukt',gn.includes('skipped')&&!gn.includes('said')&&st.playing===false&&Math.abs(st.volume-0.5)<0.02,JSON.stringify(gn)+' vol '+st.volume);
    noErrors('verborgen: geen page errors',h);
  }finally{await h.close()}
}

// Scherm uit / pagina bevroren: de timer is verlopen toen de pagina terugkwam. Dan geen sprong maar een korte fade (grace-logica).
async function scenarioFrozenGrace(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    await startSleep(h.page,{stopInMs:60000,fadeMs:20000,dj:false});
    await h.page.evaluate(()=>{const k='jfm_sleep_timer_v1',x=JSON.parse(localStorage.getItem(k));x.at=Date.now()-30000;x.createdAt=x.at-60000;localStorage.setItem(k,JSON.stringify(x));window.dispatchEvent(new Event('pageshow'))});
    await until(h.page,()=>!window.__mock.state().playing,null,25000,'pauze na bevroren pagina');
    await sleep(2500);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('bevroren pagina: toch gepauzeerd binnen de coulance',st.playing===false);
    c.ok('bevroren pagina: korte fade in meerdere stappen, geen harde stop',v.filter(x=>x<0.5).length>=6&&nonIncreasing(v.slice(0,-1)),'log '+v.join(','));
    c.ok('bevroren pagina: volume terug op 0,5',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('bevroren pagina: geen page errors',h);
  }finally{await h.close()}
}

// De bestaande knoppen: kiezen, starten, tijd wijzigen, na dit nummer, MAIR SLEEP-station, annuleren.
async function scenarioButtons(){
  const h=await launch({trackMs:90000});
  try{
    await startStation(h);
    const p=h.page;
    await p.evaluate(()=>window.MAIRSleep.open());await sleep(300);
    await p.locator('[data-sleep-minutes="45"]').click();
    c.ok('knoppen: een tijd kiezen start nog niets',(await sstatus(p)).active===false);
    await p.locator('[data-sleep-fade="10"]').click();
    await p.locator('#mairSleepDj').click();
    await p.locator('#mairSleepStart').click();
    let s=await sstatus(p);
    c.ok('knoppen: Start slaaptimer zet 45 min met 10 min fade en DJ uit',s.active&&s.mode==='time'&&Math.abs(s.remainingMs-45*60000)<3000&&s.fadeMs===600000&&s.goodnight.enabled===false,JSON.stringify(s));
    c.ok('knoppen: scherm toont de stoptijd',/Zacht uit om \d\d:\d\d/.test(await p.locator('#mairSleepBig').textContent()));
    await p.locator('[data-sleep-minutes="15"]').click();
    s=await sstatus(p);
    c.ok('knoppen: tijdens een timer past 15 min hem meteen aan',s.active&&Math.abs(s.remainingMs-15*60000)<3000&&s.fadeMs===600000,JSON.stringify(s));
    await p.locator('[data-sleep-fade="2"]').click();
    s=await sstatus(p);
    c.ok('knoppen: fade-lengte aanpassen tijdens de timer',s.fadeMs===120000,JSON.stringify(s));
    await p.locator('#mairSleepAfterTrack').click();
    s=await sstatus(p);
    c.ok('knoppen: Stop na dit nummer werkt',s.active&&s.mode==='after-track',JSON.stringify(s));
    await p.locator('#mairSleepCancel').click();
    c.ok('knoppen: Timer uitzetten werkt',(await sstatus(p)).active===false);
    await p.evaluate(()=>{const sc=window.MAIRStationController,orig=sc.select;window.__picked=[];sc.select=function(id,...a){window.__picked.push(id);return orig.call(this,id,...a)}});
    await p.locator('#mairSleepStation').click();await sleep(2500);
    const ch=await p.evaluate(()=>({picked:window.__picked,err:window.MAIRSleep.status().lastError}));
    c.ok('knoppen: MAIR SLEEP-station kiezen werkt',ch.picked.includes('sleep')&&!ch.err,JSON.stringify(ch));
    c.ok('knoppen: lengte 1 tot 10 min als keuze',await p.evaluate(()=>[...document.querySelectorAll('[data-sleep-fade]')].map(b=>b.dataset.sleepFade).join())==='1,2,5,10');
    noErrors('knoppen: geen page errors',h);
  }finally{await h.close()}
}

// Layout op 390x844, rechtop en liggend: niets buiten beeld, niets afgekapt, ook met een lopende timer en een lange titel.
async function layoutCheck(h,label){
  const page=h.page;
  const r=await page.evaluate(()=>{
    const o=document.getElementById('mairSleepOverlay'),vw=innerWidth,vh=innerHeight,bad=[];
    const els=[...o.querySelectorAll('button,span,b,small,div')].filter(e=>e.getClientRects().length&&(e.children.length===0||e.matches('button')));
    for(const e of els){
      const b=e.getBoundingClientRect(),t=(e.textContent||'').trim();
      if(b.width===0||b.height===0)continue;
      if(b.left<-0.5||b.right>vw+0.5)bad.push('buiten breedte: '+(t||e.id||e.className)+' '+Math.round(b.left)+'-'+Math.round(b.right));
      if(t&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible')bad.push('afgekapt: '+t);
      if(t&&e.scrollWidth>e.clientWidth+1&&e.tagName==='BUTTON')bad.push('knoptekst te breed: '+t);
    }
    const btns=['mairSleepStart','mairSleepCancel','mairSleepAfterTrack','mairSleepStation','mairSleepClose','mairSleepDj'].map(id=>document.getElementById(id)).filter(e=>e&&e.getClientRects().length);
    for(const e of btns){const b=e.getBoundingClientRect();if(b.bottom>vh+0.5||b.top<-0.5)bad.push('knop buiten beeld: '+e.id+' '+Math.round(b.top)+'-'+Math.round(b.bottom)+' van '+vh)}
    const fs=[...o.querySelectorAll('[data-sleep-minutes],[data-sleep-fade]')].map(e=>e.getBoundingClientRect());
    return{bad,docScroll:o.scrollWidth>o.clientWidth+1,vw,vh,minBtn:Math.min(...fs.map(b=>b.height)),graph:document.getElementById('mairSleepGraph').getBoundingClientRect().height};
  });
  c.ok(`layout ${label}: geen afgekapte tekst en niets buiten beeld`,r.bad.length===0,r.bad.join(' | '));
  c.ok(`layout ${label}: geen zijwaartse scroll`,r.docScroll===false);
  c.ok(`layout ${label}: kiesknoppen zijn tikbaar (minstens 40 px hoog)`,r.minBtn>=40,'hoogte '+r.minBtn);
  c.ok(`layout ${label}: grafiek is zichtbaar`,r.graph>60,'hoogte '+r.graph);
}
async function scenarioLayout(){
  for(const [label,w,hh] of [['rechtop 390x844',390,844],['liggend 844x390',844,390]]){
    const h=await launch({trackMs:90000,width:w,height:hh});
    try{
      await startStation(h);
      const tag=w<hh?'portret':'liggend';
      await h.page.evaluate(()=>window.MAIRSleep.open());await sleep(500);
      await layoutCheck(h,label+' (instellen)');
      await h.page.screenshot({path:path.join(SHOTS,`sleep-${tag}-instellen.png`)});
      await h.page.evaluate(()=>{window.MAIRSleep.scheduleMinutes(45,{fadeMin:10,dj:true})});await sleep(800);
      await layoutCheck(h,label+' (timer loopt)');
      await h.page.screenshot({path:path.join(SHOTS,`sleep-${tag}-timer.png`)});
      // Een lange tracktitel in de after-track-stand mag het scherm niet breder maken.
      await h.page.evaluate(()=>{const t=document.getElementById('title');if(t)t.textContent='Een heel erg lange titel van een nummer dat maar niet ophoudt met doorgaan en doorgaan';window.MAIRSleep.scheduleAfterTrack()});await sleep(800);
      await layoutCheck(h,label+' (na dit nummer, lange titel)');
      await h.page.screenshot({path:path.join(SHOTS,`sleep-${tag}-na-nummer.png`)});
      noErrors(`layout ${label}: geen page errors`,h);
    }finally{await h.close()}
  }
}

const scenarios={longFade:scenarioLongFade,cancelMid:scenarioCancelMid,userVolume:scenarioUserVolume,volumeErrors:scenarioVolumeErrors,goodnightOk:scenarioGoodnightOk,goodnightBoundary:scenarioGoodnightBoundary,goodnightFails:scenarioGoodnightFails,goodnightHidden:scenarioGoodnightHidden,frozenGrace:scenarioFrozenGrace,buttons:scenarioButtons,layout:scenarioLayout};
for(const [name,fn] of Object.entries(scenarios)){if(only&&only!==name)continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,600))}}
process.exit(c.summary('MAIR e2e sleep')?0:1);
