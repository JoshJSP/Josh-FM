import fs from 'node:fs';
const dj=fs.readFileSync('dj-quality-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const checks=[
['wired',index.includes('dj-quality-v2.js')],
['hour',dj.includes("case'hour'")],
['half-hour',dj.includes("case'half-hour'")],
['dayparts',dj.includes('Morning')&&dj.includes('Drive')&&dj.includes('Late Night')],
['anti-repeat',dj.includes('recentFormat')&&dj.includes('fresh(options)')],
['manual',dj.includes("manual-fact")&&dj.includes("case'manual'")],
['length-cap',dj.includes('manual?70')&&dj.includes('62:48')],
['owns-script',dj.includes('window.makeDJScript=async')]
];let f=0;for(const [n,o] of checks){console.log((o?'PASS ':'FAIL ')+n);if(!o)f++}if(f)process.exit(1);
