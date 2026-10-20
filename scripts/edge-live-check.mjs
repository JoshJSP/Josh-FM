// Dagelijkse check (VERBETERPLAN stap "Edge kan weer veranderen"): maakt één korte zin via de echte Edge-stem.
// Faalt hij, dan stopt dit script met exit 1 en mailt GitHub Actions de eigenaar.
import {edgeSynthesize} from '../api/tts.js';
const r=await edgeSynthesize('josh','Dit is de dagelijkse check van de Edge-stem.',15000);
if(!r.ok){console.error(`edge-live-check: FAIL (${r.status}) ${r.detail} [stem ${r.voice}, ${r.ms} ms]`);process.exit(1)}
console.log(`edge-live-check: PASS (${r.buf.length} bytes mp3, stem ${r.voice}, ${r.ms} ms)`);
