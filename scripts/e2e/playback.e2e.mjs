// e2e: de echte app tegen een nep-Spotify. Dekt starten, natuurlijke wissel, skip, pauze, DJ-break en storingen.
//   node scripts/e2e/playback.e2e.mjs [scenario]
import {launch,boot,mock,until,checker,sleep,ORIGIN} from './harness.mjs';
const c=checker();
const only=process.argv[2];
const tab=async(page,name)=>{await page.locator('nav button, [role=tab]',{hasText:name}).locator('visible=true').first().click();await page.waitForTimeout(500)};
async function startStation(h){
  await boot(h);
  await tab(h.page,'Stations');
  await h.page.locator('[data-mair-station]').locator('visible=true').first().click();
  await until(h.page,()=>window.__mock.state().playing&&window.__mock.state().uris>=10,null,25000,'station speelt');
  await tab(h.page,'Radio');
  await h.page.waitForTimeout(800);
}
const lastBreak=page=>page.evaluate(()=>{const t=window.MAIRDJ.state().terminalBreaks||[];return t[t.length-1]||null});
const vols=page=>page.evaluate(()=>(window.__mock.volLog||[]).map(x=>x[1]));
// Mislukte fetches van de bewust uitgeschakelde nep-routes (503) en de nep-SDK tellen niet; alles anders in de console wel.
const noErrors=(name,h)=>{const e=[...h.log.pageErrors,...h.log.errors.filter(x=>!/Failed to load resource/.test(x))];c.ok(name,e.length===0,e.slice(0,3).join(' | '))};

async function scenarioStart(){
  const h=await launch({trackMs:20000});
  try{
    await startStation(h);
    noErrors('boot: geen page errors',h);
    c.ok('boot: geen CSP-schendingen',h.log.csp.length===0,h.log.csp.join(' | '));
    const st=await mock(h.page);
    c.ok('station: queue gaat als uris naar Spotify',st.uris>=10,JSON.stringify(st));
    c.ok('station: eerste nummer speelt',st.playing&&st.idx===0);
    await until(h.page,()=>/Testnummer/.test(document.getElementById('title')?.textContent||''),null,8000,'titel in UI');
    c.ok('UI: titel toont het spelende nummer',true);
    await until(h.page,()=>document.querySelectorAll('#mair-up-next-list .mair-up-row').length>=2,null,10000,'Hierna gevuld');
    const upNext=await h.page.evaluate(()=>[...document.querySelectorAll('#mair-up-next-list .mair-up-row b')].map(x=>x.textContent));
    c.ok('Hierna op MAIRFM: geen dubbele nummers',new Set(upNext).size===upNext.length,upNext.join(' / '));
    c.ok('Hierna op MAIRFM: titel zonder artiest erin geplakt',upNext.every(x=>!x.includes(' · ')),upNext.join(' / '));
    const pbState=await h.page.evaluate(()=>window.JFMPlaybackState.get());
    c.ok('playback-state: isPlaying en trackId gevuld',pbState.isPlaying===true&&!!pbState.trackId,JSON.stringify(pbState));
    await h.page.evaluate(()=>document.getElementById('play').click());
    await until(h.page,()=>!window.__mock.state().playing,null,6000,'pauze');
    c.ok('pauze via UI werkt',true);await sleep(1600);
    await h.page.evaluate(()=>document.getElementById('play').click());
    await until(h.page,()=>window.__mock.state().playing,null,6000,'hervatten');
    c.ok('hervatten via UI werkt',true);await sleep(1600);
    const before=(await mock(h.page)).idx;
    await h.page.evaluate(()=>document.getElementById('next').click());
    await until(h.page,b=>window.__mock.state().idx===b+1&&window.__mock.state().playing,before,8000,'volgende');
    c.ok('volgende-knop gaat een nummer verder',true);
    const i2=(await mock(h.page)).idx;
    await h.page.evaluate(()=>window.__mock.finishTrack(400));
    await until(h.page,b=>window.__mock.state().idx>=b+1,i2,10000,'natuurlijke wissel');
    await until(h.page,()=>/Testnummer/.test(document.getElementById('title')?.textContent||''),null,5000,'titel na wissel');
    const t1=await h.page.evaluate(()=>document.getElementById('title').textContent),uri=(await mock(h.page)).uri.split(':').pop();
    c.ok('natuurlijk einde: volgend nummer start en UI volgt',/Testnummer/.test(t1),t1+' / '+uri);
    noErrors('geen page errors tijdens de sessie',h);
  }finally{await h.close()}
}

