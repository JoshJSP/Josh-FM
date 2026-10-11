// Een skip tijdens een DJ-break (afgebroken signal) mag geen Fish-backoff veroorzaken; een echte storing wel.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
const window={prepareSpeech:async()=>false,speakText:async()=>false,dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync(new URL('../dj-audio-guard.js',import.meta.url),'utf8'),{window,Date,Math,String,CustomEvent:class{}});
const guard=window.JFMDJAudioGuard;
await window.prepareSpeech('tekst',false,{signal:{aborted:true}});
ok('afgebroken voorbereiding telt niet als storing',guard.state.failures===0&&guard.available());
window.speakText=window.speakText;
await window.prepareSpeech('tekst',false,{signal:{aborted:false}});
ok('echte mislukking geeft backoff',guard.state.failures===1&&!guard.available());
console.log(`MAIR DJ-audioguard: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
