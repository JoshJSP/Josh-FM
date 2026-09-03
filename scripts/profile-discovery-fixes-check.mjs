import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {RELEASE_CACHE, RELEASE_ASSET_VERSION} from './release-cache.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const profileSource=read('mair-profile.js');
const discoverySource=read('discovery.js');
const radioSuiteSource=read('radio-suite.js');
const diagnosticsSource=read('mair-diagnostics-hub.js');
const appSource=read('app.js');
const versionSource=read('version.js');
const versionApiSource=read('api/version.js');
const swSource=read('sw.js');
const build7Source=read('build7.js');
const brandConfigSource=read('brand-config.js');
const djQueueSource=read('dj-now-queue.js');
const predeploySource=read('scripts/predeploy-check-build1.mjs');
const pkg=JSON.parse(read('package.json'));

function storage(initial={}){
  const values=new Map(Object.entries(initial));
  return{get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()};
}

function profileRuntime({allTimeMinutes=0,authState,stored={}}={}){
  const local=storage(stored),session=storage();
  const document={readyState:'complete',hidden:false,getElementById:()=>null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}},addEventListener(){}};
  const window={MAIRModeManager:{recap:()=>({})},JFMRadioSuite:{state:()=>({minutes:allTimeMinutes})},addEventListener(){},dispatchEvent(){}};
  if(authState!==undefined)window.JFMAuth={state:authState};
  const context={window,document,localStorage:local,sessionStorage:session,CustomEvent:class{},location:{reload(){}},prompt:()=>null,confirm:()=>false,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},console};
  vm.runInNewContext(profileSource,context,{filename:'mair-profile.js'});
  return window.MAIRProfile;
}

function discoveryRuntime(){
  const slider={value:'50',addEventListener(){}},label={},queueInfo={};
  const currentYear=new Date().getFullYear();
  const results=Array.from({length:5},(_,i)=>({id:`found-${i}`,uri:`spotify:track:found-${i}`,name:`Found ${i}`,artists:[{name:`Artist ${i}`}],album:{name:'New',release_date:`${currentYear}-01-01`,images:[]},popularity:30+i}));
  const document={readyState:'complete',getElementById:id=>({discovery:slider,discoveryValue:label,queueInfo}[id]||null),createElement:()=>({}),body:{appendChild(){}},addEventListener(){}};
  const window={JFMMusicChoice:{channel:'new'},addEventListener(){},dispatchEvent(){},jfmRenderNext(){}};
  const context={window,document,localStorage:storage(),CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},queue:[{id:'known',uri:'spotify:track:known',name:'Known',artists:['Known Artist'],release:`${currentYear}-01-01`,popularity:80,_discovery:false}],playback:{item:{id:'known'},is_playing:true},api:async()=>({tracks:{items:results}}),setTimeout:()=>0,clearTimeout(){},Date,Math,console};
  vm.runInNewContext(discoverySource,context,{filename:'discovery.js'});
  return{context,discovery:window.JFMDiscovery};
}

function radioSuiteRuntime(){
  let now=0;
  const intervals=[];
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const document={querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},body:{appendChild(){},dataset:{}}};
  const window={JFM_ASSET_VERSION:RELEASE_ASSET_VERSION,addEventListener(){},dispatchEvent(){}};
  const context={window,document,localStorage:storage(),navigator:{userAgent:''},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},URL,Date:FakeDate,settings:{mode:'normal'},setMode(){},queue:[{id:'d1',uri:'spotify:track:d1',name:'Discovery',artists:['Artist'],_discovery:true},{id:'known',uri:'spotify:track:known',name:'Known',artists:['Artist'],_discovery:false}],playback:{item:{id:'d1'},is_playing:true},setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length},setTimeout:()=>0,clearTimeout(){},console};
  vm.runInNewContext(radioSuiteSource,context,{filename:'radio-suite.js'});
  const tick=intervals.find(x=>x.ms===1000)?.fn;
  assert.equal(typeof tick,'function','Discovery-luistertijd heeft een 1s tick');
  tick();
  return{context,suite:window.JFMRadioSuite,sync:tick,advance(ms,playing=context.playback.is_playing){context.playback.is_playing=playing;for(let elapsed=0;elapsed<ms;elapsed+=1000){now+=1000;tick()}}};
}

const cache=swSource.match(/const CACHE='([^']+)'/)?.[1];
assert.equal(pkg.version,'2.0.0-beta.9');
assert.match(versionSource,/version:'2\.0\.0-beta\.9'/);
assert.match(versionSource,/displayVersion:'2b\.0\.9'/);
assert.ok(versionSource.includes(`window.JFM_ASSET_VERSION='${RELEASE_ASSET_VERSION}';`));
assert.equal(cache,RELEASE_CACHE);
assert.ok(versionApiSource.includes(`cache:'${cache}'`),'API-cache wijkt af van service worker');
for(const stale of ['mair-v91-radio-brain-20260826','mair-v98-core-20260829',"JFM_ASSET_VERSION='80'"])assert.ok(!predeploySource.includes(stale),`Predeploy bevat verouderde verwachting: ${stale}`);

