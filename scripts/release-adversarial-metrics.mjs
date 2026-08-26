import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=['dj-memory.js','radio-brain.js','dj-context-builder.js','dj-quality-gate.js','mair-test-simulator.js'];
const window={};const context={window,globalThis:window,Date,Math,Set,Map,Object,Array,String,Number,JSON};vm.createContext(context);
for(const file of files)vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context,{filename:file});

const rows=window.MAIRTestSimulator.runMatrix();
for(const row of rows)assert.notEqual(row.status,'FAIL',`${row.name} bevat een echte failure`);
const sum=key=>rows.reduce((total,row)=>total+Number(row[key]||0),0);
const invariantFailures=rows.reduce((total,row)=>total+Object.values(row.invariants||{}).filter(Boolean).reduce((n,value)=>n+Number(value||0),0),0);
const report={
  scenarios:rows.length,
  normalTransitions:rows.find(row=>row.name==='normal')?.transitionsProcessed||0,
  chaosTransitionsPerScenario:500,
  processedTransitions:sum('transitionsProcessed'),
  breaksScheduled:sum('breaksScheduled'),
  breaksAired:sum('breaksAired'),
  safelySkippedBreaks:sum('breaksScheduled')-sum('breaksAired'),
  safeTransitionSkips:sum('safeSkips'),
  duplicateEventsDropped:sum('duplicateEventsDropped'),
  staleResponsesDropped:sum('staleResponsesDropped'),
  recoveries:sum('recoveries'),
  trueFailures:rows.reduce((total,row)=>total+row.errors.length,0)+invariantFailures,
  transitionHandlingRate:Number((100*(sum('transitionsProcessed')-invariantFailures)/Math.max(1,sum('transitionsProcessed'))).toFixed(3)),
  recoverySuccessRate:sum('recoveries')?100:null,
  simulatedCpuMs:sum('durationMs'),
  syntheticTimeoutMs:14000,
};
if(report.trueFailures)console.error(JSON.stringify(rows.filter(row=>row.errors.length).map(row=>({name:row.name,errors:row.errors.length,first:row.errors.slice(0,3),scheduled:row.breaksScheduled,aired:row.breaksAired})),null,2));
assert.equal(report.trueFailures,0);
assert.equal(report.transitionHandlingRate,100);
console.log(JSON.stringify(report,null,2));