async function scenarioDjBreak(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const t=window.MAIRDJ.state().terminalBreaks||[];return t.length&&['COMPLETED','FAILED','SKIPPED'].includes(t[t.length-1].status)},null,40000,'DJ-break afgerond');
    const b=await lastBreak(h.page);
    c.ok('DJ: handmatige break wordt afgespeeld',b?.status==='COMPLETED',JSON.stringify(b));
    c.ok('DJ: writer en TTS zijn aangeroepen',h.log.api.writer>=1&&h.log.api.tts>=1,JSON.stringify(h.log.api));
    await sleep(2500);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('DJ: muziek speelt door na de break',st.playing===true,JSON.stringify(st));
    c.ok('DJ: volgend nummer is gestart',st.idx>=1);
    c.ok('DJ: volume staat terug op de luisteraarstand (0,5)',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume+' log '+v.join(','));
    c.ok('DJ: er is geduckt tijdens de break',v.some(x=>x<0.4),'log '+v.join(','));
    c.ok('DJ: muziek zakt diep weg onder de stem',v.some(x=>x<=0.05),'log '+v.join(','));
    noErrors('DJ: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioWriterDown(){
  const h=await launch({trackMs:16000,djWriter:'fail'});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await sleep(14000);
    const st=await mock(h.page);
    c.ok('writer down: muziek speelt gewoon door',st.playing===true&&st.idx>=1,JSON.stringify(st));
    c.ok('writer down: volume niet blijven hangen',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('writer down: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioTtsDown(){
  const h=await launch({trackMs:16000,ttsOk:false});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await sleep(14000);
    const st=await mock(h.page);
    c.ok('TTS down: muziek speelt door',st.playing===true&&st.idx>=1,JSON.stringify(st));
    c.ok('TTS down: volume niet blijven hangen',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    noErrors('TTS down: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioSkipDuringBreak(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const s=window.MAIRDJ.state();return s.busy||s.activeBreak||s.prepared},null,20000,'break is bezig');
    await sleep(300);
    await h.page.evaluate(()=>document.getElementById('next').click());
    await sleep(6000);
    const st=await mock(h.page);
    c.ok('skip tijdens break: muziek speelt',st.playing===true,JSON.stringify(st));
    c.ok('skip tijdens break: volume terug',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    c.ok('skip tijdens break: DJ is niet vast blijven staan',!(await h.page.evaluate(()=>window.MAIRDJ.state().busy)));
    noErrors('skip tijdens break: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioDeviceLoss(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__mock.player.disconnect()});
    await sleep(1500);
    await h.page.evaluate(()=>document.getElementById('play').click());
    await sleep(8000);
    const st=await mock(h.page),pb=await h.page.evaluate(()=>window.JFMPlaybackState.get());
    noErrors('device weg: geen page errors',h);
    c.ok('device weg: na tik op play speelt het weer',st.playing===true,JSON.stringify(st)+' pb '+JSON.stringify({isPlaying:pb.isPlaying,lastError:pb.lastError}));
  }finally{await h.close()}
}

async function scenarioRateLimit(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__mock.failNext=Object.assign(/GET \/me\/player\/devices/,{status:429})});
    await h.page.evaluate(()=>document.getElementById('next').click());
    await sleep(6000);
    const st=await mock(h.page);
    c.ok('429 op devices-lookup: muziek speelt door',st.playing===true&&st.idx>=1,JSON.stringify(st));
    c.ok('429 op devices-lookup koppelt de werkende speler niet los',st.disconnects===0,'disconnects '+st.disconnects);
    noErrors('429: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioSleepTimer(){
  const h=await launch({trackMs:60000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRSleep.scheduleMinutes(1));
    await h.page.evaluate(()=>{const k='jfm_sleep_timer_v1',x=JSON.parse(localStorage.getItem(k));x.at=Date.now()+3000;localStorage.setItem(k,JSON.stringify(x));window.dispatchEvent(new Event('pageshow'))});
    await until(h.page,()=>!window.__mock.state().playing,null,30000,'slaaptimer pauzeert');
    await sleep(1500);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('slaaptimer: muziek is gestopt',st.playing===false);
    c.ok('slaaptimer: eerst uitgefaded (meerdere stappen omlaag)',v.filter(x=>x<0.5).length>=5,'log '+v.join(','));
    c.ok('slaaptimer: volume is daarna terug op 0,5',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume+' log '+v.join(','));
  }finally{await h.close()}
}

async function scenarioRequest(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    const uri='spotify:track:Tt00000000000000000090';
    await h.page.evaluate(u=>window.JFMRequests.add(u),uri);
    const seq=[];
    for(let i=0;i<14;i++){await h.page.evaluate(()=>window.__mock.finishTrack(1200));await sleep(4200);seq.push((await mock(h.page)).uri);if(seq.length>3&&seq.at(-1)!==uri&&seq.includes(uri))break}
    const hits=seq.filter(u=>u===uri).length;
    c.ok('verzoek: het aangevraagde nummer speelt precies één keer',hits===1,'reeks '+seq.map(u=>u.slice(-3)).join(','));
    c.ok('verzoek: staat daarna niet meer als gepland',(await h.page.evaluate(()=>window.JFMRequests.list().filter(r=>['planned','armed'].includes(r.status)).length))===0);
    noErrors('verzoek: geen page errors',h);
  }finally{await h.close()}
}

async function scenarioTokenRefresh(){
  const h=await launch({trackMs:30000});
  try{
    await boot(h);
    const old=await h.page.evaluate(()=>{localStorage.jfm_exp=String(Date.now()-5000);return localStorage.jfm_token});
    await h.page.reload({waitUntil:'load'});
    await h.page.waitForFunction(()=>window.JFMPlayback&&window.__mock,null,{timeout:15000});
    await tab(h.page,'Stations');
    await h.page.locator('[data-mair-station]').locator('visible=true').first().click();
    await until(h.page,()=>window.__mock.state().playing,null,25000,'station speelt na token-verversing');
    const r=await h.page.evaluate(()=>({tok:localStorage.jfm_token,exp:Number(localStorage.jfm_exp)-Date.now(),calls:window.__mock.callLog()}));
    c.ok('token: verlopen token wordt ververst via accounts.spotify.com',r.calls.some(x=>x.includes('/api/token')),r.calls.slice(0,4).join(' | '));
    c.ok('token: nieuw token is opgeslagen met nieuwe looptijd',r.tok!==old&&r.tok.startsWith('mock-token-')&&r.exp>30*60*1000,r.tok.slice(0,20)+' exp '+r.exp);
    noErrors('token: geen page errors',h);
  }finally{await h.close()}
}

// Lange run (opt-in: node scripts/e2e/playback.e2e.mjs soak). 70 natuurlijke wissels met korte nummers en een zoekpool die nooit opraakt.
// Let op: een te kleine nep-catalogus raakt op door de herhaalvensters (45 bij HITS) en lijkt dan op een stilvallende zender; de catalogus telt daarom 600 nummers.
// Waarneming 12-10-2026 (nep-Spotify, dus een aanwijzing en geen bewijs): de zender blijft doorspelen, maar bij het einde van Spotify's lijst (~30 nummers)
// is er een stilte van enkele seconden en start MAIR opnieuw vanaf zijn eigen wachtrij, waardoor nummers binnen het herhaalvenster terugkomen (35 unieke op 70).
// Echte Spotify kan dit anders afhandelen (autoplay). Daarom opt-in en op een echt toestel natrekken.
async function scenarioSoak(){
  const h=await launch({trackMs:3200});
  await h.page.addInitScript(()=>{window.__mock.rolling=true});
  try{
    await startStation(h);
    const played=[];let stalled=0;
    for(let i=0;i<70;i++){
      await h.page.evaluate(()=>window.__mock.finishTrack(500));
      await sleep(1400);
      const s=await h.page.evaluate(()=>({u:window.__mock.state().uri,p:window.__mock.state().playing}));
      played.push(s.u);if(!s.p){stalled++;await sleep(2500);const s2=await mock(h.page);if(!s2.playing)break}
    }
    const consecutive=played.filter((u,i)=>i&&u===played[i-1]).length;
    const unique=new Set(played).size;
    c.ok('soak: 70 wissels zonder stilvallen',played.length>=70&&stalled===0,'gespeeld '+played.length+', stilgevallen '+stalled);
    c.ok('soak: geen direct herhaalde nummers',consecutive===0,consecutive+' herhalingen');
    c.ok('soak: afwisseling (minstens 40 verschillende nummers)',unique>=40,unique+' unieke');
    noErrors('soak: geen page errors',h);
  }finally{await h.close()}
}

// Scherm vergrendeld/tab verborgen: document.hidden wordt gesimuleerd (headless Chrome kent geen echte achtergrond).
async function scenarioHidden(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    const setHidden=v=>h.page.evaluate(x=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>x});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>x?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(x?'pagehide':'pageshow'))},v);
    await setHidden(true);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await sleep(12000);
    let st=await mock(h.page);
    c.ok('verborgen: muziek speelt door over de trackwissel heen',st.playing===true&&st.idx>=1,JSON.stringify(st));
    c.ok('verborgen: volume niet blijven hangen',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume);
    await setHidden(false);
    await sleep(2500);
    st=await mock(h.page);
    c.ok('terug zichtbaar: muziek speelt nog',st.playing===true,JSON.stringify(st));
    noErrors('verborgen: geen page errors',h);
  }finally{await h.close()}
}

