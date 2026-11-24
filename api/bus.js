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
// Rooster: alleen de begintijd van de eerste les per dag, nooit het hele rooster (ROOSTER_ICS = TimeEdit-link, alleen in env).
const LOOPTIJD = 7 * 60000; // Claudius Prinsenlaan > les. Bus aankomst + 7 min lopen <= lesstart (les 09:00 = bus van 07:49).
const amsDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
export function firstLesson(ics, now) {
  const first = {};
  for (const m of String(ics).matchAll(/^DTSTART[^:\r\n]*:(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/gm)) {
    const t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]), d = amsDay(t);
    if (!first[d] || t < first[d]) first[d] = t;
  }
  // Is de eerste les van vandaag al begonnen, dan telt de eerstvolgende lesdag.
  return Object.values(first).filter(t => t > now).sort((a, b) => a - b)[0] || null;
}
const plan = async (r, t, extra = '') => {
  const up = await fetch(`${BASE}/plan?fromPlace=${r.from}&toPlace=${r.to}&time=${encodeURIComponent(new Date(t).toISOString())}${extra}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!up.ok) throw Object.assign(Error(`Transitous ${up.status}`), { up: true });
  return ritten(await up.json());
};
async function lesAdvies(now) {
  const src = process.env.ROOSTER_ICS;
  if (!src) return null;
  const r = await fetch(src, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw Error('rooster ' + r.status);
  const start = firstLesson(await r.text(), now);
  if (!start) return { start: null, ritten: [] };
  const deadline = start - LOOPTIJD;
  const opties = (await plan(ROUTES.heen, deadline, '&arriveBy=true&searchWindow=5400'))
    .filter(x => Date.parse(x.end) <= deadline).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(-3);
  return { start: new Date(start).toISOString(), ritten: opties };
}
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const trip = String(req.query?.trip || '').slice(0, 120);
    if (trip) {
      const up = await fetch(`${BASE}/trip?tripId=${encodeURIComponent(trip)}`, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (!up.ok) return json(res, 502, { ok: false, error: `Transitous ${up.status}` });
      const data = await up.json();
      return json(res, 200, { ok: true, leg: data?.legs?.[0] ? slimLeg(data.legs[0]) : null }, 'public, s-maxage=30, stale-while-revalidate=60');
    }
    const dir = req.query?.dir, r = ROUTES[dir];
    if (!r) return json(res, 400, { ok: false, error: 'dir moet heen of terug zijn.' });
    const t = req.query?.time ? new Date(String(req.query.time)) : new Date();
    if (isNaN(t)) return json(res, 400, { ok: false, error: 'Ongeldige tijd.' });
    const wantLes = dir === 'heen' && req.query?.les === '1';
    // Rooster mag nooit de bustijden breken: faalt het, dan gewoon zonder advies.
    const lesP = wantLes ? lesAdvies(Date.now()).catch(() => null) : Promise.resolve(null);
    let list = await plan(r, t, '&searchWindow=7200');
    // 's Nachts rijdt er niks binnen 2 uur. Dan de eerstvolgende ritten (meestal de volgende ochtend), geen "geen data".
    if (!list.length) list = await plan(r, t, '&searchWindow=43200');
    const les = await lesP, body = { ok: true, ritten: list };
    if (les) {
      const seen = new Set(list.map(x => x.legs.find(l => l.mode !== 'WALK')?.tripId));
      body.ritten = [...list, ...les.ritten.filter(x => !seen.has(x.legs.find(l => l.mode !== 'WALK')?.tripId))].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      body.les = { start: les.start, bus: les.ritten.map(x => x.legs.find(l => l.mode !== 'WALK')?.tripId) };
    }
    // Met lestijd erin niet op de gedeelde CDN-cache.
    return json(res, 200, body, les ? 'private, max-age=30' : 'public, s-maxage=30, stale-while-revalidate=60');
  } catch (e) {
    return json(res, 502, { ok: false, error: e?.up ? e.message : 'OV-data niet bereikbaar.' });
  }
}
