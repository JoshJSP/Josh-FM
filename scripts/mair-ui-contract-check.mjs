import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const foundation=read('mair-foundation.js');
const voice=read('debug-tts.js');
const radio=read('mair-radio-home.js');
const radioCss=read('mair-radio-home.css');
const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};

ok(foundation.includes("data-mair-tab=\"radio\""),'onderste navigatie mist Radio');
ok(foundation.includes("data-mair-tab=\"stations\""),'onderste navigatie mist Stations');
ok(foundation.includes("data-mair-tab=\"for-you\""),'onderste navigatie mist Voor jou');
ok(foundation.includes("data-mair-tab=\"requests\""),'onderste navigatie mist Verzoeken');
ok(foundation.includes("data-mair-tab=\"settings\""),'onderste navigatie mist Instellingen');
ok(foundation.includes("e.target.closest('.mair-nav-btn')"),'MAIR navigatie gebruikt geen gedelegeerde klikhandler');
ok(!foundation.includes("e.target.closest('[data-mode]')"),'Voor Jou mag geen generieke data-mode selector gebruiken');
ok(foundation.includes("e.target.closest('.mair-mix[data-mode]')"),'Voor Jou moet alleen de aangeklikte mix activeren');
ok(!voice.includes('preventDefault('),'TTS mag clicks niet preventDefaulten');
ok(!voice.includes('stopPropagation('),'TTS mag click-events niet stoppen');
ok(radio.includes('MutationObserver'),'radio-home moet de queue/mode live kunnen verversen');
ok(radioCss.includes('.mair-now-v2 .mair-live-strip{display:none!important}'),'oude live/queue tekst mag niet over now-playing heen staan');
ok(radioCss.includes('overflow-wrap:normal!important')&&radioCss.includes('word-break:normal!important'),'tracktitel mag niet agressief afbreken');
ok(radioCss.includes('.mair-now-v2 .transport{margin:18px 0 16px!important}'),'transportbediening mist consistente verticale ruimte');

if(failures.length){console.error('MAIR UI contract FAILED');for(const x of failures)console.error('- '+x);process.exit(1)}
console.log('MAIR UI contract OK');
