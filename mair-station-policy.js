// MAIR station policy — single client-side source for station labels, search rules and hard purity gates.
(()=>{
'use strict';
const year=()=>new Date().getFullYear();
const stations={
  mix:{label:'MY MAIR',kind:'personal'},
  hits:{label:'MAIR HITS',kind:'station',queries:()=>[`year:${year()-2}-${year()} genre:pop`,`year:${year()-2}-${year()} genre:dance`,'viral hits','pop hits'],hard:t=>releaseYear(t)>=year()-3&&Number(t?.popularity||0)>=65},
  top40:{label:'MAIR TOP 40',kind:'station',queries:()=>[`year:${year()-1}-${year()} genre:pop`,`year:${year()-1}-${year()} genre:dance`,'viral hits','chart hits'],hard:t=>releaseYear(t)>=year()-1&&Number(t?.popularity||0)>=70},
  new:{label:'MAIR DISCOVERY',kind:'station',queries:()=>[`year:${year()} genre:pop`,`year:${year()} genre:dance`,`year:${year()} indie pop`,'new music'],hard:t=>releaseYear(t)===year()},
  throwback:{label:'MAIR THROWBACK',kind:'station',queries:()=>['year:1980-1999 hits','year:2000-2016 hits','classic pop hits','classic rock hits'],hard:t=>releaseYear(t)>0&&releaseYear(t)<=2016},
  '00s':{label:'MAIR 00s',kind:'station',queries:()=>['year:2000-2009 pop','year:2000-2009 dance','year:2000-2009 rock','2000s hits'],hard:t=>releaseYear(t)>=2000&&releaseYear(t)<=2009},
  '10s':{label:'MAIR 10s',kind:'station',queries:()=>['year:2010-2019 pop','year:2010-2019 dance','year:2010-2019 indie','2010s hits'],hard:t=>releaseYear(t)>=2010&&releaseYear(t)<=2019},
  nl:{label:'MAIR NEDERLANDSTALIG',kind:'station',semantic:true,language:'nl',minConfidence:.95,minTracks:5,queries:()=>['genre:dutch','dutch pop','nederlandstalig','nederlandse hits']},
  party:{label:'MAIR PARTY',kind:'station',semantic:true,minConfidence:.90,minTracks:5,queries:()=>['dance hits','party hits','edm hits','dance pop']},
  chill:{label:'MAIR CHILL',kind:'station',semantic:true,minConfidence:.90,minTracks:5,queries:()=>['chill pop','acoustic pop','indie chill','soft pop']},
  summer:{label:'MAIR SUMMER',kind:'station',semantic:true,minConfidence:.90,minTracks:5,queries:()=>['summer hits','tropical house','feel good pop','summer pop']}
};
function releaseYear(t){return Number(String(t?.release||t?.album?.release_date||'').slice(0,4))||0}
function get(id){return stations[id]||stations.mix}
function queries(id){return get(id).queries?.()||[]}
function hardFilter(id,list){const rule=get(id).hard;return typeof rule==='function'?(list||[]).filter(rule):(list||[])}
function needsSemantic(id){return !!get(id).semantic}
function confidence(id){return Number(get(id).minConfidence||.90)}
function minTracks(id){return Number(get(id).minTracks||5)}
function label(id){return get(id).label}
window.MAIRStationPolicy={version:'mair-station-policy-v1.1-strict-nl',stations,get,queries,hardFilter,needsSemantic,confidence,minTracks,label,releaseYear};
})();