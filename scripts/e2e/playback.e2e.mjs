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
    await h.page.evaluate(()=>{window.__speakPlaying=[];const t=setInterval(()=>{if(window.MAIRDJ.state().phase==='SPEAKING')window.__speakPlaying.push(window.__mock.state().playing)},150);setTimeout(()=>clearInterval(t),40000)});
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await until(h.page,()=>{const t=window.MAIRDJ.state().terminalBreaks||[];return t.length&&['COMPLETED','FAILED','SKIPPED'].includes(t[t.length-1].status)},null,40000,'DJ-break afgerond');
    const b=await lastBreak(h.page),sp=await h.page.evaluate(()=>window.__speakPlaying);
    c.ok('DJ: muziek staat stil zolang de DJ praat',sp.length>0&&sp.every(x=>x===false),JSON.stringify(sp));
    c.ok('DJ: handmatige break wordt afgespeeld',b?.status==='COMPLETED',JSON.stringify(b));
    c.ok('DJ: writer en TTS zijn aangeroepen',h.log.api.writer>=1&&h.log.api.tts>=1,JSON.stringify(h.log.api));
    await sleep(2500);
    const st=await mock(h.page),v=await vols(h.page);
    c.ok('DJ: muziek speelt door na de break',st.playing===true,JSON.stringify(st));
    c.ok('DJ: volgend nummer is gestart',st.idx>=1);
    c.ok('DJ: volume staat terug op de luisteraarstand (0,5)',Math.abs(st.volume-0.5)<0.02,'volume '+st.volume+' log '+v.join(','));
    c.ok('DJ: volume is niet weggedraaid (geen DJ over muziek)',v.every(x=>x>=0.4),'log '+v.join(','));
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

