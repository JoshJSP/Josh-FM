import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const playback=read('playback-primary.js');
const health=read('radio-core-health-v1.js');
const version=read('version.js');
const checks=[
 ['single primary transport owner',playback.includes("window.JFMPlayback={primary:true")],
 ['DJ blocks recovery',playback.includes('JFMDJAuthoritative?.busy')&&playback.includes('djOwnsTransport()')],
 ['natural end rechecks DJ lock',playback.includes('await wait(450);if(djOwnsTransport())return false')],
 ['start jingle fully awaited',playback.includes("await speakText('Josh FM. Your music, your radio show.',true).catch(()=>false)")&&!playback.includes('Promise.race([speakText')],
 ['errors reach playback truth',playback.includes('truth()?.error?.(lastError)')],
 ['recovery uses central shouldRecover',playback.includes('truth()?.shouldRecover')],
 ['long session health monitor exists',health.includes('playback-stall')&&health.includes('deviceFlaps')&&health.includes('rapidTransitions')],
 ['health monitor is loaded',version.includes('radio-core-health-v1.js')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Build 1 radio-core checks: ${checks.length} PASS / 0 FAIL`);
