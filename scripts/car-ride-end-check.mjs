// Aankomst-DJ en ritlijst (Josh 25-11).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../mair-car-ride-dj.js',import.meta.url),'utf8');
const ctx={addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,localStorage:{getItem:()=>null},document:{visibilityState:'visible'}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const L=ctx.MAIRCarRideDJ.arrivalLine;
assert.equal(L({min:24,diff:-3}),'Je bent er. 24 minuten onderweg, 3 minuten sneller dan gedacht.');
assert.equal(L({min:24,diff:2}),'Je bent er. 24 minuten onderweg, 2 minuten langer dan gedacht.');
assert.equal(L({min:1,diff:0}),'Je bent er. 1 minuut onderweg, precies zoals gedacht.');
assert.equal(L({min:75,diff:null}),'Je bent er. 1 uur en 15 minuten onderweg.');
const car=fs.readFileSync(new URL('../prototypes/mair-car-mode-wave.js',import.meta.url),'utf8');
assert.ok(car.includes("'mair_car_rides_v1'")&&car.includes('.slice(0,10)'),'rit moet in de lijst van 10 komen');
assert.ok(car.includes("'mair:car-ride-end'"),'Car Mode moet het einde van de rit melden');
console.log('MAIR aankomst-DJ: PASS');
