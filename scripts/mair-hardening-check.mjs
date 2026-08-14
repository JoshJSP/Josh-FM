import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('mair-ui-hardening.js'),purity=read('mair-category-purity.js'),guard=read('mair-playback-category-guard.js'),orchestrator=read('mair-build-orchestrator.js'),pwa=read('mair-pwa-polish.js'),sw=read('sw.js'),tts=read('api/tts.js');
for(const id of ['hits','top40','new','nl','party','chill','summer','throwback','00s','10s','mix'])if(!ui.includes(`'${id}'`))throw Error('Station ontbreekt in UI-hardening: '+id);
if(/Today's biggest hits|The songs you love|Relax & unwind|Energy\. Dance\. Repeat\.|Find your next favorite|Your radio\. Your way\./.test(ui))throw Error('Engelse stationtekst teruggevonden');
if(!ui.includes(".mair-personal-row>strong,.mair-station-card>strong"))throw Error('Pijl-opruiming ontbreekt');
if(/new\s+MutationObserver\s*\(\s*\(\)\s*=>\s*sync\s*\(\s*\)\s*\)/.test(ui))throw Error('UI-hardening mag geen zelf-triggerende MutationObserver sync-loop bevatten');
for(const id of ['nl','party','chill','summer'])if(!purity.includes(`'${id}'`))throw Error('Semantische purity ontbreekt: '+id);
if(!purity.includes('confidence')&& !read('api/category-filter.js').includes('confidence>=0.90'))throw Error('Confidence gate ontbreekt');
if(!guard.includes("channel==='mix'")||!guard.includes("api('/tracks/'"))throw Error('Direct-play category guard ontbreekt');
if(guard.includes('if(already)return original'))throw Error('Queued tracks mogen strict-category validatie niet omzeilen');
if(!guard.includes("version:'mair-playback-category-guard-v1.1-validate-queued'"))throw Error('Queued-track category guard versie ontbreekt');
if(!orchestrator.includes('startChannel')||!orchestrator.includes('generation'))throw Error('Stale build guard ontbreekt');
const hardeningFiles=['mair-category-purity.js','mair-ui-hardening.js','mair-playback-category-guard.js','mair-build-orchestrator.js'];
for(const file of hardeningFiles){
 if(!pwa.includes(file))throw Error('Hardening script wordt niet geladen: '+file);
 if(!sw.includes(`./${file}`))throw Error('Hardening script ontbreekt in PWA CORE-cache: '+file);
}
if(!/const CACHE='mair-v49-hardening-cache-20260814'/.test(sw))throw Error('PWA cacheversie niet verhoogd voor hardening-update');
const voices=[...tts.matchAll(/\b(josh|maya|max|noah):'([a-f0-9]{32})'/g)].map(m=>m[2]);if(voices.length<4||new Set(voices).size<4)throw Error('DJ-profielen hebben geen vier unieke standaardstemmen');
console.log('MAIR hardening checks: OK');