// Zonder AI-sleutels moet MAIR nog steeds radio zijn.
//
// De hoofdregel uit CLAUDE.md: "Music must keep playing when AI/TTS features
// fail." Alle vier de AI-routes gingen in deze branch van ChatGPT of Groq naar
// Claude-met-Groq-vangnet, dus de faalstand is opnieuw bewijs nodig. Een
// endpoint dat 500 geeft, blijft hangen of een uitzondering laat ontsnappen
// kan de clientlaag meesleuren; dat is precies wat hier wordt uitgesloten.
import assert from 'node:assert/strict';
import djWriter from '../api/dj-writer.js';
import newsBulletin from '../api/news-bulletin.js';
import discover from '../api/discover.js';
import categoryFilter from '../api/category-filter.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const AI_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_TEXT_MODEL', 'GROQ_API_KEY', 'GROQ_DJ_MODEL'];

function response() {
  return {
    statusCode: 0, headers: {}, body: null, ended: false,
    status(code) { this.statusCode = code; return this },
    setHeader(name, value) { this.headers[name] = value },
    json(value) { this.body = value; this.ended = true; return this },
    send(value) { this.body = value; this.ended = true; return this },
    end(value) { this.body = value; this.ended = true; return this },
  };
}
async function call(handler, req) { const res = response(); await handler(req, res); return res }

function djBody(id) {
  return {
    breakId: id, breakType: 'FORWARD_ANNOUNCE', targetWords: 16, energy: 'NORMAL',
    context: {
      schemaVersion: '1.0.0',
      break: { breakType: 'FORWARD_ANNOUNCE', targetWords: 16, maxDurationSeconds: 10, energy: 'NORMAL', mustMention: [], permittedTopics: ['music'], prohibitedTopics: [] },
      onAir: { previous: { id: 'a', name: 'Eerste', artists: ['Artiest A'] }, next: { id: 'b', name: 'Tweede', artists: ['Artiest B'] }, future: [], relationship: null },
      session: { station: 'MAIR', localTime: '10:15', day: 'woensdag', daypart: 'ochtend', durationMinutes: 20, narrative: {} },
      memory: { revision: 0, recentBreaks: [], usedFactIds: [] },
      allowedFacts: [], doNot: [],
    },
  };
}
const newsItems = [
  { title: 'Eerste bericht van de ochtend', summary: 'Een korte samenvatting.', source: 'NOS', publishedAt: '2026-09-22T06:00:00Z' },
  { title: 'Tweede bericht', summary: 'Nog een samenvatting.', source: 'NOS', publishedAt: '2026-09-22T06:05:00Z' },
  { title: 'Derde bericht', summary: 'En een derde.', source: 'NOS', publishedAt: '2026-09-22T06:10:00Z' },
];
const filterTracks = [{ id: 't1', name: 'Een nummer', artists: ['Een artiest'], album: 'Een album', release: '2020', popularity: 50 }];

function clearKeys() { for (const key of AI_KEYS) delete process.env[key] }
function restoreEnv() {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
}

let passed = 0;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

