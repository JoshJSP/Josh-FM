// Screenshots van Radio, Stations en Profiel op 390x844 (headless). Gebruik: node scripts/e2e/ui-shots.mjs <map> [met-nummer]
import {launch,boot,until} from './harness.mjs';
import fs from 'node:fs';
const out=process.argv[2]||'shots',playing=process.argv[3]==='play';
fs.mkdirSync(out,{recursive:true});
const h=await launch({trackMs:60000});
const {page}=h;
const tab=async n=>{await page.locator('nav button, [role=tab]',{hasText:n}).locator('visible=true').first().click();await page.waitForTimeout(700)};
try{
  await boot(h);
  await page.screenshot({path:out+'/radio-leeg.png'});
  await tab('Stations');await page.screenshot({path:out+'/stations.png'});
  await page.screenshot({path:out+'/stations-vol.png',fullPage:true});
  if(playing){
    await page.locator('[data-mair-station]').locator('visible=true').first().click();
    await until(page,()=>window.__mock.state().playing,null,25000,'speelt');
  }
  await tab('Radio');await page.waitForTimeout(1500);await page.screenshot({path:out+'/radio.png'});
  await page.locator('.mair-bottom-nav [data-mair-tab="settings"]').click();await page.waitForTimeout(700);await page.screenshot({path:out+'/profiel.png'});
  await page.evaluate(()=>{document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight+20&&/auto|scroll/.test(getComputedStyle(e).overflowY))e.scrollTop=1e5});window.scrollTo(0,1e5)});
  await page.waitForTimeout(500);await page.screenshot({path:out+'/profiel-onder.png'});
  console.log('klaar',h.log.pageErrors.slice(0,3));
}finally{await h.close()}