const profile=profileRuntime({allTimeMinutes:6000,authState:{hasRefreshToken:true,hasAccessToken:false}});
assert.ok(!profileSource.includes('Luisterdoelen')&&!profileSource.includes('Luister 20 uur deze maand'),'Luisterdoel staat nog in Profiel');
assert.ok(!profileSource.includes('monthlyGoal'),'Verwijderde luisterdoel-logica is blijven staan');
assert.equal(profile.spotifyConnected(),true);
assert.equal(profileRuntime({authState:{hasRefreshToken:false,hasAccessToken:false}}).spotifyConnected(),false);
assert.equal(profileRuntime({stored:{jfm_refresh:'stored-refresh'}}).spotifyConnected(),true);
assert.match(profileSource,/metric\(duration\(minutes\),'Luistertijd'\)/,'All-time luistertijd is niet apart gebleven');
assert.match(profileSource,/data-profile-action="diagnostics"/,'Profiel mist toegang tot Diagnostiek');
assert.match(diagnosticsSource,/mairDiagnosticsSheet/,'Diagnostiek heeft geen afgescheiden scherm');
assert.match(diagnosticsSource,/document\.body\.appendChild\(sheet\)/,'Diagnostiek blijft in de normale instellingen staan');
assert.ok(!diagnosticsSource.includes('MutationObserver'),'Diagnostiek gebruikt nog agressieve DOM-observatie');
assert.match(appSource,/const control=\$\(id\);if\(control\)control\.disabled=!ok/,'Optionele controls worden niet veilig behandeld');
assert.match(appSource,/\$\('skipTalk'\)\?\.addEventListener/,'Verwijderde skipTalk-control is niet null-safe');
// De DJ staat sinds 2026-09-01 standaard UIT achter een centrale feature flag.
// Deze drie asserties bewaakten de omgekeerde, inmiddels vervallen productregel
// ("publieke DJ moet expliciet aan staan") en bewaken nu de nieuwe regel.
assert.match(brandConfigSource,/window\.MAIR_DJ_ENABLED=djOverride==='1'/,'MAIR_DJ_ENABLED is geen expliciete opt-in meer');
assert.ok(!/window\.MAIR_DJ_ENABLED\s*=\s*true/.test(brandConfigSource),'De DJ-vlag staat hard aan in plaats van standaard uit');
assert.match(build7Source,/window\.MAIR_PUBLIC_DJ_ENABLED=djOn/,'build7 zet de publieke DJ-status niet af van de centrale vlag');
assert.ok(!/window\.MAIR_PUBLIC_DJ_ENABLED=true/.test(build7Source),'build7 activeert de publieke DJ nog hard');
assert.match(djQueueSource,/if\(window\.MAIR_DJ_ENABLED===true\)await loadDJ\(\)/,'mair-dj-v2 wordt niet achter de vlag geladen');
assert.match(djQueueSource,/await load\('\.\/mair-dj-v2\.js'/,'De DJ-orchestrator staat niet meer in de conditionele tak');
for(const runtimeModule of ['progress-clock-v226.js','mair-observability.js','mair-audio-unlock-v1.js','mair-background-guard.js'])
  assert.match(djQueueSource,new RegExp(`loadRuntime\\(\\)[\\s\\S]*${runtimeModule.replace(/\./g,'\\.')}`),`${runtimeModule} hoort altijd te laden, ook zonder DJ`);
assert.ok(swSource.includes("'./mair-public-dj-off.js'"),'De DJ-uit-laag hoort in de PWA-cache te staan');

const discoveryRun=discoveryRuntime();
assert.equal(await discoveryRun.discovery.rebuild(true),true);
const known=discoveryRun.context.queue.find(track=>track.id==='known');
const found=discoveryRun.context.queue.find(track=>track.id.startsWith('found-'));
assert.equal(known?._discovery,false,'Bestaande track werd ten onrechte Discovery');
assert.equal(found?._discovery,true,'Discovery-searchresultaat mist markering');

const at29=radioSuiteRuntime();
at29.advance(29000);
assert.equal(at29.suite.discoveries().length,0,'Discovery telde vóór 30 actieve seconden');
at29.advance(1000);
assert.equal(at29.suite.discoveries().length,1,'Discovery telde niet bij 30 actieve seconden');

const paused=radioSuiteRuntime();
paused.advance(15000);
paused.advance(20000,false);
paused.advance(14000,true);
assert.equal(paused.suite.discoveries().length,0,'Pauzetijd telde mee als luistertijd');
paused.advance(1000,true);
assert.equal(paused.suite.discoveries().length,1,'Cumulatieve actieve luistertijd werd niet geteld');

const switched=radioSuiteRuntime();
switched.advance(20000);
switched.context.playback.item={id:'known'};
switched.advance(1000);
switched.context.playback.item={id:'d1'};
switched.sync();
switched.advance(29000);
assert.equal(switched.suite.discoveries().length,0,'Trackwissel heeft Discovery-voortgang niet gereset');
switched.advance(1000);
assert.equal(switched.suite.discoveries().length,1);
switched.advance(10000);
assert.equal(switched.suite.discoveries().length,1,'Dezelfde Discovery werd dubbel geteld');

// "Your Month on MAIR" en "Your Year on MAIR" zijn uit het product gehaald; alleen de
// week blijft. Deze test bewaakt beide kanten: de week rendert nog volledig, en de
// periodeschakelaar met MONTH/YEAR komt niet terug.
function profileRenderRuntime({recapData={topArtist:'Artiest',topTrack:'Nummer',minutes:120,tracks:9,insight:'Inzicht'}}={}){
  const gemaakt=[];
  const maakElement=()=>{const el={id:'',className:'',style:{},dataset:{},children:[],innerHTML:'',classList:{add(){},remove(){},toggle(){}},appendChild(kind){el.children.push(kind);return kind},insertBefore(kind){el.children.push(kind);return kind},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},remove(){},setAttribute(){},insertAdjacentElement(){},closest:()=>null};gemaakt.push(el);return el};
  const pane=maakElement();pane.id='tab-settings';
  const perId={'tab-settings':pane};
  const document={readyState:'complete',hidden:false,head:{appendChild(){}},body:{appendChild(){},classList:{add(){},remove(){}}},
    getElementById:id=>perId[id]||null,querySelector:()=>null,querySelectorAll:()=>[],
    createElement:()=>{const el=maakElement();return el},addEventListener(){}};
  const window={MAIRModeManager:{recap:()=>recapData},JFMRadioSuite:{state:()=>({minutes:600,tracks:120})},addEventListener(){},dispatchEvent(){}};
  const context={window,document,localStorage:storage(),sessionStorage:storage(),CustomEvent:class{},location:{reload(){}},prompt:()=>null,confirm:()=>false,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},console};
  vm.runInNewContext(profileSource,context,{filename:'mair-profile.js'});
  window.MAIRProfile.render();
  // De paginacontainer is het element dat aan tab-settings is toegevoegd.
  const html=pane.children.map(c=>c.innerHTML||'').join(String.fromCharCode(10));
  return {api:window.MAIRProfile,html};
}

