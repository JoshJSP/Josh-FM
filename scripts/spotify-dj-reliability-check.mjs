import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const spotify=read('spotify-test-config.js');
const hotfix=read('mair-reliability-hotfix.js');
const sw=read('sw.js');
const apiVersion=read('api/version.js');

assert.ok(spotify.includes("code==='invalid_grant'"),'auth hardening moet alleen definitieve invalid_grant als reauth behandelen');
assert.ok(spotify.includes("AUTH_REFRESH_RECOVERABLE"),'recoverable token refresh state ontbreekt');
assert.ok(spotify.includes("AUTH_REAUTH_REQUIRED"),'expliciete reauth state ontbreekt');
assert.ok(!spotify.includes("if(r.status===400||r.status===401)clearSpotifySession()"),'generieke 400/401 mag refresh token niet wissen');
assert.ok(spotify.indexOf("code==='invalid_grant'")<spotify.indexOf('clearSpotifySession();'),'sessie wissen moet achter invalid_grant-check staan');
assert.ok(spotify.includes("localStorage.removeItem('jfm_spotify_device_id')"),'stale Web Playback device-id moet bij nieuwe runtime ongeldig worden');
assert.ok(spotify.includes("./mair-reliability-hotfix.js"),'reliability runtime wordt niet geladen');

assert.ok(hotfix.includes("['device','reconnect'].includes(action)"),'device/reconnect UI acties worden niet onderschept');
assert.ok(hotfix.includes('JFMSpotifySDK')&&hotfix.includes('ensureDevice')&&hotfix.includes('reconnect'),'device repair gebruikt de SDK lifecycle niet');
assert.ok(hotfix.includes("JFMPlayback?.recover?."),'playback recovery ontbreekt na device repair');
assert.ok(hotfix.includes('authConnected()'),'device repair moet auth en device state scheiden');
assert.ok(!hotfix.includes("$('connect')?.click()")&&!hotfix.includes('location.href=')&&!hotfix.includes('accounts.spotify.com/authorize'),'device hotfix mag nooit zelf OAuth starten');
assert.ok(hotfix.includes('d.remaining')||hotfix.includes('remaining=Math.max'),'publieke DJ scheduling gebruikt remaining niet');
assert.ok(hotfix.includes('Nog ongeveer')&&hotfix.includes('volgende natuurlijke overgang'),'DJ proximity copy ontbreekt');
assert.ok(hotfix.includes('recoverDjPlanning')&&hotfix.includes('lastMissReason'),'DJ planning recovery moet gemiste/failed breaks kunnen herstellen');
assert.ok(hotfix.includes("mair:dj-v2-state"),'publieke DJ UI volgt authoritative DJ state niet');

assert.ok(sw.includes("mair-v98-reliability-20260827"),'service worker cache is niet gebumpt');
assert.ok(sw.includes("'./mair-reliability-hotfix.js'"),'reliability hotfix ontbreekt uit PWA cache');
assert.ok(apiVersion.includes("mair-v98-reliability-20260827"),'server cache version komt niet overeen met service worker');

console.log('Spotify/DJ reliability: PASS — refresh token blijft behouden bij herstelbare fouten, device repair start geen OAuth en DJ scheduling is publiek observeerbaar.');
