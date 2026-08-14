import fs from 'node:fs';
const fail=[];
const tap=fs.readFileSync('channel-click-fix.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const choice=fs.readFileSync('music-choice.js','utf8');
const primary=fs.readFileSync('playback-primary.js','utf8');
const classifier=fs.readFileSync('api/category-filter.js','utf8');
const ok=(name,cond)=>{if(!cond)fail.push(name)};
ok('tap guard is loaded after music-choice',index.indexOf('music-choice.js')>=0&&index.indexOf('channel-click-fix.js')>index.indexOf('music-choice.js'));
ok('authoritative delegated category click exists',tap.includes("closest?.('[data-jfm-channel]')")&&tap.includes("document.addEventListener('click'"));
ok('tap capture blocks legacy category owners',tap.includes('stopImmediatePropagation')&&tap.includes('preventDefault'));
ok('tap immediately paints strict loading state',tap.includes('paint(id,true)')&&tap.includes('wordt streng gecontroleerd'));
ok('tap routes through canonical selector',tap.includes('c.chooseChannel=choose')&&tap.includes('async function choose(id)')&&choice.includes('async function chooseChannel'));
ok('lifecycle reasserts owner without permanent polling',tap.includes("addEventListener('pageshow'")&&tap.includes("addEventListener('mair:runtime-ready'")&&tap.includes('setTimeout(boot,300)')&&!tap.includes('setInterval(boot'));
ok('popular category pool uses multiple clamped searches',tap.includes('buildPool')&&tap.includes("limit=10&q=")&&tap.includes('queries(id)'));
ok('Nederlandstalig is semantic fail-closed, not artist-whitelisted',tap.includes("['nl','party','chill','summer']")&&tap.includes('/api/category-filter')&&!tap.includes('nlArtists')&&classifier.includes('hoofdzakelijk Nederlands'));
ok('primary playback remains transport owner',primary.includes("dataset.jfmOwner='primary'")&&primary.includes("JFMPlaybackPrimary='playback-primary'"));
if(fail.length){console.error('Channel tap regression FAIL:',fail.join(', '));process.exit(1)}
console.log('Channel tap regression: 9 PASS');
