// Car Mode: een gehaalde of gepasseerde tussenstop verdwijnt uit de route (15-10-2026).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../prototypes/mair-car-mode-wave.js',import.meta.url),'utf8');
const a=src.indexOf('const ARRIVE_M='),b=src.indexOf('// --- Afwijken van de route');assert.ok(a>0&&b>a,'aankomstblok gevonden');
function run(along,stops=['A','B']){
  const ctx={s:{proj:{along},stops:stops.map(name=>({name})),pos:{latitude:51.5,longitude:4.8},destination:{name:'Eind'},routeActive:true},legAlong:[1000,2000,3000],toasts:[],routes:0,
    toast:t=>ctx.toasts.push(t),publish(){},render(){},unwatch(){},stopRefresh(){},recalcAfterStops:async()=>{ctx.routes++}};
  vm.runInNewContext(src.slice(a,b).replace(/^(const|let) /gm,'var ')+';globalThis.checkArrival=checkArrival',ctx);return ctx}
{const c=run(1300);c.checkArrival();assert.deepEqual(c.s.stops.map(x=>x.name),['B'],'stop A is gepasseerd en weg');assert.equal(c.routes,1,'route opnieuw berekend');assert.equal(c.s.origin.name,'Huidige locatie')}
{const c=run(500);c.checkArrival();assert.equal(c.s.stops.length,2,'onderweg naar A: niets weg');assert.equal(c.routes,0)}
{const c=run(990);for(let i=0;i<3;i++)c.checkArrival();assert.deepEqual(c.s.stops.map(x=>x.name),['B'],'aangekomen bij A: weg');assert.match(c.toasts[0],/Je bent bij A/)}
{const c=run(2960,[]);c.legAlong=[3000];for(let i=0;i<3;i++)c.checkArrival();assert.equal(c.s.routeActive,false,'eindbestemming sluit de route')}
console.log('PASS Car Mode tussenstops');
