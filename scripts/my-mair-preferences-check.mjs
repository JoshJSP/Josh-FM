import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {RELEASE_ASSET_VERSION} from './release-cache.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const radioHome = read('mair-radio-home.js');
const easyUse = read('mair-easy-use-v1.js');
const director = read('director.js');
const learning = read('personal-learning-v4.js');
const dashboard = read('mair-my-mair.js');
const loader = read('version.js');
const serviceWorker = read('sw.js');

assert.ok(!radioHome.includes("querySelector('.taste')?.remove()"), 'Radio UI mag smaakbediening niet verwijderen');
assert.ok(!easyUse.includes("$('loveTrack')?.remove()"), 'Easy-use mag Meer van dit niet verwijderen');
assert.ok(!easyUse.includes("$('banTrack')?.remove()"), 'Easy-use mag Minder van dit niet verwijderen');
assert.ok(!easyUse.includes('removeTaste()'), 'De UX-handoff mag niet crashen op de verwijderde legacyfunctie');
assert.match(easyUse, /Meer van dit nummer en deze artiest/, 'Meer van dit heeft een toegankelijk label');
assert.match(easyUse, /Minder van dit nummer en deze artiest/, 'Minder van dit heeft een toegankelijk label');
assert.match(director, /m\.likes\[id\].*\+1/, 'Positieve voorkeur wordt in stationgeheugen opgeslagen');
assert.match(director, /m\.likes\[id\].*-3/, 'Negatieve voorkeur wordt in stationgeheugen opgeslagen');
assert.match(director, /mair:taste-feedback/, 'Voorkeursfeedback werkt Mijn MAIR direct bij');
assert.match(learning, /m\.artists\[a\]/, 'Persoonlijk leren vertaalt feedback naar artiestvoorkeur');
assert.match(learning, /JFMMusicIntelligence.*rerank/s, 'Queue wordt na feedback opnieuw gerangschikt');
assert.match(dashboard, /jfm_radio_suite/, 'Mijn MAIR gebruikt bestaande sessiestatistiek');
assert.match(dashboard, /jfm_top40_telemetry_v1/, 'Mijn MAIR gebruikt bestaande tracktelemetrie');
assert.match(dashboard, /mairfmSettingsSection='Mijn MAIR'/, 'Mijn MAIR heeft een eigen instellingensectie');
assert.ok(!/Math\.random/.test(dashboard), 'Mijn MAIR mag geen verzonnen statistieken tonen');
assert.match(loader, /mair-my-mair\.js/, 'Mijn MAIR wordt door de runtime geladen');
assert.match(easyUse, /mair-ux-v1\.css\?v=/, 'UX-stylesheet gebruikt een centrale cacheversie');
assert.ok(loader.includes(`JFM_ASSET_VERSION='${RELEASE_ASSET_VERSION}'`), 'Nieuwe UI-assets krijgen de huidige assetversie');
assert.match(loader, /mair-personalization-css/, 'Personalisatie-stijlen hebben een zelfstandige cacheveilige laadroute');
assert.match(serviceWorker, /mair-my-mair\.js/, 'Mijn MAIR zit in de offline app-shell');

const rotationSource = read('rotation-engine.js');
const store = new Map([
  ['jfm_director_memory', JSON.stringify({
    likes: { liked: 2, disliked: -3 },
    discoveryWins: { liked: 1 },
    discoveryLosses: { disliked: 1 }
  })],
  ['jfm_skips', JSON.stringify({ disliked: 2 })]
]);
const localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value))
};
const window = {
  JFMRadioSuite: { state: () => ({ lastIds: [], lastArtists: [] }) },
  JFMStationClock: { current: () => ({ show: { musicPattern: ['Familiar'], targetMomentum: .5 }, phase: 'open' }) }
};
const context = vm.createContext({ window, localStorage, console, Date, Math, JSON, Number, String, Array, Set, Object });
vm.runInContext(rotationSource, context, { filename: 'rotation-engine.js' });
const rotation = window.JFMRotation;
const liked = rotation.preferenceScore({ id: 'liked' });
const neutral = rotation.preferenceScore({ id: 'neutral' });
const disliked = rotation.preferenceScore({ id: 'disliked' });
assert.ok(liked > neutral, `Meer van dit moet prioriteit verhogen (${liked} > ${neutral})`);
assert.ok(disliked < neutral, `Minder van dit moet prioriteit verlagen (${disliked} < ${neutral})`);
assert.ok(liked - disliked >= 20, 'Positieve en negatieve signalen moeten materieel verschil maken');

console.log(`Mijn MAIR + voorkeuren: PASS — rotatiescore meer=${liked.toFixed(1)}, neutraal=${neutral.toFixed(1)}, minder=${disliked.toFixed(1)}`);
