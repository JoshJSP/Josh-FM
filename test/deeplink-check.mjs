// mair-deeplink.js: tikt de zenderknop aan en haalt de parameter weg; rommel in ?station doet niets
import { chromium } from '/home/kantoor/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const js = fs.readFileSync(new URL('../mair-deeplink.js', import.meta.url).pathname, 'utf8');
const b = await chromium.launch(); const p = await b.newPage();
const run = async (q) => {
  await p.route('https://mair.test/**', (r) => r.fulfill({ contentType: 'text/html', body: `<body><script>window.geklikt=null;setTimeout(()=>{const k=document.createElement('button');k.dataset.jfmChannel='study';k.onclick=()=>window.geklikt='study';document.body.append(k)},1500)</script><script>${js}</script></body>` }));
  await p.goto('https://mair.test/' + q); await p.waitForTimeout(3000);
  return p.evaluate(() => [window.geklikt, location.search]);
};
const a = await run('?station=study'), c = await run('?station=<x>');
await b.close();
const ok = a[0] === 'study' && a[1] === '' && c[0] === null;
console.log(ok ? 'ok  deeplink: zender aangetikt, parameter weg, rommel genegeerd' : 'MIS ' + JSON.stringify([a, c]));
process.exit(ok ? 0 : 1);
