import fs from 'node:fs';
const p=fs.readFileSync(new URL('../playback-primary.js',import.meta.url),'utf8');
const h=fs.readFileSync(new URL('../radio-core-health-v1.js',import.meta.url),'utf8');
const v=fs.readFileSync(new URL('../version.js',import.meta.url),'utf8');
const checks=[p.includes('JFMDJAuthoritative?.busy'),p.includes('return startDirect()'),p.includes('recoveryCooldownUntil'),p.includes("localStorage.setItem(DEVICE_KEY,confirmed)"),h.includes('playback-stall'),v.includes('radio-core-health-v1.js')];
if(checks.some(x=>!x))process.exit(1);console.log('Build 1 verification: 6 PASS / 0 FAIL');
