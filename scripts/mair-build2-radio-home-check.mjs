import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const js=read('mair-radio-home.js'),css=read('mair-radio-home.css'),version=read('version.js'),index=read('index.html');
const checks=[
 ['radio home JS wired',version.includes("./mair-radio-home.js")],
 ['radio home CSS wired',version.includes("./mair-radio-home.css")],
 ['core transport IDs preserved',['id="start"','id="play"','id="prev"','id="next"','id="djNow"','id="djText"'].every(x=>index.includes(x))],
 ['radio home decorates existing player',js.includes(".now")&&js.includes('mair-now-v2')&&!js.includes("id='play'")],
 ['up-next presentation exists',js.includes('mair-up-next')&&js.includes('readQueue')&&css.includes('.mair-up-row')],
 ['legacy radio cards are presentation-hidden only',js.includes('mair-radio-legacy-hidden')&&css.includes('.mair-radio-legacy-hidden{display:none!important}')],
 ['DJ card remains connected to #djText',js.includes("findCard('djText')")&&js.includes('mair-dj-card-v2')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`MAIR Build 2: ${checks.length} PASS / 0 FAIL`);