// Een skip tijdens het voorbereiden van een break mag de DJ-stem niet 30 s tot 5 min stilleggen (Fish-backoff).
async function scenarioSkipThenBreak(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const s=window.MAIRDJ.state();return s.busy||s.activeBreak||s.prepared},null,20000,'break is bezig');
    await h.page.evaluate(()=>document.getElementById('next').click());
    await sleep(5000);
    const failuresAfterSkip=await h.page.evaluate(()=>window.JFMDJAudioGuard?.state?.failures??-1);
    c.ok('skip tijdens break telt niet als Fish-storing',failuresAfterSkip===0,'failures '+failuresAfterSkip);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const t=window.MAIRDJ.state().terminalBreaks||[];return t.length&&['COMPLETED','FAILED'].includes(t[t.length-1].status)&&t[t.length-1].breakId!==window.__firstBreak},null,40000,'tweede break afgerond').catch(()=>{});
    const b=await lastBreak(h.page);
    c.ok('na de skip komt de volgende break gewoon op de lucht',b?.status==='COMPLETED',JSON.stringify(b));
    noErrors('skip-dan-break: geen page errors',h);
  }finally{await h.close()}
}

// De stap-voor-stap volumeherstel na een break faalt één keer (SDK-hapering): de muziek mag niet op de tussenstand blijven hangen.
async function scenarioUnduckFails(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>(window.__mock.volLog||[]).some(x=>x[1]<0.2),null,40000,'muziek is geduckt');
    await h.page.evaluate(()=>{window.__mock.failVolume=1});
    await sleep(9000);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('unduck faalt één keer: volume komt toch terug op 0,5',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume+' log '+v.join(','));
    c.ok('unduck faalt één keer: muziek speelt door',st.playing===true,JSON.stringify(st));
    noErrors('unduck: geen page errors',h);
  }finally{await h.close()}
}

