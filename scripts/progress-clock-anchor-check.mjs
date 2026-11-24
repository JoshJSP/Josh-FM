// De voortgangsklok moet bij elke nieuwe meting opnieuw ankeren, ook als de positie gelijk is.
// Zonder dat liep de klok door terwijl renderPlayback de gemeten tijd schreef (0:57 <-> 1:00).
import fs from 'node:fs';import vm from 'node:vm';
let t=0;const el={elapsed:{textContent:''},barFill:{style:{}},duration:{textContent:''}};
const ctx={performance:{now:()=>t},document:{hidden:false,getElementById:id=>el[id]},window:{addEventListener(){}},setInterval:()=>0,clearInterval(){},String,Number,Math};
vm.createContext(ctx);vm.runInContext('var playback=null;'+fs.readFileSync('progress-clock-v226.js','utf8'),ctx);
const m=()=>({item:{id:'a',duration_ms:200000},progress_ms:57000,is_playing:true});
ctx.playback=m();ctx.window.JFMProgressClock.tick();
t=3000;ctx.playback=m();ctx.window.JFMProgressClock.tick();
if(el.elapsed.textContent!=='0:57')throw new Error('klok ankerde niet op nieuwe meting: '+el.elapsed.textContent);
t=5000;ctx.window.JFMProgressClock.tick();
if(el.elapsed.textContent!=='0:59')throw new Error('klok loopt niet door tussen metingen: '+el.elapsed.textContent);
console.log('progress-clock anchor check ok');
