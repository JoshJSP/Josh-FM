// mair-deeplink.js tegen de echte index.html (lokaal geserveerd): na de deeplink moet
// body.dataset.musicChannel de gevraagde zender zijn en is ?station weg uit het adres.
// Draaien: python3 -m http.server 8797 (in deze map), dan node test/deeplink-check.mjs (duurt ~1 min)
const pw = await import(process.env.PLAYWRIGHT || '/home/kantoor/.npm-global/lib/node_modules/playwright/index.mjs');
const BASIS = process.env.MAIR_URL || 'http://localhost:8797/index.html';
const b = await pw.chromium.launch(); const p = await b.newPage();
const fout = [];
for (const id of ['study', 'chill']) {
  await p.goto(BASIS + '?station=' + id);
  await p.waitForTimeout(26000);
  const [kanaal, zoek] = await p.evaluate(() => [document.body.dataset.musicChannel, location.search]);
  if (kanaal !== id || zoek !== '') fout.push(`${id}: kanaal=${kanaal} zoek=${zoek}`);
}
await p.goto(BASIS + '?station=<x>'); await p.waitForTimeout(3000);
if (!(await p.evaluate(() => location.search)).includes('station')) fout.push('rommel in ?station moet blijven staan en niets doen');
await b.close();
console.log(fout.length ? 'MIS ' + fout.join('; ') : 'ok  deeplink: echte MAIR springt naar study en chill, rommel doet niets');
process.exit(fout.length ? 1 : 0);
