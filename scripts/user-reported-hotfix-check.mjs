import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sleep=read('mair-sleep.js'),choice=read('music-choice.js'),policy=read('mair-station-policy.js'),classifier=read('api/category-filter.js'),purity=read('mair-category-purity.js'),rotation=read('rotation-engine.js'),queue=read('station-queue.js'),news=read('mair-live-news.js'),dj=read('mair-dj-v2.js'),owedGuard=read('mair-dj-break-owed-guard.js'),transitionFallback=read('mair-dj-transition-fallback.js'),sequencer=read('mair-radio-sequencer.js'),version=read('version.js'),build7=read('build7.js'),sw=read('sw.js'),budget=read('spotify-api-budget.js'),upcoming=read('spotify-upcoming-truth.js'),userControls=read('mair-user-controls.js'),diagnostics=read('mair-diagnostics-hub.js'),testLab=read('mair-test-lab.js'),assets=read('mair-template-assets.css');

assert.match(sleep,/mair-sleep-v1\.2/);
assert.match(sleep,/data-sleep-minutes="15"/);assert.match(sleep,/data-sleep-minutes="30"/);assert.match(sleep,/data-sleep-minutes="45"/);assert.match(sleep,/data-sleep-minutes="60"/);
assert.match(sleep,/Stop na dit nummer/);assert.match(sleep,/Luister naar MAIR SLEEP/);
assert.match(sleep,/window\.JFMPlayback\?\.pause/);assert.doesNotMatch(sleep,/api\('\/me\/player/,'Sleep must never become a second Spotify transport owner');
assert.match(sleep,/truth\?\.begin\?\.\('pause'/);assert.match(sleep,/jfm:natural-track-end/);
assert.ok(sleep.indexOf("truth?.begin?.('pause'")<sleep.indexOf('const pause=window.JFMPlayback?.pause'),'sleep pause operation must block auto-advance before transport pause starts');
assert.doesNotMatch(userControls,/Sleeptimer|data-mair-sleep|MAIRSleepTimer/,'Settings must not own or render a second Sleep timer');
assert.match(userControls,/Car Mode/);assert.match(userControls,/settings-only/);

for(const [name,src] of [['music-choice',choice],['station-policy',policy],['classifier',classifier],['category-purity',purity]])assert.match(src,/sleep/,`${name} must include the SLEEP channel`);
assert.match(policy,/sleep:\{label:'MAIR SLEEP'.*minConfidence:\.94/s);assert.match(classifier,/sleep:'Accepteer alleen als dit overtuigend geschikt is om bij in slaap te vallen/);
assert.match(policy,/acoustic covers/);assert.match(policy,/soft acoustic covers/);assert.match(policy,/unplugged pop/);assert.doesNotMatch(policy,/deep sleep music|ambient sleep music|sleep music/,'Sleep search must be song-first, not ambient/noise-first');
assert.match(classifier,/Wijs ALTIJD af: white noise, brown noise, pink noise/);assert.match(classifier,/rustige akoestische radio-playlist/);
assert.match(purity,/channel==='sleep'\)return filtered/);assert.match(purity,/channel!=='sleep'/);
assert.match(rotation,/station==='sleep'\?-\.24/);assert.match(rotation,/targetMomentum=station==='sleep'\?\.28/);
assert.match(assets,/art-sleep\{background-image:url\('\.\/assets\/stations\/mair-sleep\.svg\?v=78'\)/);assert.match(sw,/\.\/assets\/stations\/mair-sleep\.svg/);

assert.match(queue,/if\(id==='hits'\)return 45/);assert.match(queue,/if\(id==='top40'\)return 35/);assert.match(queue,/!\['hits','top40'\]\.includes\(activeStation\)/);
assert.doesNotMatch(queue,/if\(candidates\.length<10\)\{const relaxed=generated\.filter\(t=>t\?\.id&&TRACK_URI\.test\(t\?\.uri\|\|''\)&&!oldIds\.has\(t\.id\)&&!candidates\.some/,'old repeat-bypass fallback must not return');

assert.match(news,/COOLDOWN=27\*60\*1000/);assert.match(news,/p!=='half'/);assert.match(news,/LAST_SLOT='mair_news_last_slot_v1'/);assert.match(news,/LAST_TITLE='mair_news_last_title_v1'/);assert.match(news,/function candidate\(\)\{return candidates\(\)\[0\]\|\|null\}/);assert.doesNotMatch(news,/headlines\|\|\[\]\)\.filter\(fresh\)\[0\]/,'headline selector must not fall back to the same used headline');

assert.match(dj,/v4\.0-radio-brain-1\.0/);assert.match(dj,/function rebasePreparation/);assert.match(dj,/prepareRebases/);assert.match(dj,/automatic-preparation-late/);assert.match(dj,/break-identity-cancellation-v2/);assert.doesNotMatch(dj,/miss\('automatic-break-not-ready'\)/);assert.match(dj,/radio-brain-separated-v1/);
assert.match(owedGuard,/mair-dj-break-owed-guard-v1/);assert.match(owedGuard,/lastMissReason!=='break-missed'/);assert.match(owedGuard,/MAIRDJ\?\.armManual/);assert.match(owedGuard,/pendingAir/);assert.match(owedGuard,/MAIRDJ\.prepare/);
assert.doesNotThrow(()=>new Function(transitionFallback),'DJ transition fallback must parse');
assert.match(transitionFallback,/mair-dj-transition-fallback-v1/);assert.match(transitionFallback,/shouldFastFallback/);assert.match(transitionFallback,/delay=shouldFastFallback\(\)\?180:2200/);assert.match(transitionFallback,/jfm:natural-next-ready/);assert.match(transitionFallback,/source:'trackchange-fallback'/);assert.match(transitionFallback,/previousTrackId\|\|lastTrackId/);

assert.doesNotThrow(()=>new Function(sequencer),'Radio sequencer must parse');
assert.match(sequencer,/mair-radio-sequencer-v1/);assert.match(sequencer,/new Set\(\['hits','top40','new','nl'\]\)/);assert.match(sequencer,/pattern=\[0,1,0,2,1,0,1,2\]/);assert.match(sequencer,/station==='new'\)return spread\(pool\)/);assert.match(sequencer,/mair_station_recent_starts_v1/);assert.match(sequencer,/reason==='station-switch'/);assert.match(sequencer,/c\.buildPool=async function/);

assert.match(diagnostics,/moveCard\('mairTraceCard','CENTRALE RUNTIME STATUS'\)/);assert.match(diagnostics,/moveCard\('mairTestLabCard','MAIR TEST LAB'\)/);assert.match(diagnostics,/moveCard\('mairVoiceCheckCard','COMPLETE VOICE CHECK'\)/);assert.match(testLab,/RADIO BRAIN/);assert.match(testLab,/FULL STATION TEST/i);
assert.match(version,/function scriptLoaded\(src\)/);assert.match(version,/document\.getElementById\(id\)\|\|scriptLoaded\(src\)/);assert.match(build7,/function scriptLoaded\(src\)/);assert.match(build7,/document\.getElementById\(id\)\|\|scriptLoaded\(src\)/);
assert.doesNotMatch(version,/addSyncScript\('mair-foundation-js'/);assert.doesNotMatch(version,/addSyncScript\('mair-radio-home-js'/);

assert.match(budget,/POLL_MS=30000/);assert.match(budget,/api-budget-v2-rate-limit-aware/);assert.match(budget,/cooldownUntil/);assert.match(budget,/match\(\/over\\s\+\(\\d\+\)\\s\*sec\/i\)/);
assert.match(upcoming,/WATCHDOG_MS=15000/);assert.match(upcoming,/FORCE_DEDUPE_MS=1200/);assert.match(upcoming,/v2-single-authoritative-owner-rate-limit-aware/);assert.doesNotMatch(upcoming,/setInterval\(\(\)=>sync\(false\),1600\)/,'Spotify queue truth may not poll every 1.6 seconds');

assert.match(version,/mair-sleep\.js/);assert.match(version,/mair-news-bulletin\.js/);assert.match(version,/mair-dj-break-owed-guard\.js/);assert.match(version,/mair-dj-transition-fallback\.js/);assert.match(version,/mair-radio-sequencer\.js/);assert.match(version,/JFM_ASSET_VERSION='79'/);assert.match(sw,/mair-v96-personalization-20260826/);assert.match(sw,/\.\/mair-sleep\.js/);assert.match(sw,/\.\/mair-dj-break-owed-guard\.js/);assert.match(sw,/\.\/mair-dj-transition-fallback\.js/);assert.match(sw,/\.\/mair-radio-sequencer\.js/);
console.log('MAIR user-reported hotfix gate: PASS — automatic DJ fallback transitions, station-wide varied sequencing, Sleep acoustic station/cover, settings cleanup, diagnostics centralization, repeat locks and Spotify rate-limit mitigation');
