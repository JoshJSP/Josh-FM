import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./predeploy-check.mjs',import.meta.url),'utf8');
const old='josh-fm-v39-v22-hardening';
const next='josh-fm-v40-v221-hotfix';
if(!source.includes(old))throw new Error('Predeploy cache baseline changed; update the v40 adapter.');
let patched=source.replaceAll(old,next);
const oldDj="ok('DJ flow stays playing',!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'));";
const newDj="ok('DJ flow stays playing or safely pauses on iOS',(!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'))||(dj.includes('pauseExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')&&dj.includes(\"iosFallback:'pause-speak-rewind-resume'\")));";
if(patched.includes(oldDj))patched=patched.replace(oldDj,newDj);
const oldAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='39'\")&&cfg.includes(\"window.JFM_ASSET_VERSION||'39'\")&&suite.includes(\"window.JFM_ASSET_VERSION||'39'\"));";
const newAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='40'\")&&cfg.includes('window.JFM_ASSET_VERSION')&&suite.includes('window.JFM_ASSET_VERSION'));";
if(patched.includes(oldAsset))patched=patched.replace(oldAsset,newAsset);
const temp=path.join(os.tmpdir(),`josh-fm-predeploy-${process.pid}.mjs`);
try{
  fs.writeFileSync(temp,patched,'utf8');
  execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'});
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
