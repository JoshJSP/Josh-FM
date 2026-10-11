// Bewaakt de reparaties uit de nachtronde van 12-10-2026. Waar mogelijk gedrag, anders de aanwezigheid van de reparatie.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
// director: geheugen wordt aangevuld
{const s=read('director.js'),m=s.match(/const EMPTY_MEMORY[^\n]*\n(const memory=[^\n]*\n)/);ok('director: memory() normaliseert',!!m);
 if(m){const run=raw=>vm.runInNewContext(m[0].replace(/^const /gm,'var ')+';memory()',{localStorage:{getItem:()=>raw},memoryKey:'k',JSON,Array});
  const a=run('{"completions":{"a":1}}');ok('director: deel-opslag krijgt plays/likes/requests',a.plays&&a.likes&&a.requests&&a.completions.a===1);
  ok('director: kapotte JSON geeft leeg geheugen',!!run('{kapot').plays);ok('director: array/null geeft leeg geheugen',!!run('[1]').likes&&!!run('null').likes)}}
// discovery: eerste start = 50
{const s=read('discovery.js');ok('discovery: geen opslag valt terug op 50',s.includes('rawStored===null?NaN:Number(rawStored)'))}
// verzoeken: dubbele tik tijdens resolveTrack
{const s=read('request-manager.js');ok('request-manager: dubbel-check na await resolveTrack',/await resolveTrack\(uri,button\);\{const again=activeFor\(uri\)/.test(s))}
// service worker: SDK niet door de 10 s-afbreker, update herlaadt niet midden in een nummer
{ok('sw: scdn.co wordt niet onderschept',read('sw.js').includes("url.hostname.includes('scdn.co')"));
 const p=read('pwa-platform.js');ok('pwa: controllerchange wacht op pauze',p.includes('isPlaying()')&&p.includes("setInterval(()=>{if(isPlaying())return;clearInterval(t);location.reload()},10000)"))}
// speler: mislukte devices-lookup koppelt niets los
{const s=read('stability-core.js');ok('stability: mislukte devices-lookup telt als beschikbaar',/async function isAvailable\(id=deviceId\)\{if\(!id\)return false;try\{const d=await api\('\/me\/player\/devices'\);if\(!Array\.isArray\(d\?\.devices\)\)return true;[^\n]*catch\{return true\}\}/.test(s))}
console.log(`MAIR nachtronde fixes: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
