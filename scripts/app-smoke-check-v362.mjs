import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./app-smoke-check.mjs',import.meta.url),'utf8');
const oldDj="check('DJ v36 marker',dj.includes('handoff-v36-mute-rewind'));";
const newDj="check('DJ v36.2 marker',dj.includes('handoff-v36.2-mute-rewind-skip-safe'));check('DJ now survives manual skip',dj.includes('armed={fromId:id,requestedAt:Date.now()}')&&dj.includes('consumeArmedIfChanged')&&dj.includes('runBreak(null,true)'));";
if(!source.includes(oldDj))throw new Error('Whole-app smoke DJ baseline changed; update the v36.2 adapter.');
let patched=source.replace(oldDj,newDj);
patched=patched.replace("check('DJ no pause/resume',!dj.includes('/me/player/pause')&&!dj.includes(\"/me/player/play')\"));","check('DJ safe iOS handoff',dj.includes('pauseExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')&&dj.includes(\"iosFallback:'pause-speak-rewind-resume'\"));");
patched=patched.replace("check('DJ current-track guard',dj.includes(\"same?.item?.uri===expectedUri\"));","check('DJ current-track guard',dj.includes(\"same?.item?.uri!==expectedUri\")&&dj.includes('Track wisselde tijdens de DJ-break')); ");
patched=patched.replaceAll('josh-fm-v39-v22-hardening','mair-v46-template-fixes-20260814');
patched=patched.replace("check('central asset version',versionJs.includes(\"JFM_ASSET_VERSION='39'\")&&cfg.includes(\"window.JFM_ASSET_VERSION||'39'\")&&suite.includes(\"window.JFM_ASSET_VERSION||'39'\"));","check('central asset version',versionJs.includes(\"JFM_ASSET_VERSION='44'\")&&cfg.includes('window.JFM_ASSET_VERSION')&&suite.includes('window.JFM_ASSET_VERSION')); ");
patched=patched.replace("check('single MediaSession owner marker',pwa.includes('pwa-v4-single-mediasession-owner'));","check('single MediaSession owner marker',pwa.includes('mair-pwa-v5')&&pwa.includes('safePositionState')); ");
patched=patched.replace("check('PWA cache v39',sw.includes('mair-v46-template-fixes-20260814'));","check('PWA cache MAIR template fixes',sw.includes('mair-v46-template-fixes-20260814')); ");
patched=patched.replace("check('update detection compares caches',versionJs.includes('serverCache')&&versionJs.includes('localCache')&&versionApi.includes('mair-v46-template-fixes-20260814'));","check('update detection compares caches',versionJs.includes('serverCache')&&versionJs.includes('localCache')&&versionApi.includes('mair-v46-template-fixes-20260814')); ");
const temp=path.join(os.tmpdir(),`josh-fm-smoke-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
