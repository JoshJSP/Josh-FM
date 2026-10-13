// Stations kiezen zelf hun nummers (api/station-picks.js + channel-click-fix.js).
// Bewijst met een nep-fetch: strenge validatie op de server, exacte Spotify-match in
// de client (een titel met het genrewoord van een andere artiest komt er niet in),
// terugval op de oude methode als de AI faalt, en dat Top 40 de hitlijst blijft volgen.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import picksRoute,{cleanPicks,readInput} from '../api/station-picks.js';

let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
const originalFetch=globalThis.fetch,originalEnv={...process.env};

// ---------- server ----------
const res=()=>({statusCode:0,body:null,headers:{},status(c){this.statusCode=c;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}});
let ip=0,groq=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{}'}}]})});
const groqSays=content=>{groq=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content}}]})})};
globalThis.fetch=async(url,opt)=>{url=String(url);if(url.startsWith('https://api.spotify.com/v1/me'))return{ok:true,status:200,json:async()=>({id:'josh'})};if(url.includes('api.groq.com'))return groq(url,opt);throw new Error('onverwachte fetch: '+url)};
async function call(body){const r=res();await picksRoute({method:'POST',headers:{host:'mair.test',origin:'https://mair.test',authorization:'Bearer spotify-token-abcdefghijklmnopqrstuvwxyz','x-real-ip':'10.0.0.'+(++ip)},body},r);return r}
const good={station:'party',description:'Energieke, dansbare feesttracks.'};

try{
  process.env.GROQ_API_KEY='test';delete process.env.ANTHROPIC_API_KEY;
  await check('server: Top 40 en MY MAIR mogen niet, onbekend station ook niet',async()=>{for(const station of ['top40','mix','bestaat-niet',''])assert.equal((await call({...good,station})).statusCode,400)});
  await check('server: zonder omschrijving een 400',async()=>{const r=await call({station:'party'});assert.equal(r.statusCode,400);assert.equal(r.body.error,'description_missing')});
  await check('server: invoer wordt hard begrensd',async()=>{const x=readInput({...good,description:'x'.repeat(5000),topArtists:Array(50).fill('a'.repeat(500)),topTracks:[{artist:'A',title:'B'},{artist:1},null],personalization:9});assert.equal(x.description.length,600);assert.equal(x.topArtists.length,20);assert.equal(x.topArtists[0].length,100);assert.equal(x.topTracks.length,1);assert.equal(x.personalization,1)});
  await check('server: validatie van de AI-lijst (geen dubbele, max 2 per artiest, max 60, alleen strings)',async()=>{
    const raw=[{artist:'A',title:'Een'},{artist:'a',title:'een'},{artist:'A',title:'Twee'},{artist:'A',title:'Drie'},{artist:'B',title:7},{artist:'',title:'Leeg'},null,'tekst',{artist:'C',title:'Zin\nmet regel'},...Array.from({length:80},(_,i)=>({artist:'Artiest '+i,title:'Nummer '+i}))];
    const out=cleanPicks({tracks:raw});
    assert.equal(out.length,60);assert.equal(out.filter(t=>t.artist.toLowerCase()==='a').length,2);assert.ok(out.every(t=>typeof t.artist==='string'&&typeof t.title==='string'&&!/\n/.test(t.title)));assert.equal(out[2].title,'Zin met regel')});
  await check('server: geldige AI-lijst komt terug als {artist,title}',async()=>{groqSays('```json\n'+JSON.stringify({tracks:Array.from({length:70},(_,i)=>({artist:'Artiest '+(i%40),title:'Nummer '+i,id:'verzonnen'}))})+'\n```');const r=await call(good);assert.equal(r.statusCode,200);assert.ok(r.body.tracks.length<=60&&r.body.tracks.length>=40);assert.deepEqual(Object.keys(r.body.tracks[0]).sort(),['artist','title'])});
  await check('server: onzin of te weinig nummers geeft 502, geen crash',async()=>{groqSays('sorry, ik weet het niet');assert.equal((await call(good)).statusCode,502);groqSays(JSON.stringify({tracks:[{artist:'A',title:'B'}]}));assert.equal((await call(good)).statusCode,502)});
  await check('server: Groq onbereikbaar geeft een nette fout',async()=>{groq=async()=>{throw new Error('netwerk weg')};const r=await call(good);assert.ok([502,504].includes(r.statusCode));assert.ok(r.body.error)});
  await check('server: zonder sleutel 503',async()=>{delete process.env.GROQ_API_KEY;assert.equal((await call(good)).statusCode,503);process.env.GROQ_API_KEY='test'});
  await check('server: vreemde site komt er niet in',async()=>{const r=res();await picksRoute({method:'POST',headers:{host:'mair.test',origin:'https://evil.example','x-real-ip':'10.9.9.9'},body:good},r);assert.equal(r.statusCode,403)});
}finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in originalEnv))delete process.env[k];Object.assign(process.env,originalEnv)}

