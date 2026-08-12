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
const truth=read('playback-state.js');
const top40=read('personal-top40.js');
const health=read('station-health.js');
const spotifyConfig=read('spotify-test-config.js');
const discovery=read('discovery.js');
const djHandoff=read('dj-handoff-v34.js');
const legacyDj=read('dj-now-queue.js');
const integration=read('integration-guards.js');
const apiBudget=read('spotify-api-budget.js');

// 1. Whole UI contract.
const criticalIds=['status','tab-radio','tab-requests','tab-settings','prev','play','next','start','djNow','skipTalk','searchInput','searchBtn','source','rebuild','queueInfo','autoProgram','discovery','talk','facts','timeMention','weatherMention','jingles','voiceMode','testVoice','setup','clientId','connect','clearHistory','logout'];
for(const id of criticalIds)check(`UI id #${id}`,new RegExp(`id=["']${id}["']`).test(index));
for(const tab of ['radio','requests','settings'])check(`tab ${tab}`,new RegExp(`data-tab=["']${tab}["']`).test(index)&&index.includes(`id="tab-${tab}"`));

// 2. Static assets.
const localScripts=[...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/.test(x)).map(x=>x.replace(/^\.\//,''));
const localStyles=[...index.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/.test(x)&&!x.startsWith('data:')).map(x=>x.replace(/^\.\//,''));
for(const f of [...new Set([...localScripts,...localStyles])])check(`asset exists ${f}`,exists(f));
check('no duplicate script tags',new Set(localScripts).size===localScripts.length,localScripts.join(', '));

// 3. Dynamic modules and PWA cache.
const modules=[...suite.matchAll(/\['\.\/(.+?\.js)'\s*,\s*'[^']+'\]/g)].map(m=>m[1]);
check('radio-suite discovers modules',modules.length>=10,`${modules.length} modules`);
for(const f of modules){check(`module exists ${f}`,exists(f));check(`service worker caches ${f}`,sw.includes(`'./${f}'`));}
for(const f of localScripts)check(`service worker caches entry script ${f}`,sw.includes(`'./${f}'`)||f==='app.js'&&sw.includes("'./app.js'"));
for(const f of ['dj-handoff-v34.js','spotify-api-budget.js']){check(`dynamic module exists ${f}`,exists(f));check(`dynamic module cached ${f}`,sw.includes(`'./${f}'`));}

// 4. API route references and backend safety.
const runtimeFiles=fs.readdirSync(root).filter(f=>f.endsWith('.js'));
const apiRefs=new Set();
for(const f of runtimeFiles){const s=read(f);for(const m of s.matchAll(/fetch\(\s*[`"']\/api\/([a-zA-Z0-9_-]+)/g))apiRefs.add(m[1]);}
for(const name of apiRefs)check(`API route /api/${name}`,exists(`api/${name}.js`));
for(const f of ['api/fact.js','api/discover.js','api/dj.js']){const s=read(f);check(`${f} external timeout`,s.includes('AbortController')&&s.includes('timedFetch'));}
check('Fish backend validates audio response',read('api/tts.js').includes('Fish Audio returned empty audio')&&read('api/tts.js').includes("type.includes('json')"));

// 5. Playback architecture: one SDK owner, one transport owner, one DJ owner.
const runtimeJs=runtimeFiles.filter(f=>!f.startsWith('scripts/'));
const playerCreators=runtimeJs.filter(f=>read(f).includes('new Spotify.Player'));
check('one Spotify SDK player owner',playerCreators.length===1&&playerCreators[0]==='stability-core.js',playerCreators.join(', ')||'none');
check('SDK core auth-device only',sdk.includes('sdk-core-v3-auth-device-only'));
check('SDK core no transport ownership',!/ownButton\(['"](?:start|play|next|prev)/.test(sdk));
check('SDK core no DJ ownership',!sdk.includes('window.djBreak=')&&!sdk.includes('stableDJBreak'));
check('SDK stale device is cleared',sdk.includes('not_ready')&&sdk.includes("rememberDevice('')"));
check('SDK explicit empty state handled',sdk.includes('item:null')&&sdk.includes('sdk-empty'));
check('primary controller owns transport',primary.includes("JFMPlaybackPrimary='playback-primary'")&&primary.includes("own('start'")&&primary.includes("own('play'")&&primary.includes("own('next'")&&primary.includes("own('prev'"));
const competingOwners=runtimeJs.filter(f=>f!=='playback-primary.js'&&/(?:ownButton|own|replace)\(['"](?:start|play|next|prev)['"]/.test(read(f)));
check('no competing transport owner',competingOwners.length===0,competingOwners.join(', '));
check('iPhone gesture unlock before transport',primary.includes('activateElement')&&primary.includes("document.addEventListener('click'"));
check('Spotify commands are verified',primary.includes('async function verify')&&primary.includes('Spotify bevestigde'));
check('recovery delegates to primary',exists('spotify-recovery.js')&&read('spotify-recovery.js').includes('recovery-v6-delegated'));
check('explicit track play keeps station context',primary.includes('stationContext')&&primary.includes('playContextDirect'));
check('skip has queue rebuild fallback',primary.includes('stationNeighbor')&&primary.includes('primary-next-fallback'));
check('playback truth clears empty sessions',truth.includes('explicitlyEmpty')&&truth.includes('truth-v2-empty-state-safe'));

// 6. Spotify API budget and discovery pressure.
check('API budget event-driven',apiBudget.includes("jfm:trackchange")&&apiBudget.includes('api-budget-v1-event-driven'));
check('API watchdog is 15 seconds',apiBudget.includes('POLL_MS=15000'));
check('API budget loader configured',spotifyConfig.includes('spotify-api-budget.js?v=35')&&spotifyConfig.includes('loadApiBudget'));
check('Spotify API guard installed',spotifyConfig.includes('JFMSpotifyGuard'));
check('discovery rate limit cooldown',spotifyConfig.includes('cooldownUntil')&&spotifyConfig.includes('429'));
check('track URI validation',spotifyConfig.includes('isTrackUri')&&spotifyConfig.includes('spotify:track:'));
check('device ID validation',spotifyConfig.includes('isDevice')&&spotifyConfig.includes('device_ids'));
check('search cache five minutes',spotifyConfig.includes('300000'));
check('search pacing 1500ms',spotifyConfig.includes('1500-(Date.now()-lastSearchAt)'));
check('discovery budget <= 5 calls',/MAX_SEARCHES=([0-5])\b/.test(discovery));
check('discovery obeys shared cooldown',discovery.includes('sharedCooldown')&&discovery.includes('JFMSpotifyGuard'));

// 7. DJ/Fish ownership and fail-open behavior.
check('Fish/TTS route used',runtimeFiles.some(f=>read(f).includes("'/api/tts")||read(f).includes('"/api/tts')));
check('station health tests Fish',health.includes('Fish/TTS route')&&health.includes('Fish Audio guard'));
check('music-first safe mode',health.includes('jfmMusicRun=true')&&health.includes('skipNextTalk=true'));
check('station health tests playback controller',health.includes("'Playback controller'")&&health.includes('JFMPlayback'));
check('DJ handoff preserves queue context',djHandoff.includes('resumePreservingContext')&&djHandoff.includes("api(pathWithDevice('/me/player/play'),{method:'PUT'})"));
check('DJ handoff does not restart at zero',!djHandoff.includes('position_ms:0')&&!djHandoff.includes('seek(0)')&&!djHandoff.includes('position_ms=0'));
check('DJ handoff validates Spotify device',djHandoff.includes('const DEVICE=')&&djHandoff.includes('validDevice'));
check('DJ manual control migrated to handoff',djHandoff.includes("dataset.jfmHandoffOwner='v34'")&&djHandoff.includes('cloneNode(true)'));
check('legacy DJ transition engine disabled',legacyDj.includes('legacy-disabled-v35')&&!legacyDj.includes('/me/player/pause')&&!legacyDj.includes('seek(0)'));
check('DJ resume shim names central owner',read('dj-resume.js').includes("owner:'dj-handoff-v34.js'"));
check('DJ handoff loader configured',spotifyConfig.includes('dj-handoff-v34.js?v=35')&&spotifyConfig.includes('loadDJHandoff'));

// 8. Settings/data contracts.
check('Top 40 canonical dedupe',top40.includes('canonicalKey')&&top40.includes('mergeEntries'));
check('Top 40 clear function',top40.includes('function clearTop40')&&top40.includes("localStorage.removeItem(KEY)"));
check('Top 40 settings button',top40.includes('id="clearTop40"')&&top40.includes("tab-settings"));
check('Top 40 API exposed',top40.includes("version:'top40-v2-dedup-clear'")&&top40.includes('clear:clearTop40'));
check('local-memory clear owns button',integration.includes("dataset.jfmDataOwner='v35'")&&integration.includes('clearPersonalMemory'));
check('local-memory clear covers requests',integration.includes("'jfm_requests_v1'")&&integration.includes("'jfm_director_memory'")&&integration.includes("'jfm_dj_feedback'"));
check('Spotify logout owns button',integration.includes("dataset.jfmLogoutOwner='v35'")&&integration.includes('disconnectSpotify'));
check('Spotify logout clears device/auth state',integration.includes("'jfm_spotify_device_id'")&&integration.includes("'jfm_pkce_verifier_v2'")&&integration.includes('disconnect?.()'));

// 9. PWA/update contract.
check('service worker cache version >= 35',/josh-fm-v(?:3[5-9]|[4-9]\d|\d{3,})/.test(sw));
check('primary controller cached',sw.includes("'./playback-primary.js'"));
check('API budget cached',sw.includes("'./spotify-api-budget.js'"));
check('DJ handoff cached',sw.includes("'./dj-handoff-v34.js'"));
check('old playback-web-sdk not cached',!sw.includes('playback-web-sdk.js'));
check('primary loader configured',spotifyConfig.includes('playback-primary.js?v=35'));

// 10. No obsolete controller files or temporary deployment artifacts.
for(const f of ['playback-web-sdk.js','spotify-core.js','stable-playback.js'])check(`legacy controller removed ${f}`,!exists(f));
for(const f of ['.noop','.placeholder','__noop__'])check(`temporary file absent ${f}`,!exists(f));

console.log(`Josh FM whole-app smoke: ${pass.length} PASS, ${fail.length} FAIL`);
if(fail.length){for(const x of fail)console.error('FAIL:',x);process.exit(1)}
for(const x of pass)console.log('PASS:',x);
