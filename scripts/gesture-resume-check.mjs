import fs from 'node:fs';
import assert from 'node:assert/strict';

const ux=fs.readFileSync(new URL('../mair-ux-v1.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../mair-easy-use-v1.js',import.meta.url),'utf8');

assert.match(ux,/action==='resume'\)\{const p=window\.JFMPlayback;if\(typeof p\?\.playPause==='function'\)Promise\.resolve\(p\.playPause\(\)\)/,'Verder luisteren must call playback directly inside the trusted user click');
assert.doesNotMatch(ux,/action==='resume'\)\$\('play'\)\?\.click\(\)/,'Verder luisteren must not rely only on a synthetic click of the Play button');
assert.match(shell,/const asset='82'/,'MAIR UX asset must be bumped so iOS/PWA loads the gesture fix');

console.log('Gesture resume regression: PASS');
