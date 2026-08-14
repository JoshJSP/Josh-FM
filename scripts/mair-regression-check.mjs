import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg)};

const live=read('live-ui.js');
const suite=read('radio-suite.js');
const pwa=read('pwa-platform.js');
const voice=read('debug-tts.js');
const polish=read('mair-pwa-polish.js');
const sw=read('sw.js');

expect(!live.includes("live.id='jfmLiveMeta'"),'live-ui mag geen tweede live-metablok meer toevoegen');
expect(!live.includes('Josh FM'),'live-ui bevat nog zichtbare Josh FM-branding');
expect(!suite.includes('ensureShowPill'),'radio-suite mag geen legacy showMini-pill meer injecteren');
expect(!suite.includes('Josh FM'),'radio-suite bevat nog zichtbare Josh FM-branding');
expect(suite.includes('mair-logo.svg'),'radio-suite moet het MAIR-icoon gebruiken');
expect(!pwa.includes('Josh FM'),'pwa-platform bevat nog zichtbare Josh FM-branding');
expect(pwa.includes('Nieuwe MAIR-versie klaar.'),'PWA-updatebanner moet MAIR heten');
expect(voice.includes("selectedLanguage='nl'"),'DJ-taal moet Nederlands zijn');
expect(!voice.includes("['pointerdown','touchstart','click']"),'TTS mag geen globale click-capture listener installeren');
expect(voice.includes('Nederlandse MAIR DJ'),'stemkeuze moet de Nederlandse MAIR DJ tonen');
expect(polish.includes('safe-area-inset-top'),'iPhone safe-area bescherming ontbreekt');
expect(polish.includes('#jfmLiveMeta,#showMini'),'legacy live/show overlays moeten defensief verborgen worden');
expect(sw.includes("const CACHE='mair-"),'service-worker cache moet een MAIR-versie gebruiken');
expect(sw.includes("k.startsWith('josh-fm-')"),'service worker moet oude Josh FM caches opruimen');

if(failures.length){
  console.error('\nMAIR regression gate FAILED');
  for(const f of failures)console.error(`- ${f}`);
  process.exit(1);
}
console.log('MAIR regression gate OK');