// ---------- client ----------
const store=new Map(),timers=[],calls={generic:0,lookup:0,picks:0,charts:[],bodies:[]};
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const sp=(id,name,artist,year)=>({id,uri:'spotify:track:'+id,name,artists:[{name:artist}],album:{name:'Album',release_date:year+'-01-01',images:[]},duration_ms:200000});
// Spotify-catalogus voor de exacte zoekopdrachten, op titel.
const catalog=new Map();let picks=[],picksMode='ok';
for(let i=0;i<25;i++){picks.push({artist:'Feest Artiest '+i,title:'Feest Nummer '+i});catalog.set('Feest Nummer '+i,[sp('party'+i,'Feest Nummer '+i,'Feest Artiest '+i,2019)])}
// Het oude probleem: 'Summer' van een andere artiest. Moet geweigerd worden.
picks.push({artist:'Calvin Harris',title:'Summer'});catalog.set('Summer',[sp('impostor','Summer','Summer Party Band',2020)]);
// Wel goed: zelfde nummer met feat. en remaster-achtervoegsel, en accenten.
picks.push({artist:'Beyonce feat. Jay-Z',title:'Crazy In Love'});catalog.set('Crazy In Love',[sp('crazy','Crazy In Love (feat. JAY-Z) - Remastered','Beyoncé',2003)]);
const query=path=>decodeURIComponent(path.split('&q=')[1]||'');
async function api(path){
  if(path.startsWith('/me/top/artists'))return{items:[{name:'Martin Garrix'}]};
  if(path.startsWith('/me/top/tracks'))return{items:[{name:'Animals',artists:[{name:'Martin Garrix'}]}]};
  if(path.startsWith('/search?type=track&limit=3&q=')){calls.lookup++;const t=/track:"([^"]*)"/.exec(query(path))?.[1];return{tracks:{items:catalog.get(t)||[]}}}
  if(path.startsWith('/search?type=track&limit=10&q=')){calls.generic++;return{tracks:{items:Array.from({length:10},(_,i)=>sp('gen'+calls.generic+'x'+i,'Zoek '+i,'Zoek Artiest '+calls.generic+i,2005))}}}
  throw new Error('onverwachte api: '+path);
}
const json=(o,status=200)=>({ok:status<400,status,json:async()=>o});
async function fetch(url,opt){
  url=String(url);
  if(url==='/api/station-picks'){calls.picks++;calls.bodies.push(JSON.parse(opt.body));return picksMode==='ok'?json({tracks:picks}):json({error:'picks_unavailable'},502)}
  if(url.startsWith('/api/nl-charts')){const station=new URL(url,'https://mair.test').searchParams.get('station');calls.charts.push(station);return json({source:'chart',items:Array.from({length:40},(_,i)=>({id:station+'c'+i,uri:'spotify:track:'+station+'c'+i,name:'Chart '+i,artists:['Chart Artiest '+i],release:'2026-01-01'}))})}
  if(url==='/api/category-filter')return json({error:'mock_not_available'},503);
  throw new Error('onverwachte fetch: '+url);
}
const el=()=>({dataset:{},style:{},classList:{toggle(){}},setAttribute(){},parentNode:null});
const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:el,head:{appendChild(){}}};
const ctx={console,JSON,Math,Date,Promise,Map,Set,Array,Object,String,Number,Error,URL,AbortController,encodeURIComponent,decodeURIComponent,localStorage,document,api,fetch,
  setTimeout:(f,ms)=>{if(ms>=1000){timers.push({f,ms});return 0}return setTimeout(f,ms)},clearTimeout,addEventListener(){},dispatchEvent(){},CustomEvent:class{}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(readFileSync('mair-station-policy.js','utf8'),ctx);
vm.runInContext(readFileSync('channel-click-fix.js','utf8'),ctx);
const C=ctx.MAIRStationController,pool=id=>JSON.parse(store.get('mair_station_pool_cache_v5_nl_editorial_strict')||'{}')[id];
const aiTimers=()=>timers.filter(t=>t.ms===4000).length;

await check('client: AI faalt -> station speelt met de oude zoekmethode',async()=>{picksMode='fail';const before=aiTimers();const r=await C.buildPool('party');assert.equal(r.source,'spotify-search-fallback');assert.ok(r.tracks.length>=5);assert.ok(calls.generic>0);assert.equal(aiTimers(),before+1,'achtergrondbouw van de AI-pool wordt ingepland');assert.equal(await C.buildAiPool('party'),null);assert.notEqual(pool('party')?.source,'mair-ai-picks')});
await check('client: AI-lijst wordt exact opgezocht, de verkeerde "Summer" wordt geweigerd',async()=>{picksMode='ok';const out=await C.buildAiPool('party');assert.ok(out&&out.length>=20);const ids=out.map(t=>t.id);assert.ok(!ids.includes('impostor'),'Summer van een andere artiest mag er niet in');assert.ok(ids.includes('crazy'),'feat./remaster/accent-varianten van het goede nummer tellen wel');assert.equal(pool('party').source,'mair-ai-picks');
  const body=calls.bodies.at(-1);assert.equal(body.station,'party');assert.ok(body.description.includes('dansbare'));assert.deepEqual(body.topArtists,['Martin Garrix']);assert.equal(body.topTracks[0].title,'Animals')});
await check('client: met een verse AI-pool geen zoekwerk en geen nieuwe AI-aanroep',async()=>{const g=calls.generic,l=calls.lookup,t=aiTimers();const r=await C.buildPool('party');assert.equal(r.source,'MAIR-selectie');assert.equal(r.verified,true);assert.ok(r.tracks.length>=20);assert.equal(calls.generic,g);assert.equal(calls.lookup,l);assert.equal(aiTimers(),t)});
await check('client: pool ouder dan 24 uur speelt nog en wordt op de achtergrond ververst',async()=>{const all=JSON.parse(store.get('mair_station_pool_cache_v5_nl_editorial_strict'));all.party.at=Date.now()-25*3600e3;store.set('mair_station_pool_cache_v5_nl_editorial_strict',JSON.stringify(all));const t=aiTimers();const r=await C.buildPool('party');assert.equal(r.source,'MAIR-selectie');assert.equal(aiTimers(),t+1);
  all.party.at=Date.now()-8*24*3600e3;store.set('mair_station_pool_cache_v5_nl_editorial_strict',JSON.stringify(all));picksMode='fail';assert.equal((await C.buildPool('party')).source,'spotify-search-fallback','na 7 dagen weer de oude methode')});
await check('client: Top 40 blijft de hitlijst volgen, nooit de AI',async()=>{const p=calls.picks,t=aiTimers();const r=await C.buildPool('top40');assert.equal(calls.charts.at(-1),'top40');assert.equal(r.tracks[0].id,'top40c0');assert.equal(await C.buildAiPool('top40'),null);assert.equal(calls.picks,p);assert.equal(aiTimers(),t)});
await check('client: Je Moerstaal blijft de terugval voor nl, AI-pool wordt daarna gebruikt',async()=>{picksMode='fail';let r=await C.buildPool('nl');assert.equal(calls.charts.at(-1),'nl');assert.equal(r.tracks[0].id,'nlc0');
  picksMode='ok';await C.buildAiPool('nl');assert.equal(pool('nl').source,'mair-ai-picks','de nl-regel laat de AI-selectie toe');const g=calls.generic,c=calls.charts.length;r=await C.buildPool('nl');assert.equal(r.source,'MAIR-selectie');assert.equal(calls.generic,g);assert.equal(calls.charts.length,c)});
await check('client: hardFilter (jaartallen) blijft gelden op de AI-pool',async()=>{picks=Array.from({length:24},(_,i)=>({artist:'Nul Artiest '+i,title:'Nul Nummer '+i}));for(let i=0;i<24;i++)catalog.set('Nul Nummer '+i,[sp('nul'+i,'Nul Nummer '+i,'Nul Artiest '+i,i<21?2005:2015)]);const out=await C.buildAiPool('00s');assert.equal(out.length,21);assert.ok(out.every(t=>t.release.startsWith('2005')))});
await check('client: te weinig echte treffers -> geen AI-pool, oude methode blijft',async()=>{picks=Array.from({length:30},(_,i)=>({artist:'Niemand '+i,title:'Bestaat Niet '+i}));assert.equal(await C.buildAiPool('chill'),null);assert.equal(pool('chill')?.source,undefined)});

console.log(`MAIR station-picks: ${passed}/17 PASS`);
