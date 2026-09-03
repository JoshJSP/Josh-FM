import fs from 'node:fs';
import {RELEASE_CACHE, RELEASE_ASSET_VERSION} from './release-cache.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const checks=[];
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)console.error('FAIL',name);else console.log('PASS',name)};
const has=(src,...needles)=>needles.every(n=>src.includes(n));

const clock=read('station-clock.js');
const rotation=read('rotation-engine.js');
const memory=read('dj-memory.js');
const imaging=read('mair-imaging.js');
const liveNews=read('mair-live-news.js');
const bulletin=read('mair-news-bulletin.js');
const headlines=read('api/live-headlines.js');
const bulletinWriter=read('api/news-bulletin.js');
const voiceLab=read('mair-voice-lab.js');
const soak=read('mair-soak-monitor.js');
const director=read('mair-station-director.js');
const sleep=read('mair-sleep.js');
const budget=read('spotify-api-budget.js');
const upcoming=read('spotify-upcoming-truth.js');
const dj=read('mair-dj-v2.js');
const writer=read('api/dj-writer.js');
const liveContext=read('mair-live-context.js');
const diagnostics=read('mair-diagnostics-hub.js');
const testLab=read('mair-test-lab.js');
const userControls=read('mair-user-controls.js');
const templateAssets=read('mair-template-assets.css');
const runtime=read('mair-runtime-core.js');
const version=read('version.js');
const sw=read('sw.js');
const apiVersion=read('api/version.js');

check('show clock v3 active',has(clock,"station-clock-v3-show-director","MAIR Morning","MAIR Drive","MAIR Late Night"));
check('special shows exist',has(clock,"weekend-warmup","new-music","saturday-night","throwback-lunch","top40"));
check('show clock assigns DJs',has(clock,"djId:'josh'","djId:'maya'","djId:'max'","djId:'noah'"));
check('show clock exposes radio moments',has(clock,"Top of hour","Half-hour show ID","jfm:clock-moment","jfm:show-change"));

check('MAIR Director horizon active',has(rotation,"mair-director-v3-horizon","HORIZON_TRACKS=10","cooldownPenalty","transitionPenalty","clockFit","momentum","modeScore"));
check('music director separates tracks and artists',has(rotation,'TRACK_COOLDOWN_PLAYS=24','ARTIST_WINDOW=10','lastArtists'));
check('music director respects requests',has(rotation,"return'Request'","JFMRequests","jfmIsRequest"));
check('music director uses personal learning',has(rotation,'likes','discoveryWins','discoveryLosses','jfm_skips'));
check('music director explains choices',has(rotation,'function reason','_why=reason'));
check('Sleep uses low momentum',has(rotation,"station==='sleep'?-.24","station==='sleep'?.28"));

check('authoritative DJ memory active',has(memory,"OWNER='authoritative-dj-memory'","snapshot","observeTrack","metric","commit","function list()"));
check('DJ runtime consumes persistent memory',has(dj,'window.MAIRDJMemory','memory()?.snapshot','memory()?.commit'));
check('DJ writer receives anti-repeat context',has(writer,'recentBreaks','usedFactIds','Vermijd recente openingen'));

check('radio imaging active',has(imaging,'mair-imaging-v1','sonicLogo','beforeBreak','shouldPlay'));
check('imaging respects user jingles toggle',has(imaging,"$('jingles')?.checked",'document.visibilityState'));
check('DJ handoff calls imaging before speech',has(dj,'MAIRImaging?.beforeBreak','await playPrepared(pack)'));

check('live news is opt-in',has(liveNews,"mair_news_enabled_v1","MAIR Nieuws (:00) + headlines (:30)",'setEnabled'));
check('half-hour headline is isolated from top-of-hour news',has(liveNews,'COOLDOWN=27*60*1000','12*60*60*1000',"p!=='half'",'LAST_SLOT','LAST_TITLE'));
check('live news exposes fresh bulletin items',has(liveNews,'bulletinItems(max=6)','FEED_MAX_AGE=20*60*1000','feedFresh'));
check('headline API is source attributed, summarized and cached',has(headlines,'feeds.nos.nl','sourceLabel','summary:description','TTL=5*60*1000','stale-while-revalidate'));
check('half-hour news remains isolated from Radio Brain',!dj.includes('MAIRLiveNews?.take')&&has(liveNews,'bulletinItems','feedFresh'));
check('DJ writer remains source constrained',has(writer,'Feiten mogen uitsluitend uit ALLOWED FACTS','Verzin nooit jaartallen','allowedFacts'));
check('hourly news bulletin prepares before a natural transition',has(bulletin,"mair-news-bulletin-v1-hourly-natural-transition","jfm:natural-next-ready","prepareSpeech","GRACE_MINUTE=12"));
check('hourly news uses only primary playback transport',has(bulletin,'window.JFMPlayback','djPause','djRewind','djResume')&&!bulletin.includes("api('/me/player")&&!bulletin.includes('fetch(\'/me/player'));
check('hourly news yields to an active DJ handoff',has(bulletin,'djHasPriority','HANDOFF','SPEAKING','RESTORING'));
check('hourly news writer is source constrained',has(bulletinWriter,'uitsluitend de aangeleverde nieuwsitems','Gebruik geen eigen kennis','Dit is MAIR Nieuws.','Dit was MAIR Nieuws. Je luistert naar MAIR.'));
check('hourly news has deterministic fallback',has(bulletinWriter,'deterministic-news','fallback(items,source'));