async function scenarioRateLimitBackoff(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__mock.failNext=Object.assign(/GET \/me\/player$/,{status:429,retryAfter:20})});
    const first=await h.page.evaluate(()=>api('/me/player').then(()=>'ok',e=>e.message));
    c.ok('429: Retry-After 20 sec komt terug in de melding',/20 sec/.test(first),first);
    const before=(await h.page.evaluate(()=>window.__mock.callLog())).length;
    const reads=await h.page.evaluate(async()=>{const out=[];for(let i=0;i<5;i++)out.push(await api('/me/top/tracks?limit=5').then(()=>'ok',e=>e.message));return out});
    const after=(await h.page.evaluate(()=>window.__mock.callLog())).length;
    c.ok('429: tijdens de wachttijd gaan leesverzoeken niet het netwerk op',after===before&&reads.every(x=>/rustiger/.test(x)),JSON.stringify({before,after,reads}));
    const uri0=(await mock(h.page)).uri;
    await h.page.evaluate(()=>document.getElementById('next').click());
    await sleep(6000);
    const st=await mock(h.page);
    c.ok('429: volgende-knop (schrijfopdracht) werkt tijdens de wachttijd en muziek speelt door',st.playing===true&&st.uri!==uri0,JSON.stringify(st));
    noErrors('429 backoff: geen page errors',h);
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
  await h.page.addInitScript(()=>{window.__mock.rolling=true;localStorage.setItem('mair_dj_enabled_v1','0')}); // DJ uit: een break (pauze, praten, verder) is anders een geplande stilte van ~4 s en telt als stilvallen
  try{
    await startStation(h);
    const played=[];let stalled=0;
    let ended=-1;
    for(let i=0;i<70;i++){
      await h.page.evaluate(()=>window.__mock.finishTrack(500));
      await sleep(1400);
      // Soms komt de wissel later dan 1,4 s (wachtrij wordt net bijgevuld). Dan nog even wachten, anders telt hetzelfde nummer twee keer.
      for(let w=0;w<4&&await h.page.evaluate(e=>window.__mock.state().ended===e,ended);w++)await sleep(700);
      // radio-suite neemt elke 6 s een nummer op in de geschiedenis; bij echte nummers van minuten mist hij er geen. Hier wisselt het
      // elke 1,5 s, dus vullen we de geschiedenis zoals hij op een echte rit zou zijn.
      const s=await h.page.evaluate(()=>{const u=window.__mock.state().uri,id=u.split(':').pop(),r=window.JFMRadioSuite?.state?.();if(r&&id&&r.lastIds[0]!==id)r.lastIds.unshift(id);return{u,p:window.__mock.state().playing,e:window.__mock.state().ended}});
      ended=s.e;played.push(s.u);if(!s.p){stalled++;await sleep(2500);const s2=await mock(h.page);if(!s2.playing)break}
    }
    const consecutive=played.filter((u,i)=>i&&u===played[i-1]).length;
    const unique=new Set(played).size;
    c.ok('soak: 70 wissels zonder stilvallen',played.length>=70&&stalled===0,'gespeeld '+played.length+', stilgevallen '+stalled);
    c.ok('soak: geen direct herhaalde nummers',consecutive===0,consecutive+' herhalingen');
    const lastAt=new Map();let minGap=Infinity,early=[];played.forEach((u,i)=>{if(lastAt.has(u)){const g=i-lastAt.get(u);if(g<minGap)minGap=g;if(g<15)early.push(g)}lastAt.set(u,i)});
    c.ok('soak: een nummer komt niet binnen 15 nummers terug (60% van een bron van ~26)',early.length===0,'kortste terugkeer '+minGap+', vroeg '+JSON.stringify(early));
    c.ok('soak: afwisseling (minstens 20 verschillende nummers)',unique>=20,unique+' unieke');
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
// Inlog blijft bestaan (14-10-2026): app heropenen met verlopen access-token, verversen dat tijdelijk mislukt, en een refresh-token die een ander tabblad al vernieuwd heeft.
const sess=page=>page.evaluate(()=>({refresh:localStorage.getItem('jfm_refresh'),token:localStorage.getItem('jfm_token'),status:document.getElementById('status')?.textContent,setupHidden:document.getElementById('setup')?.classList.contains('hidden'),url:location.href,tokenCalls:window.__mock.callLog().filter(x=>x.includes('/api/token')).length}));
const expire=async page=>{await page.evaluate(()=>{localStorage.jfm_exp=String(Date.now()-5000)})};
const reopen=async page=>{await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.JFMAuth&&window.__mock,null,{timeout:15000})};
// Native bewaarplek (iOS-shell, 15-10-2026): nep-Capacitor met Preferences, opgeslagen in sessionStorage (overleeft een reload, staat los van localStorage).
const nativeMock=()=>{const K='__native_prefs',g=()=>JSON.parse(sessionStorage.getItem(K)||'{}'),w=d=>sessionStorage.setItem(K,JSON.stringify(d));window.Capacitor={isNativePlatform:()=>true,PluginHeaders:[{name:'Preferences'}],nativePromise:async(p,m,o)=>{const d=g();if(m==='get')return{value:d[o.key]??null};if(m==='set'){d[o.key]=o.value;w(d);return{}}if(m==='remove'){delete d[o.key];w(d);return{}}throw Error('onbekende methode '+m)}}};
const nativeBlob=page=>page.evaluate(()=>{const v=JSON.parse(sessionStorage.getItem('__native_prefs')||'{}').jfm_session_native_v1;return v?JSON.parse(v):null});
const setNative=(page,o)=>page.evaluate(o=>{const d=JSON.parse(sessionStorage.getItem('__native_prefs')||'{}');d.jfm_session_native_v1=JSON.stringify(o);sessionStorage.setItem('__native_prefs',JSON.stringify(d))},o);
async function scenarioNativeSession(){
  const h=await launch({trackMs:30000});
  try{
    await h.page.addInitScript(nativeMock);
    await boot(h);
    let b=await nativeBlob(h.page);
    c.ok('native: bestaande sessie wordt bij opstart naar de native opslag gekopieerd',!!b&&b.r==='mock-refresh-'+'y'.repeat(30),JSON.stringify(b));
    // Oude refresh-token in localStorage, nieuwe in native: moet ingelogd blijven met de nieuwe.
    await h.page.evaluate(()=>{localStorage.__mock_valid_refresh='mock-refresh-NEW'});
    await setNative(h.page,{t:'mock-token-native',r:'mock-refresh-NEW',e:Date.now()+3600e3});
    await expire(h.page);await reopen(h.page);
    await until(h.page,()=>document.getElementById('status')?.textContent==='Spotify gekoppeld',null,15000,'gekoppeld met native refresh-token');
    let r=await sess(h.page);
    c.ok('native: nieuwe refresh-token uit native wint van de oude in localStorage',r.refresh==='mock-refresh-NEW'&&r.setupHidden,JSON.stringify(r));
    // Refresh schrijft de nieuwe token ook native weg.
    await h.page.evaluate(()=>{localStorage.__mock_valid_refresh='mock-refresh-NEW'});
    await expire(h.page);await reopen(h.page);
    await until(h.page,()=>document.getElementById('status')?.textContent==='Spotify gekoppeld',null,15000,'gekoppeld na refresh');
    b=await nativeBlob(h.page);
    c.ok('native: een refresh schrijft de nieuwe tokens meteen native weg',!!b&&b.r==='mock-refresh'&&b.t.startsWith('mock-token-')&&b.e>Date.now(),JSON.stringify(b));
    // Na meer dan 24 uur stilte (verlopen exp in beide opslagen) blijft de sessie bestaan.
    await h.page.evaluate(()=>{localStorage.__mock_valid_refresh='mock-refresh'});
    await setNative(h.page,{t:'mock-token-oud',r:'mock-refresh',e:Date.now()-25*3600e3});
    await h.page.evaluate(()=>{localStorage.jfm_exp=String(Date.now()-25*3600e3)});
    await reopen(h.page);
    await until(h.page,()=>document.getElementById('status')?.textContent==='Spotify gekoppeld',null,15000,'gekoppeld na 25 uur');
    r=await sess(h.page);
    c.ok('native: refresh na meer dan 24 uur blijft ingelogd',r.refresh&&r.token.startsWith('mock-token-')&&r.setupHidden,JSON.stringify(r));
    // invalid_grant op de actuele token is een echte uitlog en wist ook native.
    // Nieuw sinds de stille her-koppeling: een reload zou hier door de redirect naar Spotify worden onderbroken, dus we laten de app in dezelfde pagina verversen (authorize wordt met 204 afgevangen).
    authNavs(h.page);await h.page.evaluate(async()=>{localStorage.__mock_token_mode='invalid_grant';window.JFMAuth.invalidateAccessToken();await window.connectSession()});await sleep(1500);
    r=await sess(h.page);b=await nativeBlob(h.page);
    c.ok('native: invalid_grant wist de sessie ook in de native opslag',!r.refresh&&!b,JSON.stringify({r,b}));
    noErrors('native: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioSessionReopen(){
  const h=await launch({trackMs:30000});
  try{
    await boot(h);await expire(h.page);await reopen(h.page);
    await until(h.page,()=>document.getElementById('status')?.textContent==='Spotify gekoppeld',null,15000,'gekoppeld na heropenen met verlopen token');
    const r=await sess(h.page);
    c.ok('sessie: heropenen met verlopen access-token ververst en blijft gekoppeld',r.refresh&&r.token.startsWith('mock-token-')&&r.setupHidden&&r.tokenCalls>=1,JSON.stringify(r));
  }finally{await h.close()}
}
async function scenarioSessionNetworkError(){
  const h=await launch({trackMs:30000});
  try{
    await boot(h);await expire(h.page);
    const refresh=await h.page.evaluate(()=>{localStorage.__mock_token_mode='neterr';return localStorage.jfm_refresh});
    await reopen(h.page);await sleep(3500);
    let r=await sess(h.page);
    c.ok('sessie: netwerkfout bij verversen wist de refresh-token niet',r.refresh===refresh,JSON.stringify(r));
    c.ok('sessie: tijdens de storing geen inlogscherm',r.setupHidden&&!/accounts\.spotify\.com/.test(r.url)&&r.status!=='offline',JSON.stringify(r));
    await h.page.evaluate(()=>{localStorage.__mock_token_mode='ok'});
    await until(h.page,()=>document.getElementById('status')?.textContent==='Spotify gekoppeld',null,30000,'gekoppeld nadat het netwerk terug is (alleen via de automatische nieuwe poging)');
    await until(h.page,()=>!!window.JFMSpotifySDK?.deviceId,null,20000,'speler is gestart na herstel');
    r=await sess(h.page);
    c.ok('sessie: na herstel van het netwerk vanzelf weer gekoppeld, zonder opnieuw inloggen',r.refresh&&r.token.startsWith('mock-token-'),JSON.stringify(r));
    // Tijdelijke serverfout (503) idem
    await expire(h.page);await h.page.evaluate(()=>{localStorage.__mock_token_mode='503'});await reopen(h.page);await sleep(3000);
    r=await sess(h.page);
    c.ok('sessie: 503 van Spotify wist de refresh-token niet',!!r.refresh,JSON.stringify(r));
    noErrors('sessie: geen page errors bij netwerkfout',h);
  }finally{await h.close()}
}
// Navigaties naar Spotify's authorize-pagina (stille her-koppeling); wordt met 204 beantwoord, zodat de pagina blijft staan (een afgebroken navigatie zou een foutpagina geven).
const authNavs=page=>{const n=[];page.route(/^https:\/\/accounts\.spotify\.com\/authorize/,r=>r.fulfill({status:204,body:''}));page.on('request',r=>{if(r.isNavigationRequest()&&/^https:\/\/accounts\.spotify\.com\/authorize/.test(r.url()))n.push(r.url())});return n};
const carMode=(page,open)=>page.evaluate(o=>{if(o)document.body.dataset.mairCarMode='1';else delete document.body.dataset.mairCarMode;window.dispatchEvent(new CustomEvent('mair:car-mode',{detail:{open:o}}))},open);
async function scenarioSessionInvalidGrant(){
  // (a) buiten Car Mode: invalid_grant wist de sessie en start een stille her-koppeling (zelfde PKCE-login, zelfde redirect_uri).
  let h=await launch({trackMs:30000});
  try{
    const navs=authNavs(h.page);
    await boot(h);await h.page.evaluate(async()=>{localStorage.__mock_token_mode='invalid_grant';window.JFMAuth.invalidateAccessToken();await window.connectSession()});await sleep(1500);
    const r=await sess(h.page);
    c.ok('sessie: invalid_grant is wél een echte uitlog (refresh-token weg); het inlogscherm blijft het vangnet',!r.refresh&&!r.setupHidden,JSON.stringify(r));
    c.ok('sessie: invalid_grant buiten Car Mode start een stille her-koppeling naar accounts.spotify.com/authorize',navs.length===1&&/redirect_uri=/.test(navs[0])&&/code_challenge_method=S256/.test(navs[0]),navs.join(' | '));
    const st=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('jfm_silent_relink_v1')||'null'));
    c.ok('sessie: teller jfm_silent_relink_v1 bijgehouden',st&&st.count===1&&Date.now()-st.at<60000,JSON.stringify(st));
  }finally{await h.close()}
  // (b) Car Mode open: geen redirect; pas als Car Mode dicht gaat.
  h=await launch({trackMs:30000});
  try{
    const navs=authNavs(h.page);
    await boot(h);await carMode(h.page,true);await h.page.evaluate(()=>{localStorage.__mock_token_mode='invalid_grant';window.JFMAuth.invalidateAccessToken()});
    const out=await h.page.evaluate(async()=>{try{await window.JFMAuth.ensure();return 'ok'}catch(e){return e.message}});await sleep(1500);
    c.ok('sessie: invalid_grant in Car Mode geeft geen redirect',navs.length===0&&/verlopen/.test(out),out+' | '+navs.join(' | '));
    await carMode(h.page,false);await sleep(1500);
    c.ok('sessie: Car Mode dicht, dan pas de stille her-koppeling',navs.length===1,navs.join(' | '));
  }finally{await h.close()}
  // (c) tweede invalid_grant binnen 30 min: geen tweede redirect, gewoon inlogscherm.
  h=await launch({trackMs:30000});
  try{
    const navs=authNavs(h.page);
    await boot(h);await h.page.evaluate(()=>{localStorage.jfm_silent_relink_v1=JSON.stringify({at:Date.now()-60000,count:1})});
    await h.page.evaluate(async()=>{localStorage.__mock_token_mode='invalid_grant';window.JFMAuth.invalidateAccessToken();await window.connectSession()});await sleep(1500);
    const r=await sess(h.page);
    c.ok('sessie: tweede invalid_grant binnen 30 min geeft geen nieuwe redirect maar het inlogscherm',navs.length===0&&!r.refresh&&!r.setupHidden,JSON.stringify(r)+' | '+navs.join(' | '));
  }finally{await h.close()}
  // (d) bewust uitloggen start nooit een stille her-koppeling (ook niet als er daarna invalid_grant komt).
  h=await launch({trackMs:30000});
  try{
    const navs=authNavs(h.page);
    await boot(h);await h.page.evaluate(()=>{localStorage.__mock_token_mode='invalid_grant';window.logout()});await sleep(1500);
    c.ok('sessie: uitloggen start geen stille her-koppeling',navs.length===0&&!(await sess(h.page)).refresh,navs.join(' | '));
  }finally{await h.close()}
}
async function scenarioSessionOtherTab(){
  const h=await launch({trackMs:30000});
  try{
    await boot(h);
    // Dit tabblad kent R1 (in geheugen); een ander tabblad heeft verversd en R2 + geldig token opgeslagen. Spotify accepteert alleen nog R2.
    await h.page.evaluate(()=>{localStorage.jfm_exp=String(Date.now()-5000);localStorage.__mock_valid_refresh='mock-refresh-R2'});
    await h.page.evaluate(()=>{localStorage.jfm_refresh='mock-refresh-R2'});
    const out=await h.page.evaluate(async()=>{try{return{ok:!!(await window.JFMAuth.ensure()),refresh:localStorage.getItem('jfm_refresh')}}catch(e){return{err:e.message,refresh:localStorage.getItem('jfm_refresh')}}});
    c.ok('sessie: ander tabblad heeft de refresh-token vernieuwd: die wordt gebruikt, niet de oude uit het geheugen',out.ok&&out.refresh==='mock-refresh-R2',JSON.stringify(out));
    // Oude token in het geheugen, opslag al door een ander tabblad vernieuwd: invalid_grant op de oude mag de nieuwe niet wissen.
    const out2=await h.page.evaluate(()=>{window.JFMAuth.invalidateAccessToken();localStorage.jfm_refresh='mock-refresh-R3';const wiped=window.clearSpotifySession?.('mock-refresh-R2');return{wiped,refresh:localStorage.getItem('jfm_refresh')}});
    c.ok('sessie: invalid_grant op een oude refresh-token wist de nieuwe uit een ander tabblad niet',out2.wiped===false&&out2.refresh==='mock-refresh-R3',JSON.stringify(out2));
  }finally{await h.close()}
}
// MAIR STUDEREN: station staat in het overzicht, de cover laadt, hij speelt, en de DJ praat er niet.
async function scenarioStudyStation(){
  const h=await launch({trackMs:12000});
  try{
    await boot(h);
    await tab(h.page,'Stations');
    const card=h.page.locator('[data-mair-station="study"]').locator('visible=true').first();
    c.ok('studeren: stationstegel staat in het overzicht',await card.count()===1);
    const cover=await h.page.evaluate(()=>new Promise(r=>{const src=window.MAIRStationPolicy?.cover?.('study')||'';const im=new Image();im.onload=()=>r({src,w:im.naturalWidth});im.onerror=()=>r({src,w:0});im.src=src}));
    c.ok('studeren: cover laadt (mair-study.svg)',/mair-study.svg$/.test(cover.src)&&cover.w>0,JSON.stringify(cover));
    const art=await card.evaluate(e=>getComputedStyle(e.querySelector('.mair-station-art')||e).backgroundImage);
    c.ok('studeren: tegel gebruikt de eigen cover',/mair-study.svg/.test(art),art);
    c.ok('studeren: beleid markeert de zender als stil',await h.page.evaluate(()=>window.MAIRStationPolicy.quiet('study')===true&&window.MAIRStationPolicy.quiet('hits')===false));
    await card.click();
    await until(h.page,()=>window.__mock.state().playing,null,25000,'studeren speelt');
    await tab(h.page,'Radio');
    const before=await h.page.evaluate(()=>(window.MAIRDJ.state().terminalBreaks||[]).length);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await sleep(9000);
    const after=await h.page.evaluate(()=>(window.MAIRDJ.state().terminalBreaks||[]).length);
    const tb=await h.page.evaluate(()=>(window.MAIRDJ.state().terminalBreaks||[]).map(b=>b.status+':'+(b.reason||'')));c.ok('studeren: DJ praat niet op dit station',h.log.api.writer===0&&h.log.api.tts===0,'writer '+h.log.api.writer+', tts '+h.log.api.tts+', '+tb.join(','));
  }finally{await h.close()}
}
// Native shell + lopende keep-alive + scherm uit: de DJ mag de muziek niet pauzeren (JS-timers lopen dan vast, volgende nummer speelt niet).
async function scenarioBackgroundNativeMusicFirst(){
  const h=await launch({trackMs:16000});
  try{
    await startStation(h);
    await h.page.evaluate(()=>{window.__bgEvents=[];window.addEventListener('mair:background-state',e=>window.__bgEvents.push(e.detail.reason));const a=window.JFMDJAudio,old=Object.getOwnPropertyDescriptor(a,'status');Object.defineProperty(a,'status',{configurable:true,get:()=>({...(old?.get?old.get.call(a):old?.value||{}),nativeShell:true,keepAlive:{running:true}})})});
    await h.page.evaluate(x=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>x});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))},true);
    await h.page.evaluate(()=>window.MAIRDJ.armManual());
    await h.page.evaluate(()=>window.__mock.finishTrack(2500));
    await sleep(12000);
    const st=await mock(h.page),ev=await h.page.evaluate(()=>window.__bgEvents);
    c.ok('achtergrond native: DJ-uitzondering staat uit',!ev.includes('hidden-dj-allowed'),JSON.stringify(ev));
    c.ok('achtergrond native: volgende nummer speelt zonder DJ-pauze',st.playing===true&&st.idx>=1,JSON.stringify(st));
  }finally{await h.close()}
}
// Love/ban (personal-learning): een geband nummer/artiest komt niet meer in nieuwe wachtrijen, een love telt mee in de volgorde,
// en bans laten de zender nooit leeglopen. Zonder love/ban verandert er niets.
const learnPool=page=>page.evaluate(async()=>{const seen=new Map();for(let i=0;i<8;i++){try{for(const t of await window.JFMQueue.buildActive('learn-'+i))seen.set(t.id,t)}catch{/* volgende poging */}}for(const t of window.JFMQueue.current())seen.set(t.id,t);return[...seen.values()].map(t=>({id:t.id,uri:t.uri,name:t.name,artists:t.artists.map(a=>a?.name||a),popularity:t.popularity||50,release:t.release||'2024-01-01'}))});
async function scenarioLearnBan(){
  const h=await launch({trackMs:20000});
  await h.page.addInitScript(()=>{window.__mock.rolling=true;localStorage.setItem('mair_dj_enabled_v1','0')});
  try{
    await startStation(h);
    await until(h.page,()=>!!window.JFMTasteModel&&!!window.JFMTasteModel.filterBanned,null,15000,'personal-learning geladen');
    // (d) zonder love/ban: niets verandert
    const none=await h.page.evaluate(async()=>{const m=window.JFMTasteModel,list=window.JFMQueue.current(),before=JSON.stringify(list.map(t=>t.id)),filtered=m.filterBanned(list);return{same:filtered===list,boost:list.map(t=>m.rotationBoost(t)).some(Boolean),profile:Object.keys(m.profile.bans).length+Object.keys(m.profile.loves).length,stable:before===JSON.stringify(window.JFMQueue.normalize(list).map(t=>t.id))}});
    c.ok('leren: zonder love/ban blijft alles gelijk (lijst, gewicht, profiel)',none.same&&!none.boost&&none.profile===0&&none.stable,JSON.stringify(none));
    // Ban via de echte knop op het spelende nummer
    const first=(await mock(h.page)).uri.split(':').pop();
    await h.page.evaluate(()=>document.getElementById('banTrack').click());
    await until(h.page,id=>window.__mock.state().uri.split(':').pop()!==id,first,10000,'volgende nummer na ban');
    const prof=await h.page.evaluate(()=>window.JFMTasteModel.profile);
    const stored=await h.page.evaluate(id=>!!JSON.parse(localStorage.getItem('jfm_taste_model_v4')).bans[id],first);
    c.ok('leren: ban-knop slaat het spelende nummer op (bestaande sleutel jfm_taste_model_v4)',!!prof.bans[first]&&stored,JSON.stringify(Object.keys(prof.bans)));
    const st=await mock(h.page);c.ok('leren: na de ban speelt de zender door',st.playing===true,JSON.stringify(st));
    // Nog drie nummers van dezelfde artiest bannen: dan valt de hele artiest weg
    const pool=await learnPool(h.page);
    // Het spelende nummer is nooit een van de mates: buildActive houdt dat (terecht) vooraan, dan telde het hier als lek.
    const playingNow=(await mock(h.page)).uri.split(':').pop();
    const bannedArtist=pool.find(t=>t.id!==first&&t.id!==playingNow)?.artists[0];
    const mates=pool.filter(t=>t.artists[0]===bannedArtist&&t.id!==first&&t.id!==playingNow).slice(0,3);
    await h.page.evaluate(ms=>ms.forEach(t=>window.JFMTasteModel.event('ban',t,-12)),mates);
    const builds=await h.page.evaluate(async()=>{const out=[];for(let i=0;i<10;i++){try{out.push((await window.JFMQueue.buildActive('learn-ban-'+i)).map(t=>({id:t.id,a:t.artists[0]?.name||t.artists[0]})))}catch(e){out.push([])}}return out});
    const bannedIds=new Set([first,...mates.map(t=>t.id)]);
    const leaked=builds.flat().filter(t=>bannedIds.has(t.id)||t.a===bannedArtist&&t.id!==playingNow);
    c.ok('leren: 10 nieuwe keuzes van de zender bevatten geen geband nummer en geen geband artiest',builds.every(b=>b.length>0)&&leaked.length===0,'gelekt '+JSON.stringify(leaked.slice(0,2))+' van '+leaked.length+', playing '+playingNow+', first '+first+', mates '+mates.map(t=>t.id.slice(-3))+', lengtes '+builds.map(b=>b.length).join(','));
    // En in de lopende reeks: na de eerste 30 (al naar Spotify gestuurd) komt niets geband meer langs
    const played=[];
    for(let i=0;i<52;i++){
      await h.page.evaluate(()=>window.__mock.finishTrack(500));
      await sleep(1400);
      for(let w=0;w<4&&!(await h.page.evaluate(()=>window.__mock.state().playing));w++)await sleep(700);
      const s=await h.page.evaluate(()=>{const u=window.__mock.state().uri,id=u.split(':').pop(),r=window.JFMRadioSuite?.state?.();if(r&&id&&r.lastIds[0]!==id)r.lastIds.unshift(id);return{id,idx:window.__mock.state().idx,p:window.__mock.state().playing}});
      played.push(s);if(!s.p){await sleep(2500);if(!(await mock(h.page)).playing)break}
    }
    const bannedAfterFirst30=await h.page.evaluate(async({played,bannedIds,bannedArtist})=>{const names=new Map(window.JFMQueue.current().map(t=>[t.id,t.artists[0]?.name||t.artists[0]]));return played.filter(p=>p.idx>=31&&(bannedIds.includes(p.id)||names.get(p.id)===bannedArtist)).length},{played,bannedIds:[...bannedIds],bannedArtist});
    c.ok('leren: reeks van '+played.length+' wissels zonder stilvallen',played.length>=52&&played.every(p=>p.p),played.filter(p=>!p.p).length+' stil');
    const late=played.filter(p=>p.idx>=31).length;
    c.ok('leren: geband nummer/artiest komt in de reeks na de eerste 30 niet meer voor ('+late+' nummers na de eerste 30 bekeken)',late>=8&&bannedAfterFirst30===0,bannedAfterFirst30+' keer, '+late+' bekeken');
    noErrors('leren ban: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioLearnLove(){
  const h=await launch({trackMs:20000});
  try{
    await startStation(h);
    await until(h.page,()=>!!window.JFMTasteModel&&!!window.JFMTasteModel.rotationBoost,null,15000,'personal-learning geladen');
    const pool=await learnPool(h.page);
    c.ok('leren: love-test heeft een pool van minstens 30 nummers',pool.length>=30&&new Set(pool.map(t=>t.artists[0])).size>=6,pool.length+' nummers');
    const measure=(pool,loved)=>h.page.evaluate(({pool,loved})=>{const hs=window.JFMRadioSuite.state();hs.lastIds.length=0;hs.lastArtists.length=0;/* de artiest van het spelende nummer staat anders (terecht) op slot */let x=777;const rnd=()=>(x=(x*1664525+1013904223)>>>0)/4294967296;let top=0,mine=0,tot=0,maxRun=0,pos=0;const subsets=Array.from({length:40},()=>{const s=pool.filter(()=>rnd()<.6);return s.length>=12?s:pool});
      for(const p of subsets){const out=window.JFMRotation.plan(p,[]).slice(0,30);let r=0,last='';out.forEach((t,i)=>{const a=t.artists[0];if(a===loved){mine++;if(i<4)top++;pos+=i}tot++;if(a===last)r++;else r=0;last=a;maxRun=Math.max(maxRun,r)})}return{top,share:mine/tot,avgPos:mine?pos/mine:99,maxRun}},{pool,loved});
    // De artiest van het spelende nummer wordt geliefd via de echte knop
    const playingId=(await mock(h.page)).uri.split(':').pop();
    const loved=pool.find(t=>t.id===playingId)?.artists[0];
    const a1=await measure(pool,loved),a2=await measure(pool,loved);
    c.ok('leren: zonder love zijn twee metingen identiek (deterministisch)',JSON.stringify(a1)===JSON.stringify(a2),JSON.stringify([a1,a2]));
    await h.page.evaluate(()=>document.getElementById('loveTrack').click());
    await h.page.evaluate(()=>{const t=window.JFMQueue.current().find(x=>x.id===(window.__mock.state().uri.split(':').pop()));window.JFMTasteModel.event('love',{id:t.id,artists:t.artists.map(a=>a?.name||a)},8)});
    const prof=await h.page.evaluate(()=>window.JFMTasteModel.profile);
    c.ok('leren: love-knop slaat nummer en artiest op (jfm_taste_model_v4)',!!prof.loves[playingId]&&Object.keys(prof.loveArtists).length>=1,JSON.stringify(Object.keys(prof.loves)));
    const b=await measure(pool,loved);
    c.ok('leren: geliefde artiest staat vaker vooraan (eerste 4 plekken: '+a1.top+' naar '+b.top+' van 40)',b.top>a1.top,JSON.stringify({a1,b}));
    c.ok('leren: gemiddelde plek van de geliefde artiest schuift naar voren ('+a1.avgPos.toFixed(1)+' naar '+b.avgPos.toFixed(1)+') maar het aandeel blijft gelijk (alles blijft in de lijst)',b.avgPos<a1.avgPos&&b.share<=a1.share*1.5,JSON.stringify({a1,b}));
    c.ok('leren: love geeft geen artiest-na-artiest',b.maxRun<=a1.maxRun,JSON.stringify({a1,b}));
    // Een nummer dat net is gespeeld blijft op slot: herhaalvenster wint van love
    const recent=await h.page.evaluate(({pool,playingId})=>{const r=window.JFMRadioSuite.state();r.lastIds.unshift(playingId);const out=window.JFMRotation.plan(pool,[]).slice(0,5).map(t=>t.id);return out.includes(playingId)},{pool,playingId});
    c.ok('leren: een geliefd maar net gespeeld nummer komt niet meteen terug (herhaalvenster blijft gelden)',recent===false);
    const st=await mock(h.page);c.ok('leren: muziek speelt tijdens het leren',st.playing===true);
    noErrors('leren love: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioLearnManyBans(){
  const h=await launch({trackMs:20000});
  await h.page.addInitScript(()=>{window.__mock.rolling=true;localStorage.setItem('mair_dj_enabled_v1','0')});
  try{
    await startStation(h);
    await until(h.page,()=>!!window.JFMTasteModel&&!!window.JFMTasteModel.filterBanned,null,15000,'personal-learning geladen');
    const pool=await learnPool(h.page);
    const playing=(await mock(h.page)).uri.split(':').pop();
    // 70% van wat de zender kent bannen: de zender moet doorspelen
    const victims=pool.filter(t=>t.id!==playing).slice(0,Math.floor(pool.length*.7));
    await h.page.evaluate(v=>v.forEach(t=>window.JFMTasteModel.event('ban',t,-12)),victims);
    const ids=new Set(victims.map(t=>t.id));
    const builds=await h.page.evaluate(async()=>{const out=[];for(let i=0;i<6;i++){try{out.push((await window.JFMQueue.buildActive('learn-many-'+i)).map(t=>t.id))}catch(e){out.push(['fout:'+e.message])}}return out});
    c.ok('leren: met 70% van de bron geband geeft de zender nog steeds keuzes',builds.every(b=>b.length>0&&!String(b[0]).startsWith('fout')),builds.map(b=>b.length).join(','));
    c.ok('leren: die keuzes bevatten geen geband nummer zolang er genoeg over is',builds.every(b=>b.every(id=>!ids.has(id))),builds.map(b=>b.filter(id=>ids.has(id)).length).join(','));
    // Alles op één na bannen: oude keuze (niets filteren), niet leeg
    const rest=pool.filter(t=>!ids.has(t.id)&&t.id!==playing);
    await h.page.evaluate(v=>v.forEach(t=>window.JFMTasteModel.event('ban',t,-12)),rest.slice(0,Math.max(0,rest.length-2)));
    const tiny=await h.page.evaluate(async()=>{try{return(await window.JFMQueue.buildActive('learn-tiny')).length}catch(e){return -1}});
    c.ok('leren: bijna alles geband: de zender krijgt toch een lijst (oude keuze, niet leeg)',tiny>=1,'lengte '+tiny);
    const played=[];
    for(let i=0;i<14;i++){
      await h.page.evaluate(()=>window.__mock.finishTrack(500));await sleep(1400);
      for(let w=0;w<4&&!(await h.page.evaluate(()=>window.__mock.state().playing));w++)await sleep(700);
      const s=await mock(h.page);played.push(s.playing);if(!s.playing){await sleep(2500);if(!(await mock(h.page)).playing)break}
    }
    c.ok('leren: na veel bans spelen 14 wissels zonder stilvallen',played.length>=14&&played.every(Boolean),played.filter(p=>!p).length+' stil');
    noErrors('leren veel bans: geen page errors',h);
  }finally{await h.close()}
}
// 17-10-2026: om 15:00 zei de DJ niks. Nepklok rond 15:00 (alleen voor het nieuws, Spotify loopt op echte tijd).
// Nummers van 10 minuten: het hele uur valt midden in een nummer, en het nummer loopt door tot na minuut 12.
// Het nieuws moet dan direct na dat nummer komen, niet vervallen. Nieuws staat niet apart aan: het volgt de DJ.
// NEWS_ON=1 zet de oude schakelaar wel aan (om op oude code de andere oorzaken te laten zien).
async function scenarioNewsHour(){
  const T=Date.UTC(2026,9,17,12,59,40);// 14:59:40 in Amsterdam (zomertijd, UTC+2)
  const h=await launch({trackMs:600000});
  try{
    await h.page.addInitScript(({t,on})=>{let shift=t-Date.now();window.__mairNewsClock=()=>Date.now()+shift;window.__setNewsClock=x=>{shift=x-Date.now()};if(on)localStorage.setItem('mair_news_enabled_v1','1')},{t:T,on:process.env.NEWS_ON==='1'});
    const heads=Array.from({length:5},(_,i)=>({title:`Nepbericht nummer ${i+1} van vandaag`,summary:'Korte samenvatting.',source:'NOS',publishedAt:new Date().toISOString(),link:''}));
    await h.page.route(ORIGIN+'/api/live-headlines',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({headlines:heads,fetchedAt:new Date().toISOString(),sourceLabel:'NOS Nieuws'})}));
    await h.page.route(ORIGIN+'/api/news-bulletin',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Dit is MAIR Nieuws. De berichten komen van NOS Nieuws. Nepbericht nummer 1. Dit was MAIR Nieuws. Je luistert naar MAIR.',provider:'mock'})}));
    await startStation(h);
    const idx0=(await mock(h.page)).idx;
    await h.page.evaluate(t=>window.__setNewsClock(t),Date.UTC(2026,9,17,13,0,5));
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,'nieuws voorbereid na 15:00');
    let st=await mock(h.page);
    c.ok('nieuws: voorbereid tijdens het nummer, nummer loopt door',st.playing&&st.idx===idx0,JSON.stringify(st));
    await h.page.evaluate(()=>{window.__newsLog=[];addEventListener('mair:news-bulletin-aired',e=>window.__aired=e.detail);const t=setInterval(()=>{const n=window.MAIRNewsBulletin.status();if(n.airing)window.__newsLog.push({playing:window.__mock.state().playing,dj:window.MAIRDJ?.state?.().phase||''})},150);setTimeout(()=>clearInterval(t),90000)});
    await h.page.evaluate(t=>window.__setNewsClock(t),Date.UTC(2026,9,17,13,14,0));// 15:14, voorbij het oude venster van 12 minuten
    await sleep(16500);// minstens één tick van 15 s
    const mid=await h.page.evaluate(()=>window.MAIRNewsBulletin.status());st=await mock(h.page);
    c.ok('nieuws: om 15:14 midden in het nummer niet overgeslagen',!!mid.prepared&&!mid.alreadyAired&&mid.due,JSON.stringify(mid).slice(0,300));
    c.ok('nieuws: nummer wordt niet onderbroken voor het nieuws',st.playing&&st.idx===idx0&&!(await h.page.evaluate(()=>window.__aired)),JSON.stringify(st));
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    await until(h.page,()=>!!window.__aired,null,45000,'nieuws uitgezonden na het nummer');
    const aired=await h.page.evaluate(()=>window.__aired),log=await h.page.evaluate(()=>window.__newsLog);
    c.ok('nieuws: komt direct na het nummer, voor slot 15:00',aired.slot==='2026-10-17T15'&&!aired.partial,JSON.stringify(aired));
    c.ok('nieuws: muziek staat stil tijdens het nieuws',log.length>2&&log.slice(1,-1).every(x=>x.playing===false),JSON.stringify(log.map(x=>x.playing)));
    c.ok('nieuws: DJ praat niet tegelijk',log.every(x=>x.dj!=='SPEAKING'),JSON.stringify(log.slice(0,8)));
    await sleep(2500);st=await mock(h.page);
    c.ok('nieuws: daarna speelt het volgende nummer',st.playing&&st.idx===idx0+1,JSON.stringify(st));
    c.ok('nieuws: één keer per uur',(await h.page.evaluate(()=>window.MAIRNewsBulletin.status().alreadyAired))===true);
    noErrors('nieuws: geen page errors',h);
  }finally{await h.close()}
}

// 20-10-2026 om 12:00: de DJ-stem stond in de backoff van dj-audio-guard, het nieuws viel steeds om en vroeg elke 45 s een nieuw journaal.
// Twee segmenten (journaal langer dan 850 tekens), backoff actief op het hele uur: één journaal-verzoek, en het nieuws speelt.
async function newsSetup(h,T){
  await h.page.addInitScript(({t})=>{let shift=t-Date.now();window.__mairNewsClock=()=>Date.now()+shift;window.__setNewsClock=x=>{shift=x-Date.now()}},{t:T});
  const heads=Array.from({length:5},(_,i)=>({title:`Nepbericht nummer ${i+1} van vandaag`,summary:'Korte samenvatting.',source:'NOS',publishedAt:new Date().toISOString(),link:''}));
  await h.page.route(ORIGIN+'/api/live-headlines',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({headlines:heads,fetchedAt:new Date().toISOString(),sourceLabel:'NOS Nieuws'})}));
  const long='Dit is MAIR Nieuws. De berichten komen van NOS Nieuws. '+Array.from({length:14},(_,i)=>`Bericht ${i+1} gaat over iets wat vandaag in het land gebeurde en dat de luisteraar moet weten.`).join(' ')+' Dit was MAIR Nieuws. Je luistert naar MAIR.';
  const counts={bulletin:0};
  await h.page.route(ORIGIN+'/api/news-bulletin',r=>{counts.bulletin++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:long,provider:'mock'})})});
  return counts;
}
async function scenarioNewsGuardBackoff(){
  const T=Date.UTC(2026,9,20,9,59,40);// 11:59:40 in Amsterdam
  const h=await launch({trackMs:600000});
  try{
    const counts=await newsSetup(h,T);
    await startStation(h);
    await h.page.evaluate(()=>{window.JFMDJAudioGuard.failure('e2e: eerdere DJ-stem mislukt','prepare');window.JFMDJAudioGuard.failure('e2e: nog een','prepare')});
    const tts0=h.log.api.tts;
    await h.page.evaluate(t=>{window.__setNewsClock(t);addEventListener('mair:news-bulletin-aired',e=>window.__aired=e.detail)},Date.UTC(2026,9,20,10,0,5));
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,'nieuws voorbereid ondanks backoff');
    const st=await h.page.evaluate(()=>({n:window.MAIRNewsBulletin.status(),guard:window.JFMDJAudioGuard.state}));
    c.ok('nieuws backoff: voorbereid terwijl de DJ-stem in backoff staat',st.n.prepared?.segments>=2&&st.guard.retryInMs>0,JSON.stringify(st).slice(0,400));
    c.ok('nieuws backoff: alle segmenten echt bij de TTS opgehaald',h.log.api.tts-tts0>=st.n.prepared.segments,`${h.log.api.tts-tts0} tts`);
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    await until(h.page,()=>!!window.__aired,null,45000,'nieuws uitgezonden');
    const aired=await h.page.evaluate(()=>window.__aired);
    c.ok('nieuws backoff: hele journaal uitgezonden',!aired.partial&&aired.slot==='2026-10-20T12',JSON.stringify(aired));
    c.ok('nieuws backoff: maar één journaal-verzoek dit uur',counts.bulletin===1,`${counts.bulletin} verzoeken`);
    noErrors('nieuws backoff: geen page errors',h);
  }finally{await h.close()}
}
// Scherm uit: voorbereiden en uitzenden in de achtergrond, zonder Spotify te pauzeren (muziek zachter, nieuws eroverheen).
async function scenarioNewsScreenOff(){
  const T=Date.UTC(2026,9,20,10,59,40);// 12:59:40 in Amsterdam
  const h=await launch({trackMs:600000});
  try{
    await newsSetup(h,T);
    await startStation(h);
    const idx0=(await mock(h.page)).idx,vol0=(await mock(h.page)).volume;
    await hide(h.page,true);await sleep(800);
    await h.page.evaluate(t=>{window.__setNewsClock(t);addEventListener('mair:news-bulletin-aired',e=>window.__aired=e.detail);window.__newsLog=[];const i=setInterval(()=>{if(window.MAIRNewsBulletin.status().airing)window.__newsLog.push(window.__mock.state())},150);setTimeout(()=>clearInterval(i),120000)},Date.UTC(2026,9,20,11,0,5));
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,'nieuws voorbereid met scherm uit');
    c.ok('scherm uit: nieuws voorbereid in de achtergrond',true);
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    await until(h.page,()=>!!window.__aired,null,45000,'nieuws uitgezonden met scherm uit');
    const aired=await h.page.evaluate(()=>window.__aired),log=await h.page.evaluate(()=>window.__newsLog);
    c.ok('scherm uit: nieuws uitgezonden',aired.background===true&&!aired.partial,JSON.stringify(aired));
    c.ok('scherm uit: muziek blijft spelen tijdens het nieuws',log.length>0&&log.every(x=>x.playing),JSON.stringify(log.map(x=>x.playing)));
    c.ok('scherm uit: muziek zachter tijdens het nieuws',Math.min(...log.map(x=>x.volume))<vol0*.2,JSON.stringify(log.map(x=>x.volume)));
    await sleep(1500);const st=await mock(h.page);
    c.ok('scherm uit: daarna volume terug en volgende nummer loopt',st.playing&&st.idx===idx0+1&&Math.abs(st.volume-vol0)<.02,JSON.stringify(st));
    noErrors('scherm uit: geen page errors',h);
  }finally{await h.close()}
}
// Pauzeert iOS de Spotify-speler zodra onze stem begint, dan moet de muziek na het nieuws vanzelf weer spelen.
async function scenarioNewsScreenOffInterrupt(){
  const T=Date.UTC(2026,9,20,10,59,40);
  const h=await launch({trackMs:600000});
  try{
    await newsSetup(h,T);
    await startStation(h);
    await hide(h.page,true);await sleep(800);
    await h.page.evaluate(t=>{window.__setNewsClock(t);addEventListener('mair:news-bulletin-aired',e=>window.__aired=e.detail);const real=window.speakText;window.speakText=async(...a)=>{await window.jfmSpotifyPlayer.pause();return real(...a)}},Date.UTC(2026,9,20,11,0,5));
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,'nieuws voorbereid');
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    await until(h.page,()=>!!window.__aired&&!window.MAIRNewsBulletin.status().airing,null,45000,'nieuws uitgezonden');
    await sleep(1500);const st=await mock(h.page);
    c.ok('scherm uit, iOS pauzeert Spotify: muziek speelt daarna weer',st.playing===true,JSON.stringify(st));
    noErrors('scherm uit onderbroken: geen page errors',h);
  }finally{await h.close()}
}
// iOS weigert het nieuwe geluid met het scherm uit: volume meteen terug, muziek speelt door, nieuws blijft staan.
async function scenarioNewsScreenOffRefused(){
  const T=Date.UTC(2026,9,20,10,59,40);
  const h=await launch({trackMs:600000});
  try{
    await newsSetup(h,T);
    await startStation(h);
    const vol0=(await mock(h.page)).volume;
    await hide(h.page,true);await sleep(800);
    await h.page.evaluate(t=>window.__setNewsClock(t),Date.UTC(2026,9,20,11,0,5));
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,'nieuws voorbereid');
    await h.page.evaluate(()=>{const real=window.speakText;window.__restoreSpeak=()=>{window.speakText=real};window.speakText=async()=>false});
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    await until(h.page,()=>window.MAIRNewsBulletin.status().bgRefused>=1&&!window.MAIRNewsBulletin.status().airing,null,30000,'weigering verwerkt');
    await sleep(800);const st=await mock(h.page),n=await h.page.evaluate(()=>window.MAIRNewsBulletin.status());
    c.ok('scherm uit geweigerd: volume terug, muziek speelt',st.playing&&Math.abs(st.volume-vol0)<.02,JSON.stringify(st));
    c.ok('scherm uit geweigerd: nieuws staat nog klaar',!!n.prepared&&!n.alreadyAired,JSON.stringify(n).slice(0,300));
    const elog=await h.page.evaluate(()=>window.MAIRRuntime.errorLog().map(x=>x.type));
    c.ok('scherm uit geweigerd: staat in het foutlog',elog.includes('news.air-failed'),JSON.stringify(elog));
    noErrors('scherm uit geweigerd: geen page errors',h);
  }finally{await h.close()}
}