// Pagina herladen terwijl er muziek speelt (iOS doet dit bij terugkomen in de PWA): het SDK-device is weg, de Spotify-kant blijft.
async function scenarioReload(){
  const h=await launch({trackMs:60000});
  try{
    await startStation(h);
    const before=await mock(h.page);
    await h.page.reload({waitUntil:'load'});
    await h.page.waitForFunction(()=>window.JFMPlayback&&window.__mock,null,{timeout:15000});
    await sleep(12000);
    const st=await mock(h.page),info=await h.page.evaluate(()=>({gesture:window.JFMPlayback.health.reloadNeedsGesture,restores:window.JFMPlayback.health.reloadRestores,artist:document.getElementById('artist')?.textContent,pb:window.JFMPlaybackState.get().lastError}));
    c.ok('herlaad: Spotify-kant is hersteld (restored)',st.uris>0);
    c.ok('herlaad: muziek speelt weer of vraagt netjes om een tik',st.playing===true||info.gesture===true,JSON.stringify({st,info}));
    c.ok('herlaad: zelfde nummer (niet teruggezet naar het begin van de lijst)',st.uri===before.uri||info.gesture,st.uri+' vs '+before.uri);
    noErrors('herlaad: geen page errors',h);
  }finally{await h.close()}
}

// Regressies uit de nachtronde van 12-10-2026, elk vóór de reparatie aantoonbaar stuk.
async function scenarioRegressions(){
  const h=await launch({trackMs:30000});
  await h.page.addInitScript(()=>{if(!sessionStorage.__seeded){sessionStorage.__seeded='1';localStorage.setItem('jfm_director_memory','{"completions":{"x":1}}')}});
  try{
    await boot(h);
    await tab(h.page,'Instellingen');
    const slider=await h.page.evaluate(()=>document.querySelector('#mairProfilePage input[type=range]')?.value);
    c.ok('discovery-slider begint op 50 bij een verse start (was 0)',slider==='50',String(slider));
    await tab(h.page,'Stations');
    await h.page.locator('[data-mair-station="hits"]').locator('visible=true').first().click();
    await until(h.page,()=>window.__mock.state().playing,null,25000,'station speelt');
    await sleep(6000);
    c.ok('director: gedeeltelijk geheugen geeft geen TypeError (was: plays ontbreekt)',h.log.pageErrors.length===0,h.log.pageErrors.join(' | '));
    const n=await h.page.evaluate(async()=>{const u='spotify:track:Tt00000000000000000090';await Promise.all([window.JFMRequests.add(u),window.JFMRequests.add(u)]);return window.JFMRequests.list().filter(r=>['planned','armed'].includes(r.status)).length});
    c.ok('verzoek: dubbele tik geeft één verzoek (was: twee)',n===1,'actief: '+n);
  }finally{await h.close()}
}

