import fs from 'node:fs';
const fail=[];
const tap=fs.readFileSync('channel-click-fix.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const choice=fs.readFileSync('music-choice.js','utf8');
const ok=(name,cond)=>{if(!cond)fail.push(name)};
ok('tap guard is loaded after music-choice',index.indexOf('music-choice.js')>=0&&index.indexOf('channel-click-fix.js')>index.indexOf('music-choice.js'));
ok('delegated category click exists',tap.includes("closest?.('[data-jfm-channel]')")&&tap.includes("addEventListener('click',delegated,true)"));
ok('iOS touch fallback exists',tap.includes("addEventListener('touchend'")&&tap.includes('passive:false'));
ok('category buttons hardened as button type',tap.includes("b.type='button'"));
ok('tap immediately paints loading state',tap.includes('paint(id,true)')&&tap.includes('wordt geladen'));
ok('tap calls canonical chooseChannel',tap.includes('api.chooseChannel(id)')&&choice.includes('async function chooseChannel'));
ok('lifecycle re-hardens controls',tap.includes("addEventListener('pageshow'")&&tap.includes('setInterval(harden'));
if(fail.length){console.error('Channel tap regression FAIL:',fail.join(', '));process.exit(1)}
console.log('Channel tap regression: 7 PASS');
