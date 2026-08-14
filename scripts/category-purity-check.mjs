import fs from 'node:fs';

const controller=fs.readFileSync('channel-click-fix.js','utf8');
const policy=fs.readFileSync('mair-station-policy.js','utf8');
const intelligence=fs.readFileSync('music-intelligence-v3.js','utf8');
const api=fs.readFileSync('api/category-filter.js','utf8');

const must=(ok,msg)=>{if(!ok){console.error(`CATEGORY PURITY FAIL: ${msg}`);process.exit(1)}};

must(policy.includes("nl:{label:'MAIR NEDERLANDSTALIG'")&&policy.includes("language:'nl'")&&policy.includes('semantic:true'),'Nederlandstalig policy must explicitly require Dutch semantic validation');
must(policy.includes("party:{label:'MAIR PARTY'")&&policy.includes("chill:{label:'MAIR CHILL'")&&policy.includes("summer:{label:'MAIR SUMMER'"),'semantic station policies missing');
must(controller.includes("fetch('/api/category-filter'"),'controller must call category classifier before activating queue');
must(controller.includes('confidence)>=.90'),'client must enforce 0.90 minimum confidence');
must(policy.includes('releaseYear(t)===year()'),'new must enforce current release year');
must(policy.includes('releaseYear(t)>0&&releaseYear(t)<=2016'),'throwback must enforce hard year boundary');
must(policy.includes('releaseYear(t)>=2000&&releaseYear(t)<=2009'),'00s must enforce decade');
must(policy.includes('releaseYear(t)>=2010&&releaseYear(t)<=2019'),'10s must enforce decade');
must(!controller.includes('nlArtists')&&!policy.includes('nlArtists'),'controller must not classify Dutch language by artist whitelist');
must(!intelligence.includes('nlArtists'),'music intelligence must not classify Dutch language by artist whitelist');
must(api.includes('hoofdzakelijk Nederlands'),'server rule must require Dutch lyrics');
must(api.includes('Engelstalig nummer is NIET genoeg'),'server rule must reject artist-nationality shortcuts');
must(api.includes('confidence>=0.90'),'server must fail closed below 0.90 confidence');

console.log('Category purity checks passed.');