import fs from 'node:fs';
const src=fs.readFileSync(new URL('../api/tts.js',import.meta.url),'utf8');
function ok(condition,message){if(!condition){console.error('FAIL:',message);process.exit(1)}console.log('PASS:',message)}
ok(!/fish/i.test(src),'TTS route gebruikt geen Fish Audio meer');
ok(/max:\{voice:'nl-NL-ColetteNeural',pitch:'\+2Hz',rate:'\+8%'\}/.test(src),'Max houdt haar eigen tempo en toonhoogte');
ok(src.includes("X-MAIR-Audio-Quality"),'voice quality version is exposed for diagnostics');
console.log('Voice clean-audio regression checks passed.');
