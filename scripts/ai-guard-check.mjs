// De vier AI-routes kosten geld zodra er een Anthropic-sleutel in zit. Deze check
// bewijst dat api/_guard.js een vreemde site, curl zonder sessie en een ongeldig
// Spotify-token tegenhoudt, en dat een geldige sessie maar één keer bij Spotify
// wordt nagevraagd.
import assert from 'node:assert/strict';
import {guardAI} from '../api/_guard.js';
import djWriter from '../api/dj-writer.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const originalFetch=globalThis.fetch,originalEnv={...process.env};
const res=()=>({statusCode:0,body:null,headers:{},status(c){this.statusCode=c;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}});
const own={host:'josh-fm.vercel.app',origin:'https://josh-fm.vercel.app'};
let spotifyCalls=0,spotify=async()=>({ok:true,status:200,json:async()=>({id:'josh'})});
globalThis.fetch=async(url,opt)=>{if(String(url).startsWith('https://api.spotify.com/v1/me')){spotifyCalls++;return spotify(url,opt)}throw new Error(`onverwachte fetch: ${url}`)};
async function run(headers){const r=res();const ok=await guardAI({headers},r);return{ok,status:r.statusCode,error:r.body?.error}}
const token=n=>`Bearer spotify-token-${n}-abcdefghijklmnop`;
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};

try{
  await check('zonder Origin (curl) gaat de deur dicht',async()=>{const r=await run({host:own.host,authorization:token(1)});assert.equal(r.ok,false);assert.equal(r.status,403);assert.equal(spotifyCalls,0)});
  await check('een vreemde site komt er niet in',async()=>{const r=await run({...own,origin:'https://evil.example',authorization:token(1)});assert.equal(r.status,403)});
  await check('een lookalike-domein komt er niet in',async()=>{const r=await run({...own,origin:'https://josh-fm.vercel.app.evil.example',authorization:token(1)});assert.equal(r.status,403)});
  await check('eigen Origin zonder Spotify-sessie: 401',async()=>{const r=await run(own);assert.equal(r.status,401);assert.equal(r.error,'spotify_token_missing');assert.equal(spotifyCalls,0)});
  await check('een token dat Spotify afwijst: 401',async()=>{spotify=async()=>({ok:false,status:401,json:async()=>({})});const r=await run({...own,authorization:token(2)});assert.equal(r.status,401);assert.equal(r.error,'spotify_token_invalid')});
  await check('Spotify onbereikbaar: dicht, niet open',async()=>{spotify=async()=>{throw new Error('netwerk weg')};const r=await run({...own,authorization:token(3)});assert.equal(r.status,503)});
  await check('geldige sessie mag erdoor en wordt maar één keer nagevraagd',async()=>{spotify=async()=>({ok:true,status:200,json:async()=>({id:'josh'})});const before=spotifyCalls;assert.equal((await run({...own,authorization:token(4)})).ok,true);assert.equal((await run({...own,authorization:token(4)})).ok,true);assert.equal(spotifyCalls-before,1)});
  await check('met een allowlist komt een andere Spotify-gebruiker er niet in',async()=>{process.env.MAIR_ALLOWED_SPOTIFY_USERS='josh';spotify=async()=>({ok:true,status:200,json:async()=>({id:'iemand-anders'})});assert.equal((await run({...own,authorization:token(5)})).status,403);assert.equal((await run({...own,authorization:token(4)})).ok,true);delete process.env.MAIR_ALLOWED_SPOTIFY_USERS});
  await check('MAIR_ALLOWED_ORIGINS laat een expliciet extra origin toe',async()=>{process.env.MAIR_ALLOWED_ORIGINS='capacitor://localhost';assert.equal((await run({host:own.host,origin:'capacitor://localhost',authorization:token(4)})).ok,true);delete process.env.MAIR_ALLOWED_ORIGINS});
  await check('dj-writer zelf weigert een vreemde site voordat er een AI-aanroep is',async()=>{process.env.GROQ_API_KEY='x';const r=res();await djWriter({method:'POST',headers:{...own,origin:'https://evil.example','x-real-ip':'192.0.2.9'},body:{}},r);assert.equal(r.statusCode,403)});
  await check('de client zet het token alleen op de eigen AI-routes',async()=>{const seen=[];const window={fetch:async(input,init)=>{seen.push({input,auth:new Headers(init?.headers).get('Authorization')});return{ok:true}},JFMAuth:{ensure:async()=>'tok-123'}};vm.runInNewContext(readFileSync('mair-ai-auth.js','utf8'),{window,location:{href:'https://josh-fm.vercel.app/',origin:'https://josh-fm.vercel.app'},URL,Headers,Request});
    await window.fetch('/api/dj-writer',{method:'POST',headers:{'Content-Type':'application/json'}});await window.fetch('/api/tts',{method:'POST'});await window.fetch('https://evil.example/api/dj-writer',{method:'POST'});await window.fetch('/api/category-filter');
    assert.deepEqual(seen.map(x=>x.auth),['Bearer tok-123',null,null,'Bearer tok-123']);
    window.JFMAuth.ensure=async()=>{throw new Error('refresh mislukt')};await window.fetch('/api/news-bulletin',{method:'POST'});assert.equal(seen.at(-1).auth,null,'zonder token gaat het verzoek gewoon door')});
  console.log(`MAIR AI-poort: ${passed}/11 PASS`);
}finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in originalEnv))delete process.env[k];Object.assign(process.env,originalEnv)}
