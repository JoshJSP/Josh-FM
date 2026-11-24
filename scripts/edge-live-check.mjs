// Dagelijkse check (VERBETERPLAN stap "Edge kan weer veranderen"): maakt één korte zin en een journaal-lange tekst via de echte Edge-stem,
// voor alle drie de DJ's (nl-NL). Faalt hij, dan stopt dit script met exit 1 en mailt GitHub Actions de eigenaar.
// Het journaal is de test die telt: 24-11-2026 faalde alleen lange tekst (>7 s) en het uurnieuws werd nooit uitgezonden.
import {edgeSynthesize,edgeSpeak} from '../api/tts.js';
const short=await edgeSynthesize('josh','Dit is de dagelijkse check van de Edge-stem.',15000);
if(!short.ok){console.error(`edge-live-check: FAIL (${short.status}) ${short.detail} [stem ${short.voice}, ${short.ms} ms]`);process.exit(1)}
console.log(`edge-live-check: PASS kort (${short.buf.length} bytes mp3, stem ${short.voice}, ${short.ms} ms)`);
const news='MAIRFM Nieuws. De Tweede Kamer heeft vanmiddag gestemd over de begroting en een meerderheid steunde het voorstel. In Utrecht viel het openbaar vervoer urenlang stil door een storing aan het spoor. De politie onderzoekt een brand in een loods in Rotterdam waarbij niemand gewond raakte. Het KNMI waarschuwt voor gladheid in het noorden van het land vannacht. Dat was het nieuws.';
for(const dj of ['josh','maya','max']){
  const r=await edgeSpeak(dj,news);
  if(!r.ok||r.buf.length<50000){console.error(`edge-live-check: FAIL journaal ${dj} (${r.status}) ${r.detail||'te kort: '+r.buf?.length} [${r.ms} ms]`);process.exit(1)}
  console.log(`edge-live-check: PASS journaal ${dj} (${r.buf.length} bytes mp3, stem ${r.voice}, ${r.ms} ms)`);
}
