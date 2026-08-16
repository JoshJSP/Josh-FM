import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const controller=read('channel-click-fix.js');
const policy=read('mair-station-policy.js');
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
ok(controller.includes("/search?type=track&limit=10&q="),'station search must respect Spotify 2026 max search limit of 10');
ok(!controller.includes('/search?type=track&limit=25&q='),'legacy Spotify search limit 25 must not return');
ok(!policy.includes('popularity'),'station purity must not depend on Spotify track popularity removed in 2026');
ok(controller.includes("mair_station_pool_cache_v3_spotify_2026"),'station pools must use a fresh cache after Spotify API migration');
ok(controller.includes("Spotify stationzoekopdracht mislukte:"),'station search errors must be surfaced instead of silently becoming an empty station');
ok(policy.includes("hits:{label:'MAIR HITS'")&&policy.includes("top40:{label:'MAIR TOP 40'"),'Hits and Top 40 station policies must remain present');
ok(controller.includes("['hits','top40'].includes(id)")&&controller.includes('raw.length>=minimum'),'Hits and Top 40 must have a safe targeted-search fallback when old ranking metadata is unavailable');
ok(policy.includes("hard:t=>releaseYear(t)===year()")&&controller.includes("if(id==='new')return list.filter(t=>yr(t)===now)"),'Discovery must remain current-year strict');
if(fail.length){console.error('Spotify 2026 station regression FAILED');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('Spotify 2026 station regression OK');