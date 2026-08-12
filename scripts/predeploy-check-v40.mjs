import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./predeploy-check.mjs',import.meta.url),'utf8');
const old='josh-fm-v39-v22-hardening';
const next='josh-fm-v40-v221-hotfix';
if(!source.includes(old))throw new Error('Predeploy cache baseline changed; update the v40 adapter.');
const patched=source.replaceAll(old,next);
const temp=path.join(os.tmpdir(),`josh-fm-predeploy-${process.pid}.mjs`);
try{
  fs.writeFileSync(temp,patched,'utf8');
  execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'});
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
