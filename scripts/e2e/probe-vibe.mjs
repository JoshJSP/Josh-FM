import {launch,boot,until,sleep} from './harness.mjs';
const h=await launch({trackMs:900000,width:844,height:390});
const page=h.page;
await boot(h);
await until(page,()=>window.MAIRStationController&&window.MAIRCarModePrototype,null,15000,'klaar');
await page.locator('nav button, [role=tab]',{hasText:'Stations'}).locator('visible=true').first().click();await sleep(500);
await page.locator('[data-mair-station]').locator('visible=true').first().click();
await until(page,()=>window.__mock.state().playing&&queue.length>=10,null,25000,'speelt');
const LAT=Number(process.env.LAT||0);
await page.evaluate(ms=>{const f=window.fetch;window.__searches=0;window.fetch=async(u,...a)=>{const s=String(u?.url||u);if(/api\.spotify\.com\/v1\/search/.test(s)){window.__searches++;await new Promise(r=>setTimeout(r,ms))}return f(u,...a)}},LAT);
for(const st of ['hits','chill','party','new']){
  const r=await page.evaluate(async st=>{window.__searches=0;const t=Date.now();let n=null,err='';try{const b=await window.MAIRStationController.buildPool(st);n=b?.tracks?.length}catch(e){err=String(e?.message||e)}return{st,ms:Date.now()-t,n,err,searches:window.__searches,queries:window.MAIRStationPolicy?.queries?.(st)?.length}},st);
  console.log(JSON.stringify(r));
}
await h.close();
