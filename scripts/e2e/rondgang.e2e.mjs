// Rondgang door de hele app (testronde 20-10-2026): elk tabblad, zender wisselen, DJ-schakelaar, stem kapot.
// Zoekt naar wat een gebruiker ziet als het mis is: page errors, CSP-meldingen, en tekst als "undefined", "NaN" of "[object".
//   MAIR_E2E_BUNDLED=1 node scripts/e2e/rondgang.e2e.mjs [map-voor-screenshots]
import {launch,boot,until,mock,sleep} from './harness.mjs';
import fs from 'node:fs';
const out=process.argv[2]||'';if(out)fs.mkdirSync(out,{recursive:true});
let pass=0,fail=0;const ok=(name,cond,info='')=>{if(cond){pass++;console.log('PASS',name)}else{fail++;console.log('FAIL',name,info?'— '+String(info).slice(0,400):'')}};
const tab=async(page,n)=>{await page.locator('nav button, [role=tab]',{hasText:n}).locator('visible=true').first().click();await page.waitForTimeout(700)};
const shot=async(page,name)=>{if(out)await page.screenshot({path:`${out}/${name}.png`})};
// Zichtbare tekst die op een programmeerfout wijst.
const junk=page=>page.evaluate(()=>{const bad=/\bundefined\b|\bNaN\b|\[object |\bnull\b(?! ?%)/;const hits=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,t=n.textContent.trim();if(!t||!bad.test(t))continue;const el=n.parentElement;if(!el||el.closest('script,style,[hidden]'))continue;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);if(r.width&&r.height&&cs.visibility!=='hidden'&&cs.display!=='none')hits.push(t.slice(0,80))}return hits});

const h=await launch({trackMs:60000});
const {page}=h;
try{
  await boot(h);await shot(page,'1-radio-leeg');
  ok('start: geen rare tekst op Radio',!(await junk(page)).length,JSON.stringify(await junk(page)));
  await tab(page,'Stations');await shot(page,'2-stations');
  ok('stations: geen rare tekst',!(await junk(page)).length,JSON.stringify(await junk(page)));
  const stations=page.locator('[data-mair-station]').locator('visible=true');
  ok('stations: er zijn zenders',await stations.count()>=4,String(await stations.count()));
  await stations.first().click();
  await until(page,()=>window.__mock.state().playing&&window.__mock.state().uris>=10,null,25000,'eerste zender speelt');
  const first=await mock(page);
  // Vibe/zender wisselen terwijl er muziek speelt: er moet echt iets anders gaan spelen.
  await sleep(1500);// na het starten springt de app zelf naar Radio
  await tab(page,'Stations');
  await stations.nth(1).click();
  await until(page,u=>window.__mock.state().playing&&window.__mock.state().uri!==u,first.uri,30000,'tweede zender speelt');
  const second=await mock(page);
  ok('zender wisselen: ander nummer, speelt',second.playing&&second.uri!==first.uri,JSON.stringify({first:first.uri,second:second.uri}));
  await tab(page,'Radio');await sleep(1200);await shot(page,'3-radio-speelt');
  ok('radio speelt: uitleg bij het nummer is Nederlands',!/\b(Current|Power|Familiar|Throwback|Forgotten)\b/.test(await page.evaluate(()=>document.body.innerText)),'');
  ok('radio speelt: geen rare tekst',!(await junk(page)).length,JSON.stringify(await junk(page)));
  await page.locator('.mair-bottom-nav [data-mair-tab="settings"]').click();await sleep(800);await shot(page,'4-profiel');
  ok('profiel: geen rare tekst',!(await junk(page)).length,JSON.stringify(await junk(page)));
  // Nieuws volgt de DJ-schakelaar.
  ok('dj aan: nieuws staat aan',await page.evaluate(()=>window.MAIR_DJ_ENABLED===true&&window.MAIRNewsBulletin.status().enabled===true));
  await page.evaluate(()=>window.MAIRFlags.setDJEnabled(false));await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.MAIRNewsBulletin,null,{timeout:15000});
  ok('dj uit: nieuws staat ook uit',await page.evaluate(()=>window.MAIR_DJ_ENABLED===false&&window.MAIRNewsBulletin.status().enabled===false));
  await page.evaluate(()=>window.MAIRFlags.setDJEnabled(true));await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.MAIRNewsBulletin,null,{timeout:15000});
  ok('dj weer aan: nieuws weer aan',await page.evaluate(()=>window.MAIRNewsBulletin.status().enabled===true));
  // Diagnostiek laat de nieuws-status zien, ook in het gekopieerde foutlog.
  const diag=await page.evaluate(()=>{window.MAIRDiagnosticsHub.open();const t=document.querySelector('#mairNewsStatusCard')?.innerText||'';window.MAIRDiagnosticsHub.close();return t});
  ok('diagnostiek: kaart uurnieuws met status',/Nieuws: aan/.test(diag)&&/Geweigerd met scherm uit: \d+x/.test(diag)&&/Laatste fout:/.test(diag),diag);
  // Stem kapot: een melding in gewone taal, geen kale HTTP-code, en de muziek blijft.
  await page.route('**/api/tts',r=>r.request().method()==='POST'?r.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'fish_tts_failed',detail:'Fish Audio generation timed out'})}):r.fallback());
  const said=await page.evaluate(async()=>{const r=await window.prepareSpeech('Test van de stem.',false);return{r,err:window.JFMDJAudio.status.error}});
  ok('stem kapot: voorbereiden geeft netjes false',said.r===false,JSON.stringify(said));
  ok('stem kapot: foutmelding is leesbaar',/Fish Audio|stem|time/i.test(said.err)&&!/\[object|undefined/.test(said.err),said.err);
  ok('geen page errors',!h.log.pageErrors.length,h.log.pageErrors.slice(0,3).join(' | '));
  ok('geen CSP-meldingen',!h.log.csp.length,h.log.csp.slice(0,3).join(' | '));
}catch(e){ok('rondgang afgerond',false,e.message)}
finally{await h.close()}
console.log(`MAIR e2e rondgang: ${fail?'FAIL':'PASS'} (${pass} ok, ${fail} mislukt)`);process.exitCode=fail?1:0;
