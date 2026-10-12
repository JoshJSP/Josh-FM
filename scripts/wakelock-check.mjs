// Gedragstest voor mair-wakelock.js met een nep Wake Lock API: alleen vast zolang Car Mode open is, opnieuw na verborgen, stil bij weigering.
import fs from 'node:fs';import vm from 'node:vm';
let fail=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fail++};
function setup({supported=true,reject=false}={}){
  const listeners={doc:{},win:{}};let requests=0,released=0,visibility='visible';
  const navigator=supported?{wakeLock:{request:async()=>{requests++;if(reject)throw new Error('NotAllowedError');const l={listeners:{},addEventListener(n,f){this.listeners[n]=f},async release(){released++;this.listeners.release?.()}};return l}}}:{};
  const document={get visibilityState(){return visibility},addEventListener:(n,f)=>{listeners.doc[n]=f}};
  const window={addEventListener:(n,f)=>{listeners.win[n]=f},MAIRRuntime:{caught(){}}};
  vm.runInNewContext(fs.readFileSync(new URL('../mair-wakelock.js',import.meta.url),'utf8'),{window,document,navigator});
  return {window,listeners,get requests(){return requests},get released(){return released},setVisibility:v=>{visibility=v}};
}
const tick=()=>new Promise(r=>setImmediate(r));
let s=setup();
s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
ok('Car Mode open: wake lock aangevraagd',s.requests===1&&s.window.MAIRWakeLock.active);
s.listeners.win['mair:car-mode']({detail:{open:false}});await tick();
ok('Car Mode dicht: wake lock vrijgegeven',s.released===1&&!s.window.MAIRWakeLock.active);
s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
s.setVisibility('hidden');s.listeners.doc.visibilitychange();
// de browser laat de lock zelf los bij verbergen
await s.window.MAIRWakeLock.set(false);s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
s.setVisibility('visible');s.listeners.doc.visibilitychange();await tick();
ok('terug zichtbaar met Car Mode open: opnieuw aanvragen',s.window.MAIRWakeLock.active);
s=setup();
s.listeners.win['mair:car-mode']({detail:{open:true}});s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
ok('twee snelle open-events geven één lock (geen lek)',s.requests===1);
s=setup({reject:true});
s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
ok('weigering: geen crash, geen lock, telt de mislukking',!s.window.MAIRWakeLock.active&&s.window.MAIRWakeLock.failures===1);
s=setup({supported:false});
s.listeners.win['mair:car-mode']({detail:{open:true}});await tick();
ok('geen ondersteuning: stil niets doen',!s.window.MAIRWakeLock.active&&s.window.MAIRWakeLock.failures===0);
console.log(`MAIR wake lock: ${fail?'FAIL':'PASS'}`);process.exit(fail?1:0);