check('show-driven presenter mode active',has(liveContext,"mair-live-context-v3-show-mode","mode==='show'","jfm:show-change","showDJ"));
check('weather/time context retained',has(liveContext,'weatherHint','timeHint','contextFor'));

check('voice lab compares all four DJs',has(voiceLab,"DJS=['josh','maya','max','noah']",'exact dezelfde tekst','/api/tts'));
check('voice lab uses central audio unlock',has(voiceLab,'JFMDJAudio?.unlock','active=id'));

check('60 minute soak monitor active',has(soak,'60+ MINUTEN SOAK TEST','start(minutes=60)','trackChanges','djMissed','reloadRepairs'));
check('soak monitor is passive',has(soak,'De monitor bestuurt Spotify niet','jfm:trackchange','mair:reload-audibility'));

check('station director dashboard active',has(director,'MAIR CONTROL ROOM','VOLGENDE 5 TRACKS','LAATSTE DJ-LINKS','STATION HEALTH'));
check('station director exposes radio controls',has(director,'dj-now','skip-dj','talk-down','talk-up'));

check('Sleep screen active',has(sleep,'MAIR SLEEP','Stop na dit nummer','data-sleep-minutes="15"','data-sleep-minutes="60"'));
check('Sleep keeps playback single-owner',has(sleep,'window.JFMPlayback?.pause',"truth?.begin?.('pause'")&&!sleep.includes("api('/me/player"));
check('Sleep timer removed from Settings owner',has(userControls,'settings-only','Car Mode')&&!userControls.includes('Sleeptimer')&&!userControls.includes('data-mair-sleep'));
check('Sleep has dedicated station cover',has(templateAssets,"assets/stations/mair-sleep.svg?v=78")&&sw.includes("'./assets/stations/mair-sleep.svg'"));
check('Spotify budget is rate-limit aware',has(budget,'POLL_MS=30000','cooldownUntil','api-budget-v2-rate-limit-aware'));
check('Spotify upcoming queue is no longer 1.6s polling',has(upcoming,'WATCHDOG_MS=15000','FORCE_DEDUPE_MS=1200','rate-limit-aware')&&!upcoming.includes('setInterval(()=>sync(false),1600)'));

check('diagnostics exposes radio brain and correlated breaks',has(testLab,'RADIO BRAIN','BREAK DECISION','BREAK ID','RETRIES','TIMINGS'));
check('diagnostic/test UI is centralized',has(diagnostics,'MAIRDiagnosticsHub',"moveCard('mairTraceCard'","moveCard('mairTestLabCard'"));
check('DJ runtime preserves automatic cadence',has(dj,'v4.1-audible-handoff-evidence','rebasePreparation','prepareRebases','mair:track-transition','NATURAL_END'));

const versionRuntime=['./dj-memory.js','./mair-imaging.js','./mair-live-news.js','./mair-news-bulletin.js','./mair-voice-lab.js','./mair-soak-monitor.js','./mair-station-director.js','./mair-sleep.js'];
const cachedRuntime=[...versionRuntime,'./spotify-api-budget.js','./spotify-upcoming-truth.js'];
check('version loader wires UI radio experience modules',versionRuntime.every(x=>version.includes(x))&&version.includes(`JFM_ASSET_VERSION='${RELEASE_ASSET_VERSION}'`));
check('service worker caches all radio experience modules',cachedRuntime.every(x=>sw.includes(x))&&sw.includes(RELEASE_CACHE));
check('server release endpoint matches release cache',apiVersion.includes(RELEASE_CACHE));
check('runtime facade remains explicit',has(runtime,"const owners=","playback:'playback-primary + mair-reload-audibility'","dj:'mair-dj-v2'"));

const failed=checks.filter(x=>!x.ok);
console.log(`MAIR radio experience v2: ${checks.length-failed.length} PASS / ${failed.length} FAIL`);
if(failed.length){console.error('Failed:',failed.map(x=>x.name).join(', '));process.exit(1)}
