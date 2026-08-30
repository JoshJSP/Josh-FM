import fs from 'node:fs';

const controller=fs.readFileSync('channel-click-fix.js','utf8');
const policy=fs.readFileSync('mair-station-policy.js','utf8');
const intelligence=fs.readFileSync('music-intelligence-v3.js','utf8');
const api=fs.readFileSync('api/category-filter.js','utf8');

const must=(ok,msg)=>{if(!ok){console.error(`CATEGORY PURITY FAIL: ${msg}`);process.exit(1)}};

must(policy.includes("nl:{label:'MAIR NEDERLANDSTALIG'")&&policy.includes("language:'nl'")&&policy.includes('minConfidence:.95'),'Nederlandstalig policy must require 0.95 Dutch semantic confidence');
must(policy.includes("party:{label:'MAIR PARTY'")&&policy.includes("chill:{label:'MAIR CHILL'")&&policy.includes("summer:{label:'MAIR SUMMER'"),'semantic station policies missing');
must(controller.includes("boundedFetch('/api/category-filter'"),'controller must call the bounded category classifier before activating queue');
must(controller.includes('AbortController')&&controller.includes("boundedFetch('/api/nl-charts"),'station enrichment requests must have a client timeout');
must(controller.includes('policy()?.confidence?.(id)||.90')&&controller.includes('Number(x?.confidence)>=min'),'client must enforce station-specific confidence');
must(policy.includes('releaseYear(t)>=year()-2'),'new must enforce the current recent-release window');
must(policy.includes('releaseYear(t)>=1980&&releaseYear(t)<=2004'),'throwback must enforce the documented 80s-through-early-00s boundary');
must(policy.includes('releaseYear(t)>=2000&&releaseYear(t)<=2009'),'00s must enforce decade');
must(policy.includes('releaseYear(t)>=2010&&releaseYear(t)<=2019'),'10s must enforce decade');
must(!controller.includes('nlArtists')&&!policy.includes('nlArtists'),'controller must not classify Dutch language by artist whitelist');
must(!intelligence.includes('nlArtists'),'music intelligence must not classify Dutch language by artist whitelist');
must(api.includes('echt hoofdzakelijk Nederlands')&&api.includes('ongeveer 90%'),'server rule must require overwhelmingly Dutch lyrics');
must(api.includes('Engelstalig nummer is NIET genoeg'),'server rule must reject artist-nationality shortcuts');
must(api.includes("MIN_CONFIDENCE={nl:.95")&&api.includes('confidence>=threshold'),'server must fail closed at 0.95 for Nederlandstalig');

console.log('Category purity checks passed.');
