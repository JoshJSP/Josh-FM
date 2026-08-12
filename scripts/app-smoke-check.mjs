import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const pass=[];const fail=[];
const check=(name,cond,detail='')=>(cond?pass:fail).push(`${name}${detail?` — ${detail}`:''}`);

const index=read('index.html');
const suite=read('radio-suite.js');
const sw=read('sw.js');
const primary=read('playback-primary.js');
const sdk=read('stability-core.js');
const top40=read('personal-top40.js');
const health=read('station-health.js');
const spotifyConfig=read('spotify-test-config.js');
const djHandoff=read('dj-handoff-v34.js');

// 1. Whole UI contract: all primary screens and controls must exist.
const criticalIds=['status','tab-radio','tab-requests','tab-settings','prev','play','next','start','djNow','skipTalk','searchInput','searchBtn','source','rebuild','queueInfo','autoProgram','discovery','talk','facts','timeMention','weatherMention','jingles','voiceMode','testVoice','setup','clientId','connect','clearHistory','logout'];
for(const id of criticalIds)check(`UI id #${id}`,new RegExp(`id=["']${id}["']`).test(index));
for(const tab of ['radio','requests','settings'])check(`tab ${tab}`,new RegExp(`data-tab=["']${tab}["']`).test(index)&&index.includes(`id="tab-${tab}"`));

