import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./app-smoke-check.mjs',import.meta.url),'utf8');
const old="check('DJ v36 marker',dj.includes('handoff-v36-mute-rewind'));";
const replacement="check('DJ v36.2 marker',dj.includes('handoff-v36.2-skip-safe'));check('DJ now survives manual skip',dj.includes('armed={afterId:id}')&&dj.includes('runBreak(null,true)'));";
if(!source.includes(old))throw new Error('Whole-app smoke baseline changed; update the v36.2 smoke adapter.');
const patched=source.replace(old,replacement);
const temp=path.join(os.tmpdir(),`josh-fm-smoke-${process.pid}.mjs`);
try{
  fs.writeFileSync(temp,patched,'utf8');
  execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'});
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