// Geen enkele sleutel. Dit is de stand waarin MAIRFM vandaag draait zolang er
// geen ANTHROPIC_API_KEY is en iemand ook GROQ_API_KEY vergeet.
check('zonder sleutels geeft de DJ-writer een nette 503, geen crash', async () => {
  clearKeys();
  globalThis.fetch = async () => { throw new Error('er hoort geen enkele AI-aanroep te gebeuren zonder sleutels') };
  const res = await call(djWriter, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.1' }, body: djBody('geen-sleutels') });
  assert.equal(res.statusCode, 503, 'een ontbrekende sleutel is geen serverfout');
  assert.ok(res.ended, 'de route moet antwoorden, niet blijven hangen');
});

check('zonder sleutels blijft het nieuws hoorbaar via het vaste bulletin', async () => {
  clearKeys();
  globalThis.fetch = async () => { throw new Error('er hoort geen enkele AI-aanroep te gebeuren zonder sleutels') };
  const res = await call(newsBulletin, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.2' }, body: { items: newsItems, sourceLabel: 'NOS Nieuws', time: '07:00' } });
  assert.equal(res.statusCode, 200, 'het uurjournaal mag nooit falen op een ontbrekende sleutel');
  assert.equal(res.body.fallback, true);
  assert.equal(res.body.provider, 'deterministic-news');
  assert.match(res.body.text, /^Dit is MAIR Nieuws\./);
  assert.match(res.body.text, /Dit was MAIR Nieuws\. Je luistert naar MAIR\.$/);
});

check('zonder sleutels geven discovery en de classifier 503, geen 500', async () => {
  clearKeys();
  globalThis.fetch = async () => { throw new Error('er hoort geen enkele AI-aanroep te gebeuren zonder sleutels') };
  const d = await call(discover, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.3' }, body: { seeds: [], count: 5 } });
  assert.equal(d.statusCode, 503);
  assert.equal(d.body.error, 'missing_ai_key');
  const c = await call(categoryFilter, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.4' }, body: { channel: 'nl', tracks: filterTracks } });
  assert.equal(c.statusCode, 503);
  assert.equal(c.body.error, 'missing_ai_key');
});

// Sleutels aanwezig, maar elke aanbieder ligt eruit. Dit is de stand tijdens een
// storing bij Anthropic of Groq, en de duurste om fout te doen.
check('met beide aanbieders down antwoordt elke route binnen een foutcode', async () => {
  clearKeys();
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.GROQ_API_KEY = 'test-groq';
  globalThis.fetch = async () => { throw Object.assign(new Error('netwerk weg'), { name: 'TypeError' }) };

  const dj = await call(djWriter, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.5' }, body: djBody('alles-down') });
  assert.ok(dj.statusCode >= 400 && dj.statusCode < 600, `DJ-writer gaf ${dj.statusCode}`);
  assert.ok(Array.isArray(dj.body.attempts) && dj.body.attempts.length >= 2, 'beide aanbieders horen geprobeerd te zijn');
  assert.equal(dj.body.attempts[0].provider, 'claude', 'Claude hoort als eerste aan de beurt');

  const news = await call(newsBulletin, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.6' }, body: { items: newsItems, sourceLabel: 'NOS Nieuws' } });
  assert.equal(news.statusCode, 200, 'ook met alles down hoort het uur een bulletin te hebben');
  assert.equal(news.body.fallback, true);

  const d = await call(discover, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.7' }, body: { seeds: [], count: 5 } });
  assert.ok(d.statusCode >= 400 && d.statusCode < 600, `discovery gaf ${d.statusCode}`);
  assert.ok(Array.isArray(d.body.attempts) && d.body.attempts.length >= 3, 'discovery hoort Claude en de hele Groq-keten te proberen');

  const c = await call(categoryFilter, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.8' }, body: { channel: 'nl', tracks: filterTracks } });
  assert.ok(c.statusCode >= 400 && c.statusCode < 600, `classifier gaf ${c.statusCode}`);
  assert.ok(Array.isArray(c.body.attempts) && c.body.attempts.length >= 3);
});

// Een kanaal fail-closed houden is belangrijker dan het vullen: liever een leeg
// Nederlandstalig station dan Engelstalige tracks die er niet in horen.
check('de classifier accepteert niets als geen enkele aanbieder een oordeel geeft', async () => {
  clearKeys();
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'geen json, gewoon gebabbel' }] }) });
  const c = await call(categoryFilter, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: { channel: 'nl', tracks: filterTracks } });
  assert.notEqual(c.statusCode, 200, 'onleesbaar oordeel mag nooit als goedkeuring tellen');
  assert.ok(!c.body.accepted, 'er mag geen accepted-lijst uit een mislukte classificatie komen');
});

try {
  for (const [name, fn] of checks) {
    try { await fn(); passed++; console.log('PASS', name) }
    catch (error) { console.error('FAIL', name, '—', error?.stack || error); process.exitCode = 1 }
  }
} finally { globalThis.fetch = originalFetch; restoreEnv() }
if (process.exitCode) process.exit(1);
console.log(`MAIR AI-degradatie: ${passed}/${checks.length} PASS`);
