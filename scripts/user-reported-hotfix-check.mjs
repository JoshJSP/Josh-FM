import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sleep=read('mair-sleep.js'),choice=read('music-choice.js'),policy=read('mair-station-policy.js'),classifier=read('api/category-filter.js'),purity=read('mair-category-purity.js'),rotation=read('rotation-engine.js'),queue=read('station-queue.js'),news=read('mair-live-news.js'),dj=read('mair-dj-v2.js'),version=read('version.js'),sw=read('sw.js'),budget=read('spotify-api-budget.js'),upcoming=read('spotify-upcoming-truth.js');

assert.match(sleep,/mair-sleep-v1\.2/);
assert.match(sleep,/data-sleep-minutes="15"/);assert.match(sleep,/data-sleep-minutes="30"/);assert.match(sleep,/data-sleep-minutes="45"/);assert.match(sleep,/data-sleep-minutes="60"/);
assert.match(sleep,/Stop na dit nummer/);assert.match(sleep,/Luister naar MAIR SLEEP/);
assert.match(sleep,/window\.JFMPlayback\?\.pause/);assert.doesNotMatch(sleep,/api\('\/me\/player/,'Sleep must never become a second Spotify transport owner');
assert.match(sleep,/truth\?\.begin\?\.\('pause'/);assert.match(sleep,/jfm:natural-track-end/);
assert.ok(sleep.indexOf("truth?.begin?.('pause'")<sleep.indexOf('const pause=window.JFMPlayback?.pause'),'sleep pause operation must block auto-advance before transport pause starts');

for(const [name,src] of [['music-choice',choice],['station-policy',policy],['classifier',classifier],['category-purity',purity]])assert.match(src,/sleep/,`${name} must include the SLEEP channel`);
assert.match(policy,/sleep:\{label:'MAIR SLEEP'.*minConfidence:\.94/s);assert.match(classifier,/sleep:'Accepteer alleen als dit overtuigend geschikt is om bij in slaap te vallen/);
assert.match(policy,/acoustic covers/);assert.match(policy,/soft acoustic covers/);assert.match(policy,/unplugged pop/);assert.doesNotMatch(policy,/deep sleep music|ambient sleep music|sleep music','Sleep search must be song-first, not ambient/noise-first');
assert.match(classifier,/Wijs ALTIJD af: white noise, brown noise, pink noise/);assert.match(classifier,/rustige akoestische radio-playlist/);
assert.match(purity,/channel==='sleep'\)return filtered/);assert.match(purity,/channel!=='sleep'/);
assert.match(rotation,/station==='sleep'\?-\.24/);assert.match(rotation,/targetMomentum=station==='sleep'\?\.28/);

assert.match(queue,/if\(id==='hits'\)return 45/);assert.match(queue,/if\(id==='top40'\)return 35/);assert.match(queue,/!\['hits','top40'\]\.includes\(activeStation\)/);
assert.doesNotMatch(queue,/if\(candidates\.length<10\)\{const relaxed=generated\.filter\(t=>t\?\.id&&TRACK_URI\.test\(t\?\.uri\|\|''\)&&!oldIds\.has\(t\.id\)&&!candidates\.some/,'old repeat-bypass fallback must not return');

assert.match(news,/COOLDOWN=27\*60\*1000/);assert.match(news,/\['top','half'\]\.includes\(p\)/);assert.match(news,/LAST_SLOT='mair_news_last_slot_v1'/);assert.match(news,/LAST_TITLE='mair_news_last_title_v1'/);assert.match(news,/function candidate\(\)\{return candidates\(\)\[0\]\|\|null\}/);assert.doesNotMatch(news,/headlines\|\|\[\]\)\.filter\(fresh\)\[0\]/,'headline selector must not fall back to the same used headline');

assert.match(dj,/v3\.4-deferred-breaks-memory-imaging/);assert.match(dj,/function deferBreak/);assert.match(dj,/automatic-break-deferred/);assert.doesNotMatch(dj,/miss\('automatic-break-not-ready'\)/);assert.match(dj,/deferred/);

assert.match(budget,/POLL_MS=30000/);assert.match(budget,/api-budget-v2-rate-limit-aware/);assert.match(budget,/cooldownUntil/);assert.match(budget,/match\(\/over\\s\+\(\\d\+\)\\s\*sec\/i\)/);
assert.match(upcoming,/WATCHDOG_MS=15000/);assert.match(upcoming,/FORCE_DEDUPE_MS=1200/);assert.match(upcoming,/v2-single-authoritative-owner-rate-limit-aware/);assert.doesNotMatch(upcoming,/setInterval\(\(\)=>sync\(false\),1600\)/,'Spotify queue truth may not poll every 1.6 seconds');

assert.match(version,/mair-sleep\.js/);assert.match(version,/JFM_ASSET_VERSION='77'/);assert.match(sw,/mair-v91-sleep-radio-20260825/);assert.match(sw,/\.\/mair-sleep\.js/);
console.log('MAIR user-reported hotfix gate: PASS — Sleep acoustic songs, half-hour headlines, deferred DJ, HITS repeat lock and Spotify rate-limit mitigation');
