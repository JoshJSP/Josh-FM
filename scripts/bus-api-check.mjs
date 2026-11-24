// /api/bus: alleen 500/502-ritten, slank antwoord, nette fouten (Josh 24-11).
import assert from 'node:assert/strict';
import handler, { ritten } from '../api/bus.js';
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
console.log('MAIR bus-API: PASS');
