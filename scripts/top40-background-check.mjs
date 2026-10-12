// Naar de achtergrond en terug op hetzelfde nummer is één luisterbeurt: geen tweede start en geen dubbele 'completed'.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
const store={};let t=1e12,hidden=false,listeners={};
const track={id:'a',name:'A',artists:['x'],image:'',uri:'spotify:track:a',duration:200000};
const ctx={Date:{now:()=>t},Math,Number,String,Object,JSON,Array,console,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},
 setTimeout:()=>0,setInterval:()=>0,
 window:{addEventListener:(n,f)=>{listeners[n]=f},JFMPlaybackState:{get:()=>({progressMs:ctx.progress,durationMs:200000})}},
 document:{readyState:'complete',get hidden(){return hidden},getElementById:()=>null,addEventListener:(n,f)=>{listeners['doc:'+n]=f},querySelector:()=>null,createElement:()=>({style:{},classList:{add(){}},addEventListener(){},appendChild(){}}),body:{}},
 playback:{item:{id:'a',name:'A',duration_ms:200000},progress_ms:0},trackObj:()=>track,progress:0};
vm.runInNewContext(fs.readFileSync(new URL('../personal-top40.js',import.meta.url),'utf8'),ctx);
const db=()=>JSON.parse(store.jfm_top40_telemetry_v1||'{}').a||{};
ctx.playback.progress_ms=10000;listeners['jfm:trackchange']({});
ok('eerste start telt 1',db().starts===1);
ctx.playback.progress_ms=160000;t+=150000;hidden=true;listeners['doc:visibilitychange']();
ok('achtergrond telt niet als voltooid',(db().completed||0)===0);
t+=60000;hidden=false;listeners['doc:visibilitychange']();
ok('terug op hetzelfde nummer telt geen nieuwe start',db().starts===1);
ctx.playback.progress_ms=199000;t+=30000;listeners['jfm:trackchange']({});
ok('natuurlijk einde telt precies één keer voltooid',db().completed===1);
console.log(`MAIR top40 achtergrond: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
