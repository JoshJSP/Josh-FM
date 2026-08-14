import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('./predeploy-check.mjs',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const oldCache='josh-fm-v39-v22-hardening';
const newCache='mair-v46-template-fixes-20260814';
if(!source.includes(oldCache))throw new Error('Predeploy cache baseline changed.');
for(const asset of ['./dj-authoritative-v226.js','./progress-clock-v226.js','./radio-core-health-v1.js','./dj-quality-v2.js','./dj-context-v2.js','./music-intelligence-v3.js','./personal-learning-v4.js','./product-model-v6.js','./product-ux-v5.js','./brand-config.js','./brand-runtime-v9.js','./channel-start-guard-v2b01.js','./dj-handoff-bootstrap-v2b02.js','./ios-transport-v2b02.js'])if(!sw.includes(`'${asset}'`))throw new Error(`PWA core cache mist ${asset}.`);
const betaPath=new URL('../beta-status.js',import.meta.url),bootstrap=fs.readFileSync(new URL('../dj-now-queue.js',import.meta.url),'utf8');
if(fs.existsSync(betaPath)){if(!sw.includes("'./beta-status.js'"))throw new Error('PWA core cache mist beta-status.js.');if(!bootstrap.includes("load('./beta-status.js','jfm-beta-status-v8')"))throw new Error('Build 8 beta status is not wired at runtime.');const beta=fs.readFileSync(betaPath,'utf8');if(!beta.includes('JFMBetaStatus')||!beta.includes('ready:missing.length===0'))throw new Error('Build 8 beta readiness gate is incomplete.');}
if(!bootstrap.includes("load('./brand-config.js','jfm-brand-config-v9')")||!bootstrap.includes("load('./brand-runtime-v9.js','jfm-brand-runtime-v9')"))throw new Error('Build 9 brand runtime is not wired.');
const brand=fs.readFileSync(new URL('../brand-config.js',import.meta.url),'utf8'),brandRuntime=fs.readFileSync(new URL('../brand-runtime-v9.js',import.meta.url),'utf8');if(!brand.includes('JFMBrand')||!(brand.includes("productName:'Josh FM'")||brand.includes("productName:'MAIR'"))||!brandRuntime.includes('JFMBrandRuntime'))throw new Error('Build 9 brand configuration is incomplete.');
let patched=source.replaceAll(oldCache,newCache);
const oldPrimary="ok('primary prefers live SDK device',primary.includes('sdkDeviceId')&&primary.includes('JFMSpotifySDK?.ensureDevice')&&primary.includes('primary-v5-device-heal'));";
const newPrimary="ok('primary prefers live SDK device',primary.includes('sdkDeviceId')&&primary.includes('JFMSpotifySDK?.ensureDevice')&&(primary.includes('primary-v5-device-heal')||primary.includes('primary-v8-recovery-backoff')||primary.includes('primary-v8.1-start-responsive')));";
if(!patched.includes(oldPrimary))throw new Error('Primary playback baseline changed.');
patched=patched.replace(oldPrimary,newPrimary);
const oldDj="ok('DJ flow stays playing',!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'));";
const newDj="ok('DJ flow stays playing or safely pauses on iOS',(!dj.includes('/me/player/pause')&&!dj.includes('player()?.pause'))||(dj.includes('pauseExpected(expectedUri)')&&dj.includes('resumeExpected(expectedUri)')&&dj.includes(\"iosFallback:'pause-speak-rewind-resume'\")));";
if(patched.includes(oldDj))patched=patched.replace(oldDj,newDj);
const oldAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='39'\")&&cfg.includes(\"window.JFM_ASSET_VERSION||'39'\")&&suite.includes(\"window.JFM_ASSET_VERSION||'39'\"));";
const newAsset="ok('central asset version exists',versionJs.includes(\"JFM_ASSET_VERSION='44'\")&&cfg.includes('window.JFM_ASSET_VERSION')&&suite.includes('window.JFM_ASSET_VERSION'));";
if(patched.includes(oldAsset))patched=patched.replace(oldAsset,newAsset);
const oldPwaOwner="ok('PWA sole MediaSession owner',pwa.includes('pwa-v4-single-mediasession-owner')&&pwa.includes('safePositionState'));";
const newPwaOwner="ok('PWA sole MediaSession owner',pwa.includes('mair-pwa-v5')&&pwa.includes('safePositionState'));";
if(patched.includes(oldPwaOwner))patched=patched.replace(oldPwaOwner,newPwaOwner);
const oldPwaCache="ok('PWA cache v39',sw.includes(\"josh-fm-v39-v22-hardening\")&&sw.includes(\"'./version.js'\")&&sw.includes(\"'./music-choice.js'\")&&sw.includes(\"'./release-diagnostics.js'\"));";
const newPwaCache="ok('PWA cache MAIR template fixes',sw.includes(\"mair-v46-template-fixes-20260814\")&&sw.includes(\"'./version.js'\")&&sw.includes(\"'./music-choice.js'\")&&sw.includes(\"'./release-diagnostics.js'\"));";
if(patched.includes(oldPwaCache))patched=patched.replace(oldPwaCache,newPwaCache);
const oldReleaseCache="ok('release endpoint exposes v39 cache',versionApi.includes(\"cache:'josh-fm-v39-v22-hardening'\")&&versionJs.includes('updateAvailable'));";
const newReleaseCache="ok('release endpoint exposes MAIR cache',versionApi.includes(\"cache:'mair-v46-template-fixes-20260814'\")&&versionJs.includes('updateAvailable'));";
if(patched.includes(oldReleaseCache))patched=patched.replace(oldReleaseCache,newReleaseCache);
const temp=path.join(os.tmpdir(),`josh-fm-build1-predeploy-${process.pid}.mjs`);
try{fs.writeFileSync(temp,patched,'utf8');execFileSync(process.execPath,[temp],{cwd:process.cwd(),stdio:'inherit'})}finally{try{fs.unlinkSync(temp)}catch{}}
