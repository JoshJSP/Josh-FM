import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync(new URL('./app-smoke-check-v362.mjs',import.meta.url),'utf8');
const patched=source.replaceAll('josh-fm-v43-rebrand-ready','josh-fm-v44-stabilization-01');
const temp=path.join(os.tmpdir(),`jfm-smoke-stabilization-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