// 2. Every statically loaded local asset must exist.
const localScripts=[...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/.test(x)).map(x=>x.replace(/^\.\//,''));
const localStyles=[...index.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/.test(x)&&!x.startsWith('data:')).map(x=>x.replace(/^\.\//,''));
for(const f of [...new Set([...localScripts,...localStyles])])check(`asset exists ${f}`,exists(f));
check('no duplicate script tags',new Set(localScripts).size===localScripts.length,localScripts.join(', '));

// 3. Every dynamically loaded radio-suite module exists and is cached by the PWA.
const modules=[...suite.matchAll(/\['\.\/(.+?\.js)'\s*,\s*'[^']+'\]/g)].map(m=>m[1]);
check('radio-suite discovers modules',modules.length>=10,`${modules.length} modules`);
for(const f of modules){check(`module exists ${f}`,exists(f));check(`service worker caches ${f}`,sw.includes(`'./${f}'`));}
for(const f of localScripts)check(`service worker caches entry script ${f}`,sw.includes(`'./${f}'`)||f==='app.js'&&sw.includes("'./app.js'"));
check('dynamic DJ handoff exists',exists('dj-handoff-v34.js'));
check('dynamic DJ handoff cached',sw.includes("'./dj-handoff-v34.js'"));

// 4. Local API route contract: every fetch('/api/x') must have api/x.js.
const runtimeFiles=fs.readdirSync(root).filter(f=>f.endsWith('.js'));
const apiRefs=new Set();
for(const f of runtimeFiles){const s=read(f);for(const m of s.matchAll(/fetch\(\s*[`"']\/api\/([a-zA-Z0-9_-]+)/g))apiRefs.add(m[1]);}
for(const name of apiRefs)check(`API route /api/${name}`,exists(`api/${name}.js`));

// 5. Playback architecture: one SDK owner, one transport owner, delegated recovery.
const runtimeJs=runtimeFiles.filter(f=>!f.startsWith('scripts/'));
const playerCreators=runtimeJs.filter(f=>read(f).includes('new Spotify.Player'));
check('one Spotify SDK player owner',playerCreators.length===1&&playerCreators[0]==='stability-core.js',playerCreators.join(', ')||'none');
check('SDK core declares no transport ownership',sdk.includes('sdk-core-v2-no-transport-owner')&&!/ownButton\(['"](?:start|play|next|prev)/.test(sdk));
check('primary controller owns transport',primary.includes("JFMPlaybackPrimary='playback-primary'")&&primary.includes("own('start'")&&primary.includes("own('play'")&&primary.includes("own('next'")&&primary.includes("own('prev'"));
const competingOwners=runtimeJs.filter(f=>f!=='playback-primary.js'&&/(?:ownButton|own|replace)\(['"](?:start|play|next|prev)['"]/.test(read(f)));
check('no competing transport owner',competingOwners.length===0,competingOwners.join(', '));
check('iPhone gesture unlock before transport',primary.includes('activateElement')&&primary.includes("document.addEventListener('click'"));
check('Spotify commands are verified',primary.includes('async function verify')&&primary.includes('Spotify bevestigde'));
check('recovery delegates to primary',exists('spotify-recovery.js')&&read('spotify-recovery.js').includes('recovery-v6-delegated'));
check('explicit track play keeps station context',primary.includes('stationContext')&&primary.includes('playContextDirect'));
check('skip has queue rebuild fallback',primary.includes('stationNeighbor')&&primary.includes('primary-next-fallback'));

// 6. Top 40 feature contract and settings management.
check('Top 40 canonical dedupe',top40.includes('canonicalKey')&&top40.includes('mergeEntries'));
check('Top 40 clear function',top40.includes('function clearTop40')&&top40.includes("localStorage.removeItem(KEY)"));
check('Top 40 settings button',top40.includes('id="clearTop40"')&&top40.includes("tab-settings"));
check('Top 40 API exposed',top40.includes("version:'top40-v2-dedup-clear'")&&top40.includes('clear:clearTop40'));

// 7. DJ/Fish fail-open and health diagnostics must remain present.
check('Fish/TTS route used',runtimeFiles.some(f=>read(f).includes("'/api/tts")||read(f).includes('"/api/tts')));
check('station health tests Fish',health.includes('Fish/TTS route')&&health.includes('Fish Audio guard'));
check('music-first safe mode',health.includes('jfmMusicRun=true')&&health.includes('skipNextTalk=true'));
check('station health tests playback controller',health.includes("'Playback controller'")&&health.includes('JFMPlayback'));
check('DJ handoff preserves queue context',djHandoff.includes('resumePreservingContext')&&djHandoff.includes("api(pathWithDevice('/me/player/play'),{method:'PUT'})"));
check('DJ handoff does not restart at zero',!djHandoff.includes('position_ms:0')&&!djHandoff.includes('seek(0)')&&!djHandoff.includes('position_ms=0'));
check('DJ handoff validates Spotify device',djHandoff.includes('const DEVICE=')&&djHandoff.includes('validDevice'));
check('DJ manual control migrated to handoff',djHandoff.includes("dataset.jfmHandoffOwner='v34'")&&djHandoff.includes('cloneNode(true)'));

// 8. Spotify request safety/discovery rate-limit protection.
check('Spotify API guard installed',spotifyConfig.includes('JFMSpotifyGuard'));
check('discovery rate limit cooldown',spotifyConfig.includes('cooldownUntil')&&spotifyConfig.includes('429'));
check('track URI validation',spotifyConfig.includes('isTrackUri')&&spotifyConfig.includes('spotify:track:'));
check('DJ handoff loader configured',spotifyConfig.includes('dj-handoff-v34.js?v=34')&&spotifyConfig.includes('loadDJHandoff'));

// 9. PWA/update contract.
check('service worker cache version >= 34',/josh-fm-v(?:3[4-9]|[4-9]\d|\d{3,})/.test(sw));
check('primary controller cached',sw.includes("'./playback-primary.js'"));
check('DJ handoff cached',sw.includes("'./dj-handoff-v34.js'"));
check('old playback-web-sdk not cached',!sw.includes('playback-web-sdk.js'));
check('primary loader configured',spotifyConfig.includes('playback-primary.js?v=34'));

// 10. No old controller files or temporary deployment artifacts.
for(const f of ['playback-web-sdk.js','spotify-core.js','stable-playback.js'])check(`legacy controller removed ${f}`,!exists(f));
for(const f of ['.noop','.placeholder','__noop__'])check(`temporary file absent ${f}`,!exists(f));

console.log(`Josh FM whole-app smoke: ${pass.length} PASS, ${fail.length} FAIL`);
if(fail.length){for(const x of fail)console.error('FAIL:',x);process.exit(1)}
for(const x of pass)console.log('PASS:',x);
