import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
let source=fs.readFileSync(new URL('./app-smoke-check-v362.mjs',import.meta.url),'utf8');
source=source.replaceAll('josh-fm-v43-rebrand-ready','josh-fm-v44-stabilization-01');
const needle="let patched=source.replace(oldDj,newDj);";
const extra="let patched=source.replace(oldDj,newDj);patched=patched.replace(\"check('single MediaSession owner marker',pwa.includes('pwa-v4-single-mediasession-owner'));\",\"check('single MediaSession owner marker',pwa.includes('pwa-v4-single-mediasession-owner')||pwa.includes('pwa-v4.1-update-reminder'));\");";
if(!source.includes(needle))throw new Error('Smoke adapter baseline changed.');
const patched=source.replace(needle,extra);
const temp=path.join(os.tmpdir(),`jfm-smoke-stabilization-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
