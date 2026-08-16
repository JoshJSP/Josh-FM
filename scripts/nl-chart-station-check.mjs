import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const endpoint=read('api/nl-charts.js'),controller=read('channel-click-fix.js'),policy=read('mair-station-policy.js');
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
ok(endpoint.includes("5lH9NjOeJvctAO92ZrKQNB"),'Top 40 must use the official Nederlandse Top 40 Spotify playlist');
ok(endpoint.includes("7a5Qk0YvgHSdk6Ot3Yc7qS")&&endpoint.includes("1U0P7X7JJe1e7wcTrCkQIj"),'Hits must include official Airplay and Streaming Top 40 sources');
ok(endpoint.includes("37i9dQZF1DWUX3x84bv557")&&endpoint.includes("label:'Je Moerstaal'"),'Nederlandstalig must use Spotify editorial Je Moerstaal');
ok(endpoint.includes("__NEXT_DATA__")&&endpoint.includes('trackList'),'Dutch playlist feed must parse Spotify embed playlist data');
ok(endpoint.includes("station==='top40'")&&endpoint.includes('.slice(0,40)'),'Top 40 must be capped at exactly the chart-size of 40');
ok(endpoint.includes("station==='nl'")&&endpoint.includes("source:'Spotify · Je Moerstaal'"),'Nederlandstalig endpoint must explicitly serve Je Moerstaal');
ok(endpoint.includes('chartSources.length-1')&&endpoint.includes('hitsMix'),'Hits must reward tracks appearing across multiple Dutch chart sources');
ok(controller.includes("/api/nl-charts?station=")&&controller.indexOf('dutchChartPool(id)')<controller.indexOf('for(const q of queries(id))'),'Dutch playlist feed must be attempted before generic Spotify search');
ok(controller.includes("['hits','top40','nl'].includes(id)"),'Nederlandstalig must share the authoritative Dutch playlist path');
ok(controller.includes("mair_station_pool_cache_v4_nl_charts"),'old generic station pools must not be reused');
ok(controller.includes("source:'spotify-search-fallback'")&&controller.includes("['hits','top40'].includes(id)"),'generic Spotify search must remain a safe fallback');
ok(policy.includes("chartSource:'nl-hits'")&&policy.includes("chartSource:'nl-top40'")&&policy.includes("chartSource:'spotify-je-moerstaal'"),'station policy must explicitly identify all Dutch editorial/chart ownership');
ok(!policy.includes("nl:{label:'MAIR NEDERLANDSTALIG',kind:'station',semantic:true,language:'nl',minConfidence:.95,minTracks:5,queries:()=>['genre:dutch'"),'Nederlandstalig must not return to genre:dutch as its main station definition');
if(fail.length){console.error('Dutch chart station regression FAILED');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('Dutch chart station regression OK');
