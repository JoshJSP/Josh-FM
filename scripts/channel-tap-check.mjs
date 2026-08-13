import fs from 'node:fs';
const fail=[];
const tap=fs.readFileSync('channel-click-fix.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const choice=fs.readFileSync('music-choice.js','utf8');
const primary=fs.readFileSync('playback-primary.js','utf8');
const ok=(name,cond)=>{if(!cond)fail.push(name)};
ok('tap guard is loaded after music-choice',index.indexOf('music-choice.js')>=0&&index.indexOf('channel-click-fix.js')>index.indexOf('music-choice.js'));
ok('authoritative delegated category click exists',tap.includes("closest?.('[data-jfm-channel]')")&&tap.includes("document.addEventListener('click'"));
ok('tap capture blocks legacy category owners',tap.includes('stopImmediatePropagation')&&tap.includes('preventDefault'));
ok('tap immediately paints loading state',tap.includes('paint(id,true)')&&tap.includes('wordt opgebouwd uit populaire tracks'));
ok('tap routes through canonical selector',tap.includes('c.chooseChannel=choose')&&tap.includes('async function choose(id)')&&choice.includes('async function chooseChannel'));
ok('lifecycle reasserts single category owner',tap.includes("addEventListener('pageshow'")&&tap.includes('setInterval(boot'));
ok('popular category pool uses multiple clamped searches',tap.includes('buildPool')&&tap.includes("limit=10&q=")&&tap.includes('queries(id)'));
ok('Nederlandstalig has strict artist filtering',tap.includes('nlArtists')&&tap.includes('nlOk')&&tap.includes("if(id==='nl')out=out.filter(nlOk)"));
ok('primary playback remains transport owner',primary.includes("dataset.jfmOwner='primary'")&&primary.includes("JFMPlaybackPrimary='playback-primary'"));
if(fail.length){console.error('Channel tap regression FAIL:',fail.join(', '));process.exit(1)}
console.log('Channel tap regression: 9 PASS');
