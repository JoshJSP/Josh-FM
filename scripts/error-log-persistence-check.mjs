import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Bewijst dat de foutlog een herlaadbeurt overleeft: tweede runtime-boot leest
// wat de eerste schreef, herhalingen tellen op, info-events blijven eruit.
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const boot=()=>{const window={dispatchEvent:()=>true};const context={window,localStorage,sessionStorage:{getItem:()=>null,setItem:()=>{}},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},Date,Math,Map,Object,Array,String,Number,JSON};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../mair-runtime.js',import.meta.url),'utf8'),context);return window.MAIRRuntime};

let rt=boot();
rt.record('playback.tick',{},'info');
rt.record('browser.error',{error:'boom'},'error');
rt.caught('playback-primary.transfer',new Error('Spotify 502'));
rt.caught('playback-primary.transfer',new Error('Spotify 502'));
assert.equal(rt.errorLog().length,2,'info hoort niet in de foutlog, herhaling telt op');
assert.equal(rt.errorLog()[1].count,2);

rt=boot();
const log=rt.errorLog();
assert.equal(log.length,2,'foutlog moet een herlaadbeurt overleven');
assert.equal(log[0].error,'boom');assert.equal(log[1].type,'caught.playback-primary.transfer');
rt.clearErrorLog();assert.equal(boot().errorLog().length,0);
console.log('MAIR foutlog: persistent + dedupe + wissen PASS');