// iPhone-pad: de stem loopt via <audio> (element-volume is daar vast), dus het volume moet in de samples zitten.
async function scenarioIosVoiceVolume(){
  const h=await launch({trackMs:16000});
  await h.page.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});
    Object.defineProperty(navigator,'platform',{get:()=>'iPhone'});
    window.__blobs=[];const oc=URL.createObjectURL;URL.createObjectURL=function(b){window.__blobs.push((b.type||'?')+':'+b.size);return oc.call(URL,b)};
  });
  try{
    await startStation(h);
    await h.page.evaluate(()=>window.JFMPlayback.setVolume(0.12));await sleep(500);
    await h.page.evaluate(()=>{window.__blobs.length=0;window.MAIRDJ.armManual()});
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const t=window.MAIRDJ.state().terminalBreaks||[];return t.length&&['COMPLETED','FAILED'].includes(t[t.length-1].status)},null,40000,'DJ-break afgerond');
    const r=await h.page.evaluate(()=>({blobs:window.__blobs,route:window.MAIRDJ.state().voice?.route,status:window.MAIRDJ.state().terminalBreaks.slice(-1)[0]?.status}));
    c.ok('iPhone: de stem loopt via het audio-element',r.route==='html-audio',JSON.stringify(r));
    c.ok('iPhone: bij 12% volume is de stem in de samples geschaald (WAV)',r.blobs.some(b=>b.startsWith('audio/wav')),JSON.stringify(r.blobs));
    c.ok('iPhone: de break is afgespeeld',r.status==='COMPLETED',r.status);
    noErrors('iPhone: geen page errors',h);
  }finally{await h.close()}
}

