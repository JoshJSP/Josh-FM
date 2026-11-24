// Busradio: dunne proxy naar Transitous (MOTIS). Alleen ritten met lijn 500 en 502.
export const config = { regions: ['fra1'] };
const BASE = 'https://api.transitous.org/api/v1';
const UA = { 'User-Agent': 'MAIRFM/1.0', Accept: 'application/json' };
const LIJNEN = new Set(['500', '502']);
export const ROUTES = {
  heen: { from: 'nl-OpenOV_4259860', to: 'nl-OpenOV_4227250' },  // Lekbrug-West > Claudius Prinsenlaan
  terug: { from: 'nl-OpenOV_4227272', to: 'nl-OpenOV_4259867' }  // Claudius Prinsenlaan > Lekbrug-Oost
};
const json = (res, status, body, cache = 'no-store') => { res.status(status).setHeader('Cache-Control', cache); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) };
// Transitous geeft ook verlopen meldingen terug (staking 23 & 24 nov stond nog op ritten van 25 nov).
const live = (a, t) => !a.impactPeriod?.length || a.impactPeriod.some(p => (!p.start || Date.parse(p.start) <= t) && (!p.end || t <= Date.parse(p.end)));
const stop = s => s && { name: s.name, stopId: s.stopId, lat: s.lat, lon: s.lon, arrival: s.arrival, scheduledArrival: s.scheduledArrival, departure: s.departure, scheduledDeparture: s.scheduledDeparture, cancelled: !!s.cancelled, alerts: (s.alerts || []).filter(a => live(a, Date.parse(s.arrival || s.departure) || Date.now())).map(a => a.headerText).filter(Boolean) };
export function slimLeg(l) {
  return { mode: l.mode, lijn: l.routeShortName || '', headsign: l.headsign || '', from: stop(l.from), to: stop(l.to), start: l.startTime, end: l.endTime, scheduledStart: l.scheduledStartTime, scheduledEnd: l.scheduledEndTime, realTime: !!l.realTime, cancelled: !!l.cancelled, tripId: l.tripId || '', stops: (l.intermediateStops || []).map(stop), polyline: l.legGeometry?.points || '', precision: l.legGeometry?.precision ?? null };
}
export function ritten(plan) {
  return (plan?.itineraries || [])
    .filter(it => { const bus = it.legs.filter(l => l.mode !== 'WALK'); return bus.length && bus.every(l => LIJNEN.has(String(l.routeShortName))) })
    .map(it => ({ start: it.startTime, end: it.endTime, legs: it.legs.map(slimLeg) }));
}
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const trip = String(req.query?.trip || '').slice(0, 120);
    let url;
    if (trip) url = `${BASE}/trip?tripId=${encodeURIComponent(trip)}`;
    else {
      const r = ROUTES[req.query?.dir];
      if (!r) return json(res, 400, { ok: false, error: 'dir moet heen of terug zijn.' });
      const t = req.query?.time ? new Date(String(req.query.time)) : new Date();
      if (isNaN(t)) return json(res, 400, { ok: false, error: 'Ongeldige tijd.' });
      url = `${BASE}/plan?fromPlace=${r.from}&toPlace=${r.to}&time=${encodeURIComponent(t.toISOString())}&searchWindow=7200`;
    }
    const up = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!up.ok) return json(res, 502, { ok: false, error: `Transitous ${up.status}` });
    const data = await up.json();
    const body = trip ? { ok: true, leg: data?.legs?.[0] ? slimLeg(data.legs[0]) : null } : { ok: true, ritten: ritten(data) };
    return json(res, 200, body, 'public, s-maxage=30, stale-while-revalidate=60');
  } catch (e) {
    return json(res, 502, { ok: false, error: 'OV-data niet bereikbaar.' });
  }
}
