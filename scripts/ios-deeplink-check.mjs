// mairfm://?station=<id> in de iOS-app. Bootst na wat SceneDelegate.swift doet:
// de plist kent het schema, Swift laat alleen geldige zendernamen door, en
// window.mairDeeplink(id) wisselt de zender zonder herlaad (muziek loopt door).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const plist = fs.readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
const swift = fs.readFileSync(new URL('../ios/App/App/SceneDelegate.swift', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../mair-deeplink.js', import.meta.url), 'utf8');

assert.match(plist, /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>mairfm<\/string>/, 'Info.plist mist het mairfm-schema');
assert.match(swift, /"\^\[a-z0-9\]\{2,12\}\$"/, 'Swift moet dezelfde zender-regel gebruiken als mair-deeplink.js');
assert.match(js, /\^\[a-z0-9\]\{2,12\}\$/, 'mair-deeplink.js regel veranderd: Swift ook aanpassen');
assert.match(swift, /window\.mairDeeplink/, 'warme start moet window.mairDeeplink aanroepen, niet herladen');
assert.match(swift, /connectionOptions\.urlContexts/, 'koude start (app was dicht) wordt niet opgevangen');

// Zelfde regel als SceneDelegate.station(from:)
const station = url => {
  const u = new URL(url);
  if (u.protocol !== 'mairfm:') return null;
  const id = u.searchParams.get('station');
  return id && /^[a-z0-9]{2,12}$/.test(id) ? id : null;
};
assert.equal(station('mairfm://?station=study'), 'study');
assert.equal(station('MAIRFM://?station=chill'), 'chill');
assert.equal(station("mairfm://?station=x');alert(1)//"), null);
assert.equal(station('mairfm://?station=Study'), null);
assert.equal(station('https://josh-fm.vercel.app/?station=study'), null);

// Nep-pagina: knop tikken zet de zender pas na een tik.
function pagina(search = '') {
  const timers = [];
  const store = {};
  const body = { dataset: { musicChannel: 'hits' } };
  let geladen = 0, tikken = 0;
  const ctx = {
    URLSearchParams,
    location: { search, pathname: '/' },
    history: { replaceState: () => { ctx.location.search = ''; } },
    localStorage: { setItem: (k, v) => { store[k] = v; } },
    document: { body, querySelector: sel => { const m = /data-jfm-channel="([a-z0-9]+)"/.exec(sel); return m ? { click: () => { tikken++; body.dataset.musicChannel = m[1]; } } : null; } },
    setTimeout: (f, ms) => timers.push(f),
    reload: () => geladen++,
  };
  ctx.window = ctx;
  vm.runInNewContext(js, ctx);
  const draai = () => { while (timers.length) timers.shift()(); };
  return { ctx, store, body, draai, get tikken() { return tikken; }, get geladen() { return geladen; } };
}

// Warme start: functie bestaat, wisselt zonder herlaad.
const w = pagina();
assert.equal(typeof w.ctx.mairDeeplink, 'function');
assert.equal(w.ctx.mairDeeplink('study'), true);
w.draai();
assert.equal(w.body.dataset.musicChannel, 'study');
assert.equal(w.store.jfm_music_channel_v1, 'study');
assert.equal(w.geladen, 0);
// Rommel doet niets.
assert.equal(w.ctx.mairDeeplink("x');alert(1)//"), false);
assert.equal(w.ctx.mairDeeplink(undefined), false);

// Koude start: ?station in het adres, zelfde gedrag als op het web, adres wordt schoongemaakt.
const k = pagina('?station=chill');
k.draai();
assert.equal(k.body.dataset.musicChannel, 'chill');
assert.equal(k.ctx.location.search, '');
assert.equal(k.tikken, 1);

console.log('ok  ios-deeplink: mairfm:// in plist, Swift-regel gelijk aan web, warme start zonder herlaad, koude start via ?station');
