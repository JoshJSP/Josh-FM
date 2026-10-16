// e2e-harnas: draait de échte app in headless Chrome tegen een nep-Spotify (mock-spotify.js) en nep-AI-routes.
// Geen echt Spotify-account, geen netwerk, geen Widevine nodig. Vereist Playwright (global) en Google Chrome.
//   node scripts/e2e/playback.e2e.mjs
// Niet onderdeel van `npm run predeploy`: het heeft een browser nodig. Draai het na wijzigingen aan playback, queue of DJ.
import {createRequire} from 'node:module';
import {execSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const ORIGIN='https://mair.test';
const MIME={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.wav':'audio/wav'};

function loadPlaywright(){
  const tries=[()=>createRequire(import.meta.url)('playwright'),()=>createRequire(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'/'))('playwright')];
  for(const t of tries){try{return t()}catch{/* volgende poging */}}
  throw new Error('Playwright niet gevonden: npm i -g playwright');
}
const {chromium}=loadPlaywright();

// Korte stilte als MP3 (de client eist een MP3-header): 30 lege MPEG1-L3-frames van 417 bytes = ~0,8 s.
export function silentMp3(frames=30){const f=Buffer.alloc(417);f.writeUInt32BE(0xFFFB9064,0);return Buffer.concat(Array.from({length:frames},()=>f))}
// Korte stilte als "stem": 0,6 s, 8 kHz mono 8-bit.
export function silentWav(seconds=.6){const rate=8000,n=Math.round(rate*seconds),b=Buffer.alloc(44+n,128);b.write('RIFF',0);b.writeUInt32LE(36+n,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate,28);b.writeUInt16LE(1,32);b.writeUInt16LE(8,34);b.write('data',36);b.writeUInt32LE(n,40);return b}

export async function launch({trackMs=20000,djWriter='ok',ttsOk=true,tokens=true,width=390,height=844}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mair-e2e-'));
  const ctx=await chromium.launchPersistentContext(dir,{channel:'chrome',headless:true,viewport:{width,height},serviceWorkers:'block',args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const page=ctx.pages()[0]||await ctx.newPage();
  const log={errors:[],pageErrors:[],csp:[],requests:[],api:{writer:0,tts:0}};
  page.on('pageerror',e=>log.pageErrors.push(e.message));
  page.on('console',m=>{const t=m.text();if(m.type()==='error')log.errors.push(t);if(/Content Security Policy/i.test(t))log.csp.push(t.slice(0,200))});
  const csp=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'vercel.json'),'utf8')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value}catch{return ''}})();
  const mockSrc=fs.readFileSync(path.join(ROOT,'scripts/e2e/mock-spotify.js'),'utf8');
  await page.addInitScript(({trackMs,tokens})=>{
    try{localStorage.setItem('__mock_dur',String(trackMs));
    if(tokens&&!localStorage.getItem('jfm_token')){const set=(k,v)=>localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
      set('jfm_token','mock-token-'+'x'.repeat(40));set('jfm_refresh','mock-refresh-'+'y'.repeat(30));set('jfm_exp',String(Date.now()+3600e3));set('jfm_client_id','mockclientid0123456789abcdef');set('jfm_test_spotify_client_id','mockclientid0123456789abcdef');
      set('jfm_streaming_ready_v2','1');set('mairfm_welcome_seen_v1','1');set('jfm_onboarding_v1',{completed:true,migratedExistingUser:true});set('mair_volume_v1','0.5');set('jfm_music_channel_v1','hits');set('mair_dj_enabled_v1','1');set('jfm_dj_language','nl')}}catch{}
  },{trackMs,tokens});
  await page.addInitScript(mockSrc);
  const api=async route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname,m=req.method();
    log.requests.push(m+' '+p);
    const json=(o,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
    if(p==='/api/dj-writer'){log.api.writer++;if(djWriter==='fail')return json({error:'mock_writer_down'},502);let b={};try{b=JSON.parse(req.postData()||'{}')}catch{}
      return json({text:Array.from({length:Math.max(6,Math.min(30,Number(b.targetWords)||14))},(_,i)=>['Dat','was','weer','een','lekker','nummer','op','MAIR'][i%8]).join(' ')+'.',estimatedWords:Number(b.targetWords)||14,breakType:b.breakType||'FORWARD_ANNOUNCE',promptVersion:'e2e',provider:'mock',model:'mock',requestId:'e2e-'+log.api.writer,persona:b.djProfile||'josh',attempts:1})}
    if(p==='/api/tts'){if(m==='GET')return json({provider:'fish-audio',configured:true,djProfile:u.searchParams.get('djProfile')||'josh',voice:{ok:true,dutchReady:true,languages:['nl'],title:'Mock'},cast:{label:'Mock stem'},models:['mock']});
      log.api.tts++;if(!ttsOk)return json({error:'fish_tts_failed'},502);return route.fulfill({status:200,contentType:'audio/mpeg',body:silentMp3()})}
    if(p==='/api/config')return json({spotifyClientId:'mockclientid0123456789abcdef',mapboxPublicToken:''});
    if(p==='/api/version')return json({version:'e2e',displayVersion:'e2e',commit:'e2e',cache:'e2e'});
    if(p==='/api/live-headlines')return json({items:[]});
    if(p==='/api/nl-charts')return json({tracks:[],partial:true});
    if(p==='/api/category-filter'||p==='/api/discover'||p==='/api/station-picks')return json({error:'mock_not_available'},503);
    if(p==='/api/news-bulletin')return json({fallback:true,text:''});
    return json({error:'mock_unhandled',path:p},404)};
  await page.route(ORIGIN+'/api/**',api);
  await page.route('https://sdk.scdn.co/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.onSpotifyWebPlaybackSDKReady&&window.onSpotifyWebPlaybackSDKReady();'}));
  await page.route(ORIGIN+'/**',async route=>{
    const u=new URL(route.request().url());let p=decodeURIComponent(u.pathname);if(p.startsWith('/api/'))return route.fallback();if(p==='/')p='/index.html';
    const f=path.join(ROOT,p);
    if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({status:200,body:fs.readFileSync(f),contentType:MIME[path.extname(f)]||'application/octet-stream',headers:{'cache-control':'no-store',...(p==='/index.html'&&csp?{'content-security-policy':csp}:{})}});
    log.requests.push('404 '+p);return route.fulfill({status:404,body:'nf'})});
  await page.route(/^https:\/\/(?!mair\.test|sdk\.scdn\.co)/,r=>r.abort());
  return {ctx,page,log,dir,async close(){await ctx.close();try{fs.rmSync(dir,{recursive:true,force:true})}catch{/* tijdelijke map blijft staan: onschuldig */}}};
}

export async function boot(h){
  await h.page.goto(ORIGIN+'/',{waitUntil:'load'});
  await h.page.waitForFunction(()=>window.JFMPlayback&&window.MAIRRuntime&&window.__mock,null,{timeout:15000});
  await h.page.waitForTimeout(1500);
}
export const mock=(page)=>page.evaluate(()=>window.__mock.state());
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function until(page,fn,arg,timeout=15000,label='conditie'){
  try{await page.waitForFunction(fn,arg,{timeout,polling:100})}catch(e){const st=await page.evaluate(()=>({mock:window.__mock?.state?.(),pb:window.JFMPlaybackState?.get?.(),title:document.getElementById('title')?.textContent})).catch(()=>null);throw new Error(`Time-out: ${label}. Stand: ${JSON.stringify(st)}`)}
}
export function checker(){let pass=0,fail=0;const fails=[];return{ok(name,cond,extra=''){if(cond){pass++;console.log('PASS '+name)}else{fail++;fails.push(name);console.log('FAIL '+name+(extra?' — '+extra:''))}},summary(label){console.log(`${label}: ${fail?'FAIL':'PASS'} (${pass} ok, ${fail} mislukt)`);return fail===0}}}