// Verzoek via de UI: zoeken, resultaat is leesbaar (was zwart op bijna zwart), tikken plant een verzoek.
async function scenarioRequestUi(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await h.page.locator('text=Nummer aanvragen').locator('visible=true').first().click();
    await sleep(800);
    await h.page.fill('input[placeholder*="Zoek een nummer"]','Testnummer 12');
    await h.page.click('#searchBtn');
    await until(h.page,()=>document.querySelectorAll('.result').length>0,null,8000,'zoekresultaten');
    const look=await h.page.evaluate(()=>{const lum=c=>{const m=c.match(/[0-9]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};const r=document.querySelector('.result'),b=r.querySelector('b'),fg=lum(getComputedStyle(b).color),bg=lum(getComputedStyle(r).backgroundColor);return {ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),n:document.querySelectorAll('.result').length}});
    c.ok('verzoek-UI: zoekresultaten verschijnen',look.n>0,JSON.stringify(look));
    c.ok('verzoek-UI: titel is leesbaar (contrast minstens 4,5:1)',look.ratio>=4.5,'contrast '+look.ratio.toFixed(2));
    await h.page.locator('.result').first().click();
    await sleep(2000);
    const reqs=await h.page.evaluate(()=>window.JFMRequests.list().filter(r=>['planned','armed'].includes(r.status)).length);
    c.ok('verzoek-UI: tikken op een resultaat plant een verzoek',reqs===1,'actief: '+reqs);
    noErrors('verzoek-UI: geen page errors',h);
  }finally{await h.close()}
}

// AI-selectie op de achtergrond mag het wisselen naar een ander station niet ophouden (13-10: tik op station gaf niets nieuws).
async function scenarioAiPicksSwitch(){
  const h=await launch({trackMs:20000});
  try{
    const picks=Array.from({length:60},(_,i)=>({title:`Testnummer ${i*7+3}`,artist:`Testartiest ${(i*7+3)%12}`}));
    await h.page.route(ORIGIN+'/api/station-picks',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:picks})}));
    await boot(h);
    const tap=id=>h.page.evaluate(id=>document.querySelector(`[data-mair-station="${id}"],[data-jfm-channel="${id}"]`)?.click(),id);
    await tap('party');await h.page.waitForTimeout(9000);
    const before=await h.page.evaluate(()=>window.__mock.state().uri);
    await tap('chill');
    let ok=true;try{await until(h.page,b=>window.__mock.state().playing&&window.__mock.state().uri!==b&&!/gaat automatisch door/.test(document.getElementById('queueInfo')?.textContent||''),before,25000,'chill speelt')}catch{ok=false}
    const q=await h.page.evaluate(()=>document.getElementById('queueInfo')?.textContent||'');
    c.ok('AI-selectie bouwt op de achtergrond: wisselen naar een ander station start dat station',ok&&/CHILL/.test(q),q);
  }finally{await h.close()}
}
const scenarios={aiPicksSwitch:scenarioAiPicksSwitch,requestUi:scenarioRequestUi,iosVoiceVolume:scenarioIosVoiceVolume,regressions:scenarioRegressions,reload:scenarioReload,unduckFails:scenarioUnduckFails,skipThenBreak:scenarioSkipThenBreak,hidden:scenarioHidden,soak:scenarioSoak,request:scenarioRequest,tokenRefresh:scenarioTokenRefresh,start:scenarioStart,djBreak:scenarioDjBreak,writerDown:scenarioWriterDown,ttsDown:scenarioTtsDown,skipDuringBreak:scenarioSkipDuringBreak,deviceLoss:scenarioDeviceLoss,rateLimit:scenarioRateLimit,sleepTimer:scenarioSleepTimer};
const optIn=new Set(['soak']);
for(const [name,fn] of Object.entries(scenarios)){if(only?only!==name:optIn.has(name))continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,600))}}
process.exit(c.summary('MAIR e2e playback')?0:1);
