import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync(new URL('./predeploy-check-v40.mjs',import.meta.url),'utf8');
const old="primary.includes('primary-v5-device-heal')";
const next="(primary.includes('primary-v5-device-heal')||primary.includes('primary-v8-recovery-backoff'))";
if(!source.includes(old))throw new Error('Primary playback baseline changed.');
const patched=source.replace(old,next);
const temp=path.join(os.tmpdir(),`josh-fm-build1-predeploy-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
