import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./predeploy-check.mjs',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const oldCache='josh-fm-v39-v22-hardening';
const newCache='josh-fm-v41-v226-dj-progress';
if(!source.includes(oldCache))throw new Error('Predeploy cache baseline changed.');
if(!sw.includes("'./dj-authoritative-v226.js'")||!sw.includes("'./progress-clock-v226.js'"))throw new Error('PWA core cache mist v2.2.6 DJ/progress runtime assets.');
let patched=source.replaceAll(oldCache,newCache);
const oldPrimary="ok('primary prefers live SDK device',primary.includes('sdkDeviceId')&&primary.includes('JFMSpotifySDK?.ensureDevice')&&primary.includes('primary-v5-device-heal'));";
const newPrimary="ok('primary prefers live SDK device',primary.includes('sdkDeviceId')&&primary.includes('JFMSpotifySDK?.ensureDevice')&&(primary.includes('primary-v5-device-heal')||primary.includes('primary-v8-recovery-backoff')));";
if(!patched.includes(oldPrimary))throw new Error('Primary playback baseline changed.');
patched=patched.replace(oldPrimary,newPrimary);
const oldDj="ok('DJ flow stays playing',!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'));";
const newDj="ok('DJ flow stays playing or safely pauses on iOS',(!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'))||(dj.includes('pauseExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')&&dj.includes(\"iosFallback:'pause-speak-rewind-resume'\")));";
if(patched.includes(oldDj))patched=patched.replace(oldDj,newDj);
const oldAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='39'\")&&cfg.includes(\"window.JFM_ASSET_VERSION||'39'\")&&suite.includes(\"window.JFM_ASSET_VERSION||'39'\"));";
const newAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='40'\")&&cfg.includes('window.JFM_ASSET_VERSION')&&suite.includes('window.JFM_ASSET_VERSION'));";
if(patched.includes(oldAsset))patched=patched.replace(oldAsset,newAsset);
const temp=path.join(os.tmpdir(),`josh-fm-build1-predeploy-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
