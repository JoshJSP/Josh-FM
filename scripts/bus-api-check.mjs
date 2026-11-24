// /api/bus: alleen 500/502-ritten, slank antwoord, nette fouten (Josh 24-11).
import assert from 'node:assert/strict';
import handler, { ritten, firstLesson } from '../api/bus.js';
const leg = (mode, lijn, extra = {}) => ({ mode, routeShortName: lijn, from: { name: 'A', stopId: 'a', lat: 1, lon: 2 }, to: { name: 'B', stopId: 'b' }, startTime: 's', endTime: 'e', realTime: true, tripId: lijn ? 't' + lijn : undefined, intermediateStops: [{ name: 'C', alerts: [{ headerText: 'Bus staking' }] }], legGeometry: { points: 'xyz', precision: 6 }, ...extra });
const plan = { itineraries: [
  { startTime: '1', endTime: '2', legs: [leg('BUS', '500'), leg('WALK', undefined), leg('BUS', '502')] },
  { startTime: '3', endTime: '4', legs: [leg('BUS', '502'), leg('WALK', undefined), leg('BUS', '387')] }
] };
const r = ritten(plan);
assert.equal(r.length, 1, 'lijn 387 moet eruit');
assert.equal(r[0].legs[0].lijn, '500');
assert.equal(r[0].legs[0].stops[0].alerts[0], 'Bus staking');
assert.equal(r[0].legs[0].polyline, 'xyz');
assert.equal(ritten({}).length, 0);
const call = async (query, reply) => {
  globalThis.fetch = async url => { call.url = url; return reply };
  const out = {}; const res = { status(s) { out.status = s; return this }, setHeader(k, v) { out[k] = v }, end(b) { out.body = JSON.parse(b) } };
  await handler({ method: 'GET', query }, res); return out;
};
let o = await call({ dir: 'heen', time: '2026-11-25T07:30:00+01:00' }, { ok: true, json: async () => plan });
assert.equal(o.status, 200); assert.equal(o.body.ritten.length, 1);
assert.ok(call.url.includes('nl-OpenOV_4259860') && call.url.includes('2026-11-25T06%3A30%3A00.000Z'));
assert.match(o['Cache-Control'], /s-maxage=30/);
o = await call({ dir: 'mars' }, null); assert.equal(o.status, 400);
o = await call({ dir: 'terug', time: 'gisteren' }, null); assert.equal(o.status, 400);
o = await call({ trip: 'abc' }, { ok: true, json: async () => ({ legs: [leg('BUS', '502')] }) });
assert.equal(o.body.leg.lijn, '502'); assert.ok(call.url.endsWith('/trip?tripId=abc'));
o = await call({ dir: 'heen' }, { ok: false, status: 503 }); assert.equal(o.status, 502); assert.equal(o['Cache-Control'], 'no-store');
o = await call({ dir: 'heen' }, null); // fetch-antwoord kapot = offline assert.equal(o.status, 502); assert.equal(o.body.ok, false);
// 's Nachts: niks binnen 2 uur > eerstvolgende ritten met een venster van 12 uur, geen "geen data".
{ const urls = []; globalThis.fetch = async url => { urls.push(url); return { ok: true, json: async () => (urls.length === 1 ? { itineraries: [] } : plan) } };
  const out = {}; await handler({ method: 'GET', query: { dir: 'heen' } }, { status(s) { out.status = s; return this }, setHeader() {}, end(b) { out.body = JSON.parse(b) } });
  assert.equal(out.status, 200); assert.equal(out.body.ritten.length, 1); assert.match(urls[1], /searchWindow=43200/); }
// Rooster: eerste les per dag (Amsterdamse dag), voorbij = volgende lesdag.
const ics = 'BEGIN:VEVENT\r\nDTSTART:20261126T100000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261126T080000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261127T120000Z\r\nEND:VEVENT\r\n';
assert.equal(firstLesson(ics, Date.parse('2026-11-25T21:00:00Z')), Date.parse('2026-11-26T08:00:00Z'));
assert.equal(firstLesson(ics, Date.parse('2026-11-26T08:30:00Z')), Date.parse('2026-11-27T12:00:00Z'), 'eerste les vandaag voorbij > morgen');
assert.equal(firstLesson(ics, Date.parse('2026-12-01T00:00:00Z')), null);
// Les 09:00 > bus moet uiterlijk 08:53 aankomen > kies de 07:49 (aankomst 08:53), niet de 08:19 (aankomst 09:22).
{ const rit = (s, e, id) => ({ startTime: s, endTime: e, legs: [leg('BUS', '500', { startTime: s, endTime: s, tripId: id }), leg('WALK'), leg('BUS', '502', { endTime: e, tripId: id + 'b' })] });
  const arrive = { itineraries: [rit('2026-11-26T05:47:00Z', '2026-11-26T06:48:00Z', 'a'), rit('2026-11-26T06:17:00Z', '2026-11-26T07:22:00Z', 'b'), rit('2026-11-26T06:49:00Z', '2026-11-26T07:53:00Z', 'c'), rit('2026-11-26T07:19:00Z', '2026-11-26T08:22:00Z', 'd')] };
  process.env.ROOSTER_ICS = 'https://rooster.test/x.ics'; const urls = [];
  globalThis.fetch = async url => { urls.push(url); return url.startsWith('https://rooster.test') ? { ok: true, text: async () => ics } : { ok: true, json: async () => (/arriveBy/.test(url) ? arrive : plan) } };
  const out = {}; const res = { status(s) { out.status = s; return this }, setHeader(k, v) { out[k] = v }, end(b) { out.body = JSON.parse(b) } };
  const realNow = Date.now; Date.now = () => Date.parse('2026-11-25T21:00:00Z');
  try { await handler({ method: 'GET', query: { dir: 'heen', les: '1', time: '2026-11-25T21:00:00Z' } }, res) } finally { Date.now = realNow }
  assert.equal(out.body.les.start, '2026-11-26T08:00:00.000Z');
  assert.deepEqual(out.body.les.bus, ['a', 'b', 'c'], 'laatste = neem deze (07:49), d komt te laat');
  assert.ok(urls.some(u => u.includes('arriveBy=true') && u.includes('2026-11-26T07%3A53%3A00.000Z')));
  assert.equal(out['Cache-Control'], 'private, max-age=30', 'lestijd niet op de CDN');
  assert.ok(!JSON.stringify(out.body).includes('rooster.test'), 'ICS-link nooit in het antwoord');
  // Rooster kapot: busdata komt gewoon, zonder advies.
  globalThis.fetch = async url => url.startsWith('https://rooster.test') ? { ok: false, status: 500 } : { ok: true, json: async () => plan };
  await handler({ method: 'GET', query: { dir: 'heen', les: '1' } }, res); assert.equal(out.status, 200); assert.equal(out.body.les, undefined); assert.equal(out.body.ritten.length, 1);
  delete process.env.ROOSTER_ICS; }
console.log('MAIR bus-API: PASS');
