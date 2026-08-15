import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./app-smoke-check.mjs',import.meta.url),'utf8');
const oldDj="check('DJ v36 marker',dj.includes('handoff-v36-mute-rewind'));";
const newDj="check('DJ handoff transport-only marker',dj.includes('handoff-v37-transport-only')&&!dj.includes('consumeArmedIfChanged'));check('DJ manual scheduling single owner',read('dj-authoritative-v226.js').includes(\"dataset.mairDjOwner='authoritative'\")&&read('dj-authoritative-v226.js').includes('await run(true)')&&read('dj-authoritative-v226.js').includes(\"window.addEventListener('jfm:trackchange'\"));";
if(!source.includes(oldDj))throw new Error('Whole-app smoke DJ baseline changed; update the DJ adapter.');
let patched=source.replace(oldDj,newDj);
patched=patched.replace("check('backup folder exists',exists('backups/README.md')&&fs.readdirSync(path.join(root,'backups')).some(x=>x!=='README.md'));","check('Git rollback policy active',!exists('backups')&&read('PRE_DEPLOY.md').includes('rollbackpunt')); ");
patched=patched.replace("check('DJ no pause/resume',!dj.includes('/me/player/pause')&&!dj.includes(\"/me/player/play')\"));","check('DJ safe iOS handoff',dj.includes('pauseExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')&&dj.includes(\"iosFallback:'pause-speak-rewind-resume'\"));");
patched=patched.replace("check('DJ current-track guard',dj.includes(\"same?.item?.uri===expectedUri\"));","check('DJ current-track guard',dj.includes(\"same?.item?.uri!==expectedUri\")&&dj.includes('Track wisselde tijdens de DJ-break')); ");
patched=patched.replaceAll('josh-fm-v39-v22-hardening','mair-v49-hardening-cache-20260814');
patched=patched.replace("check('central asset version',versionJs.includes(\"JFM_ASSET_VERSION='39'\")&&cfg.includes(\"window.JFM_ASSET_VERSION||'39'\")&&suite.includes(\"window.JFM_ASSET_VERSION||'39'\"));","check('central asset version',versionJs.includes(\"JFM_ASSET_VERSION='44'\")&&cfg.includes('window.JFM_ASSET_VERSION')&&suite.includes('window.JFM_ASSET_VERSION')); ");
patched=patched.replace("check('single MediaSession owner marker',pwa.includes('pwa-v4-single-mediasession-owner'));","check('single MediaSession owner marker',pwa.includes('mair-pwa-v5')&&pwa.includes('safePositionState')); ");
patched=patched.replace("check('PWA cache v39',sw.includes('mair-v49-hardening-cache-20260814'));","check('PWA cache MAIR hardening',sw.includes('mair-v49-hardening-cache-20260814')&&sw.includes(\"'./mair-category-purity.js'\")&&sw.includes(\"'./mair-ui-hardening.js'\")&&sw.includes(\"'./mair-playback-category-guard.js'\")&&sw.includes(\"'./mair-build-orchestrator.js'\")); ");
patched=patched.replace("check('update detection compares caches',versionJs.includes('serverCache')&&versionJs.includes('localCache')&&versionApi.includes('mair-v49-hardening-cache-20260814'));","check('update detection compares caches',versionJs.includes('serverCache')&&versionJs.includes('localCache')&&versionApi.includes('mair-v49-hardening-cache-20260814')); ");
const temp=path.join(os.tmpdir(),`mair-smoke-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
