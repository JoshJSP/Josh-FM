// e2e: na een release serveert de service worker geen oude HTML/CSS meer (ook niet offline).
// Draait de échte sw.js in headless Chrome tegen een mini-server op localhost. Eerst een "oude" release
// (zelfde sw.js, oude cachenaam), dan de nieuwe. Elke response draagt een versiemarker.
// De pagina doet reg.update() bij het laden, net als forceServiceWorkerCheck() in version.js.
//   node scripts/e2e/sw-update.e2e.mjs
import {createRequire} from 'node:module';
import {execSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {checker} from './harness.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SW=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const NEW_CACHE=/const CACHE='([^']+)'/.exec(SW)[1];
const OLD_CACHE='mair-v100-oude-release';
const {chromium}=(()=>{for(const t of [()=>createRequire(import.meta.url)('playwright'),()=>createRequire(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'/'))('playwright')]){try{return t()}catch{/* volgende */}}throw new Error('Playwright niet gevonden')})();

let release='old',down=false;
const server=http.createServer((req,res)=>{
  if(down)return req.socket.destroy();
  const p=new URL(req.url,'http://x').pathname;
  const send=(type,body)=>{res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(body)};
  if(p==='/sw.js')return send('text/javascript',release==='old'?SW.replace(NEW_CACHE,OLD_CACHE):SW);
  if(p==='/'||p==='/index.html')return send('text/html',`<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body data-html="${release}"><script>navigator.serviceWorker.register('./sw.js').then(r=>r.update())</script></body></html>`);
  if(p.endsWith('.css'))return send('text/css',`body{--release:"${release}"}`);
  if(p.endsWith('.js'))return send('text/javascript',`/* ${release} */`);
  res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const URL_='http://localhost:'+server.address().port+'/';

const t=checker();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mair-sw-'));
const ctx=await chromium.launchPersistentContext(dir,{...(process.env.MAIR_E2E_BUNDLED?{}:{channel:'chrome'}),headless:true});
const page=ctx.pages()[0]||await ctx.newPage();
const seen=()=>page.evaluate(()=>({html:document.body.dataset.html,css:getComputedStyle(document.body).getPropertyValue('--release').trim().replace(/"/g,'')}));
const controller=()=>page.evaluate(async()=>{await navigator.serviceWorker.ready;return navigator.serviceWorker.controller?.scriptURL||''});
const keys=()=>page.evaluate(()=>caches.keys());
const cachedCss=()=>page.evaluate(async c=>{const r=await (await caches.open(c)).match('./styles.css');return r?r.text():null},NEW_CACHE);
try{
  // 1. oude release installeren en laten controleren; plus een nog oudere cache die opgeruimd moet worden
  await page.goto(URL_);await controller();
  await page.evaluate(async()=>{const c=await caches.open('josh-fm-heel-oud');await c.put('./styles.css',new Response('body{--release:"heel-oud"}',{headers:{'content-type':'text/css'}}))});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  t.ok('oude release draait onder de oude service worker',(await keys()).includes(OLD_CACHE)&&(await seen()).css==='old');

  // 2. nieuwe release live: eerste herlaad haalt de nieuwe sw.js op, die neemt meteen over (skipWaiting + claim)
  release='new';
  await page.reload();
  for(let i=0;i<100&&!((await keys()).length===1&&(await keys())[0]===NEW_CACHE);i++)await new Promise(r=>setTimeout(r,200));
  await page.reload();
  const k=await keys();
  t.ok('oude caches zijn opgeruimd, alleen '+NEW_CACHE+' blijft',k.length===1&&k[0]===NEW_CACHE,JSON.stringify(k));
  t.ok('HTML en CSS komen van de nieuwe release',JSON.stringify(await seen())==='{"html":"new","css":"new"}',JSON.stringify(await seen()));
  t.ok('de nieuwe cache bevat de nieuwe CSS',(await cachedCss())==='body{--release:"new"}');

  // 3. offline (server weg): uit de cache, en dat is de nieuwe release, geen mengsel met oud
  down=true;
  await page.reload();
  t.ok('offline: HTML en CSS uit de cache zijn allebei nieuw',JSON.stringify(await seen())==='{"html":"new","css":"new"}',JSON.stringify(await seen()));
  down=false;

}finally{await ctx.close();server.close();try{fs.rmSync(dir,{recursive:true,force:true})}catch{/* tijdelijke map blijft staan */}}
process.exit(t.summary('sw-update e2e')?0:1);
