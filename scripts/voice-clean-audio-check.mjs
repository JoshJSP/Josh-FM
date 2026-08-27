import fs from 'node:fs';
const src=fs.readFileSync(new URL('../api/tts.js',import.meta.url),'utf8');
function ok(condition,message){if(!condition){console.error('FAIL:',message);process.exit(1)}console.log('PASS:',message)}
ok(src.includes("mp3_bitrate:192"),'Fish TTS uses the highest supported MP3 bitrate (192 kbps)');
ok(!src.includes('normalize_loudness:true'),'unsupported loudness-normalization flag is not sent to Fish');
ok(/josh:\{speed:1\.0,temperature:\.62,topP:\.68\}/.test(src),'Josh voice sampling is stabilized');
ok(/max:\{speed:1\.07,temperature:\.66,topP:\.70\}/.test(src),'Max voice sampling is stabilized without changing pace');
ok(src.includes("X-MAIR-Audio-Quality"),'voice quality version is exposed for diagnostics');
console.log('Voice clean-audio regression checks passed.');
