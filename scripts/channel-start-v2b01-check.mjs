import fs from 'node:fs';
const guard=fs.readFileSync('channel-start-guard-v2b01.js','utf8');
const brand=fs.readFileSync('brand-runtime-v9.js','utf8');
new Function(guard);
const checks=[
  ['guard exists',guard.includes('JFMChannelStartGuard')],
  ['waits on busy transport',guard.includes('h.busy||h.endGuardBusy||h.djBusy')],
  ['retries playback',guard.includes('attempt<4')&&guard.includes('original(uri)')],
  ['activates Spotify element',guard.includes('activateElement')],
  ['runtime loads guard',brand.includes('channel-start-guard-v2b01.js')]
];
let fail=0;for(const[n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Channel start v2b.0.1: ${checks.length} PASS / 0 FAIL`);