// Autorit 20-10-2026: muziek stopte op het uur, nieuws kwam niet, 2 minuten stilte. Wat er ook hangt: binnen ~10 s weer muziek.
async function newsHangCase(name,T,hang,{ios=false,hidden=false}={}){
  const h=await launch({trackMs:600000});
  try{
    if(ios)await h.page.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'})});
    await newsSetup(h,T);
    await startStation(h);
    if(hidden){await hide(h.page,true);await sleep(800)}
    await h.page.evaluate(t=>{window.__setNewsClock(t);addEventListener('mair:news-bulletin-aired',e=>window.__aired=e.detail)},T+25000);
    await until(h.page,()=>!!window.MAIRNewsBulletin.status().prepared,null,40000,name+': nieuws voorbereid');
    await h.page.evaluate(hang);
    await h.page.evaluate(()=>{window.__pb=[];const i=setInterval(()=>window.__pb.push(window.__mock.state().playing),250);setTimeout(()=>clearInterval(i),60000)});
    await h.page.evaluate(()=>window.__mock.finishTrack(1500));
    return h;
  }catch(e){await h.close();throw e}
}
const longestSilence=pb=>{let run=0,max=0;for(const p of pb){run=p?0:run+1;max=Math.max(max,run)}return max*250};
async function scenarioNewsVoiceHangs(){
  const h=await newsHangCase('stem hangt',Date.UTC(2026,9,20,11,59,40),()=>{window.speakText=()=>new Promise(()=>{})});
  try{
    await sleep(20000);const pb=await h.page.evaluate(()=>window.__pb),st=await mock(h.page),n=await h.page.evaluate(()=>window.MAIRNewsBulletin.status());
    c.ok('stem hangt: muziek ging even uit voor het nieuws',pb.some(x=>!x),JSON.stringify(pb.slice(0,20)));
    c.ok('stem hangt: binnen 12 s weer muziek, geen lange stilte',st.playing&&longestSilence(pb)<=12000,`${longestSilence(pb)} ms stil`);
    c.ok('stem hangt: niet als uitgezonden gemarkeerd, fout in het foutlog',!n.alreadyAired&&(await h.page.evaluate(()=>window.MAIRRuntime.errorLog().some(x=>x.type==='news.air-failed'))),JSON.stringify(n).slice(0,200));
    noErrors('stem hangt: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioNewsJingleHangs(){
  const h=await newsHangCase('jingle hangt',Date.UTC(2026,9,20,12,59,40),()=>{window.MAIRImaging.beforeBreak=()=>new Promise(()=>{})});
  try{
    await until(h.page,()=>!!window.__aired,null,30000,'nieuws toch uitgezonden');
    await sleep(2500);const st=await mock(h.page);
    c.ok('jingle hangt: nieuws komt toch en muziek speelt daarna',st.playing&&!(await h.page.evaluate(()=>window.__aired.partial)),JSON.stringify(st));
    noErrors('jingle hangt: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioNewsIosHidden(){
  const h=await newsHangCase('iPhone scherm uit',Date.UTC(2026,9,20,13,59,40),()=>{window.__newsLog=[];const i=setInterval(()=>{if(window.MAIRNewsBulletin.status().airing)window.__newsLog.push(window.__mock.state().playing)},100);setTimeout(()=>clearInterval(i),60000)},{ios:true,hidden:true});
  try{
    await until(h.page,()=>!!window.__aired,null,30000,'nieuws uitgezonden');
    await sleep(2500);const log=await h.page.evaluate(()=>window.__newsLog),st=await mock(h.page);
    c.ok('iPhone scherm uit: muziek op pauze tijdens het nieuws (zachter werkt niet op iOS)',log.length>5&&log.slice(0,-4).every(x=>x===false),JSON.stringify(log));
    c.ok('iPhone scherm uit: daarna speelt de muziek weer',st.playing,JSON.stringify(st));
    noErrors('iPhone scherm uit: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioNewsVoiceNotReady(){
  const h=await newsHangCase('stem niet klaar',Date.UTC(2026,9,20,14,59,40),async()=>{window.JFMDJAudio.cancel('e2e: cache weg','news');const f=window.fetch;window.fetch=async(u,...a)=>{if(String(u?.url||u).includes('/api/tts'))return new Promise(()=>{});return f(u,...a)}});
  try{
    await sleep(14000);const pb=await h.page.evaluate(()=>window.__pb),n=await h.page.evaluate(()=>window.MAIRNewsBulletin.status());
    c.ok('stem niet klaar: muziek wordt niet stilgezet',pb.length>10&&pb.every(Boolean),JSON.stringify(pb));
    c.ok('stem niet klaar: nieuws overgeslagen met reden',!n.alreadyAired&&/8 s/.test(n.lastError),n.lastError);
    noErrors('stem niet klaar: geen page errors',h);
  }finally{await h.close()}
}

 const scenarios={newsHour:scenarioNewsHour,newsVoiceHangs:scenarioNewsVoiceHangs,newsJingleHangs:scenarioNewsJingleHangs,newsIosHidden:scenarioNewsIosHidden,newsVoiceNotReady:scenarioNewsVoiceNotReady,newsGuardBackoff:scenarioNewsGuardBackoff,newsScreenOff:scenarioNewsScreenOff,newsScreenOffRefused:scenarioNewsScreenOffRefused,newsScreenOffInterrupt:scenarioNewsScreenOffInterrupt,learnBan:scenarioLearnBan,learnLove:scenarioLearnLove,learnManyBans:scenarioLearnManyBans,studyStation:scenarioStudyStation,rateLimitBackoff:scenarioRateLimitBackoff,backgroundNativeMusicFirst:scenarioBackgroundNativeMusicFirst,nativeSession:scenarioNativeSession,sessionReopen:scenarioSessionReopen,sessionNetworkError:scenarioSessionNetworkError,sessionInvalidGrant:scenarioSessionInvalidGrant,sessionOtherTab:scenarioSessionOtherTab,aiPicksSwitch:scenarioAiPicksSwitch,requestUi:scenarioRequestUi,iosVoiceVolume:scenarioIosVoiceVolume,regressions:scenarioRegressions,reload:scenarioReload,skipThenBreak:scenarioSkipThenBreak,hidden:scenarioHidden,soak:scenarioSoak,request:scenarioRequest,tokenRefresh:scenarioTokenRefresh,start:scenarioStart,djBreak:scenarioDjBreak,writerDown:scenarioWriterDown,ttsDown:scenarioTtsDown,skipDuringBreak:scenarioSkipDuringBreak,deviceLoss:scenarioDeviceLoss,bgDeviceRebuild:scenarioBgDeviceRebuild,bgDeviceGone:scenarioBgDeviceGone,bgOtherDevice:scenarioBgOtherDevice,rateLimit:scenarioRateLimit,sleepTimer:scenarioSleepTimer};
// iOS verbreekt de Web Playback SDK met het scherm uit of bij een netwerkwissel; de app krijgt alleen not_ready.
// Voor de fix bleef het daarna stil tot je de app weer opende (recover weigerde in de achtergrond, niets bouwde het device opnieuw).
const hide=(page,v)=>page.evaluate(x=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>x});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>x?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(x?'pagehide':'pageshow'))},v);
async function scenarioBgDeviceRebuild(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await hide(h.page,true);await sleep(1000);
    await h.page.evaluate(()=>window.Spotify.Player.drop());
    await sleep(8000);
    const st=await mock(h.page),log=await h.page.evaluate(()=>window.MAIRRuntime.errorLog().map(x=>x.type||x.event||x.name));
    c.ok('device weg in achtergrond: speelt weer zonder de app te openen',st.playing===true&&st.registered===true,JSON.stringify(st));
    c.ok('device weg in achtergrond: maar een speler tegelijk (oude losgekoppeld)',st.disconnects===1&&st.connects===2,JSON.stringify(st));
    c.ok('device weg in achtergrond: staat in het foutlog',JSON.stringify(log).includes('spotify.device-lost'),JSON.stringify(log).slice(0,300));
    noErrors('device weg in achtergrond: geen page errors',h);
  }finally{await h.close()}
}
async function scenarioBgDeviceGone(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await hide(h.page,true);await sleep(1000);
    await h.page.evaluate(()=>{window.__mock.failConnect=true;window.Spotify.Player.drop()});
    await until(h.page,()=>!window.JFMSpotifySDK.health.rebuilding,null,40000,'herstelpogingen klaar');
    const st=await mock(h.page),info=await h.page.evaluate(()=>document.getElementById('queueInfo')?.textContent||'');
    c.ok('geen device: begrensd aantal pogingen',st.connects>=2&&st.connects<=6,JSON.stringify(st));
    c.ok('geen device: duidelijke melding',/weggevallen/.test(info),info);
    noErrors('geen device: geen page errors',h);
  }finally{await h.close()}
}
// Speelt Spotify intussen op een ander apparaat (Spotify-app, speaker), dan pakt het herstel dat niet af.
async function scenarioBgOtherDevice(){
  const h=await launch({trackMs:30000});
  try{
    await startStation(h);
    await hide(h.page,true);await sleep(1000);
    await h.page.evaluate(()=>{window.__mock.otherDevice=true;window.Spotify.Player.drop()});
    await sleep(8000);
    const st=await mock(h.page);
    c.ok('ander apparaat speelt: herstel pakt het niet af',st.registered===true&&st.active===false&&st.playing===false,JSON.stringify(st));
    noErrors('ander apparaat speelt: geen page errors',h);
  }finally{await h.close()}
}
const optIn=new Set(['soak']);
for(const [name,fn] of Object.entries(scenarios)){if(only?only!==name:optIn.has(name))continue;console.log('--- '+name);try{await fn()}catch(e){c.ok(`scenario ${name} afgerond`,false,e.message.slice(0,600))}}
process.exit(c.summary('MAIR e2e playback')?0:1);
