import fs from 'node:fs';

const controller=fs.readFileSync('channel-click-fix.js','utf8');
const intelligence=fs.readFileSync('music-intelligence-v3.js','utf8');
const api=fs.readFileSync('api/category-filter.js','utf8');

const must=(ok,msg)=>{if(!ok){console.error(`CATEGORY PURITY FAIL: ${msg}`);process.exit(1)}};

must(controller.includes("['nl','party','chill','summer'].includes(id)"),'semantic channels must use strict validation');
must(controller.includes("fetch('/api/category-filter'"),'controller must call category classifier before activating queue');
must(controller.includes('confidence)>=.90'),'client must enforce 0.90 minimum confidence');
must(controller.includes("id==='new')return list.filter(t=>yr(t)===now)"),'new must enforce current release year');
must(controller.includes("id==='throwback')return list.filter(t=>yr(t)>0&&yr(t)<=2016)"),'throwback must enforce hard year boundary');
must(controller.includes("id==='00s')return list.filter(t=>yr(t)>=2000&&yr(t)<=2009)"),'00s must enforce decade');
must(controller.includes("id==='10s')return list.filter(t=>yr(t)>=2010&&yr(t)<=2019)"),'10s must enforce decade');
must(!controller.includes('nlArtists'),'controller must not classify Dutch language by artist whitelist');
must(!intelligence.includes('nlArtists'),'music intelligence must not classify Dutch language by artist whitelist');
must(api.includes('hoofdzakelijk Nederlands'),'server rule must require Dutch lyrics');
must(api.includes('Engelstalig nummer is NIET genoeg'),'server rule must reject artist-nationality shortcuts');
must(api.includes('confidence>=0.90'),'server must fail closed below 0.90 confidence');

console.log('Category purity checks passed.');
