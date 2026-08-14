import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg)};

const live=read('live-ui.js');
const suite=read('radio-suite.js');
const pwa=read('pwa-platform.js');
const voice=read('debug-tts.js');
const polish=read('mair-pwa-polish.js');
const foundation=read('mair-foundation.js');
const foundationCss=read('mair-foundation.css');
const manifest=read('manifest.webmanifest');
const logo=read('mair-logo.svg');
const health=read('station-health.js');
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
expect(polish.includes('height:max(44px,env(safe-area-inset-top))'),'iPhone top-scrim dekt de statusbalkzone niet af');
expect(polish.includes('pointer-events:none'),'top-scrim mag taps nooit onderscheppen');
expect(polish.includes('#jfmLiveMeta,#showMini'),'legacy live/show overlays moeten defensief verborgen worden');
expect(!polish.includes('mair-artwork-fix.css'),'legacy artwork sprite stylesheet mag niet meer geladen worden');
expect(!foundation.includes('mair-sprite-img'),'MAIR UI mag niet meer afhankelijk zijn van defecte sprite image-elementen');
expect(!foundation.includes('mair-visual-sprite.svg'),'MAIR UI mag niet meer afhankelijk zijn van defecte sprite asset');
expect(foundationCss.includes('.mair-station-art:before'),'station artwork fallback ontbreekt');
expect(foundationCss.includes('.mair-avatar-initial'),'DJ avatar fallback ontbreekt');
expect(foundation.includes('purgeLegacyNowNextLater'),'NU/STRAKS/LATER legacy guard ontbreekt');
expect(logo.includes('MAIR app icon')&&logo.includes('▥')===false,'app icon moet de nieuwe MAIR templateversie zijn');
expect(manifest.includes('mair-logo.svg?v=12'),'manifest gebruikt niet het vernieuwde MAIR-icoon');
expect(!health.includes('Test Josh FM opnieuw'),'Self Test bevat nog oude Josh FM-knoptekst');
expect(health.includes("btn.textContent='Test MAIR opnieuw'")&&health.includes("b.textContent='Test MAIR opnieuw'"),'Self Test gebruikt niet overal MAIR');
expect(health.includes("name:brand(c.show.name)")&&health.includes("esc(brand(s.show?.name||'—'))"),'Self Test scrubt oude programmanaam niet');
expect(sw.includes("const CACHE='mair-v46-template-fixes-20260814'"),'service-worker cache is niet verhoogd voor de templatefix');
expect(sw.includes("k.startsWith('josh-fm-')"),'service worker moet oude Josh FM caches opruimen');

if(failures.length){
  console.error('\nMAIR regression gate FAILED');
  for(const f of failures)console.error(`- ${f}`);
  process.exit(1);
}
console.log('MAIR regression gate OK');