const weekRender=profileRenderRuntime();
assert.ok(weekRender.html.includes('Your Week on MAIR'),'De weekkaart moet nog steeds "Your Week on MAIR" tonen');
assert.ok(weekRender.html.includes('mair-profile-week-grid'),'Het weekraster met TOP ARTIST/TRACKS moet blijven bestaan');
assert.ok(weekRender.html.includes('TOP ARTIST')&&weekRender.html.includes('ONTDEKKINGEN'),'De weekcijfers moeten blijven staan');
assert.ok(weekRender.html.includes('Artiest')&&weekRender.html.includes('Nummer'),'De weekdata uit recap() moet nog worden gerenderd');
assert.ok(!/Your (Month|Year) on MAIR/.test(weekRender.html),'Month en Year mogen niet meer als kop verschijnen');
assert.ok(!weekRender.html.includes('data-profile-period'),'De periodeschakelaar mag niet terugkomen');
assert.ok(!/>MONTH<|>YEAR</.test(weekRender.html),'De MONTH- en YEAR-knoppen mogen niet terugkomen');
assert.equal(typeof weekRender.api.selectedPeriod,'undefined','selectedPeriod hoort niet meer geexporteerd te zijn');
assert.ok(!/monthly|yearly/.test(profileSource),'Er mag geen maand- of jaarlogica meer in mair-profile.js staan');
// De opgeslagen periodekeuze is nu betekenisloos en moet bij een profiel-reset worden opgeruimd.
assert.ok(profileSource.includes("'mair_profile_recap_period_v1'"),'De oude periodesleutel moet nog wel worden gewist bij een reset');

console.log('PASS Your Week on MAIR intact, Month en Year verwijderd');
console.log('PASS release consistency');
console.log('PASS profile cleanup and Spotify status');
console.log('PASS isolated advanced diagnostics and retired-control safety');
console.log('PASS Discovery queue marking');
console.log('PASS Discovery active-listening threshold, pause, reset and dedupe');
