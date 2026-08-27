import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../mair-spotify-ux-session-fix.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../mair-easy-use-v1.js',import.meta.url),'utf8');
assert.match(shell,/mair-spotify-ux-session-fix\.js/,'MAIRFM shell must load the Spotify session UX guard');
assert.doesNotMatch(src,/addEventListener\(['"]click/,'session UX guard must not intercept global clicks');
assert.doesNotMatch(src,/MutationObserver/,'session UX guard must not install DOM observers');

const storage=new Map([['jfm_refresh','refresh-token']]);
const listeners={};
const window={
  JFMAuth:{state:{hasRefreshToken:true,hasAccessToken:false}},
  MAIRSpotifySessionReliability:{state:{hasRefreshToken:true,hasAccessToken:false,reauthRequired:false}},
  JFMSpotifySDK:{deviceId:''},
  JFMPlayback:{state:{deviceId:''}},
  JFMPlaybackState:{get:()=>({deviceId:''})},
  MAIRUXState:{get:()=>({appState:'DISCONNECTED',spotifyConnection:{connected:false,connecting:false,label:'Niet verbonden'},playbackState:{isPlaying:false},track:null,recoverableError:null})},
  MAIRUX:{render:()=>{}},
  MAIRRuntime:{register:()=>{}},
  addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)}
};
const context={window,document:{hidden:false,addEventListener:()=>{}},localStorage:{getItem:k=>storage.get(k)||null},setTimeout:fn=>{fn();return 1},setInterval:()=>1,clearInterval:()=>{},console};
vm.createContext(context);vm.runInContext(src,context);
const api=window.MAIRSpotifyUXSessionFix;assert.ok(api,'session UX guard must install');

let fixed=api.fixState({appState:'DISCONNECTED',spotifyConnection:{connected:false,connecting:false,label:'Niet verbonden'},playbackState:{isPlaying:false},track:null,recoverableError:{diagnosticsCode:'SPOTIFY_DEVICE',primaryAction:'device',secondaryAction:'reconnect'}});
assert.equal(fixed.spotifyConnection.connected,true,'refresh credential must keep Spotify logically connected without a device');
assert.equal(fixed.appState,'RECOVERING','missing device with valid auth must recover instead of disconnect');
assert.equal(fixed.recoverableError.primaryAction,'device');
assert.equal(fixed.recoverableError.secondaryAction,'diagnostics','device errors must never suggest OAuth reconnect');

fixed=api.fixState({appState:'PAUSED',spotifyConnection:{connected:false},playbackState:{isPlaying:false},track:{id:'x'},recoverableError:{diagnosticsCode:'PLAYBACK_STOPPED',primaryAction:'resume',secondaryAction:'reconnect'}});
assert.equal(fixed.recoverableError.secondaryAction,'diagnostics','playback recovery must not suggest OAuth reconnect');

window.MAIRSpotifySessionReliability.state={hasRefreshToken:false,hasAccessToken:false,reauthRequired:true};storage.delete('jfm_refresh');
fixed=api.fixState({appState:'DISCONNECTED',spotifyConnection:{connected:false},playbackState:{},track:null,recoverableError:null});
assert.equal(fixed.spotifyConnection.connected,false);
assert.equal(fixed.recoverableError.diagnosticsCode,'SPOTIFY_REAUTH_REQUIRED');
assert.equal(fixed.recoverableError.primaryAction,'reconnect','only definitive reauth-required state may offer Spotify reconnect');
console.log('spotify-session-stage3-check: ok');
