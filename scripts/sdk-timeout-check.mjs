import fs from 'node:fs';
import assert from 'node:assert/strict';
// Een SDK-aanroep die nooit antwoordt mag Play niet eeuwig op "bezig" laten staan:
// hij faalt na de limiet met SDK_TIMEOUT, logt dat en bouwt de speler opnieuw op.
const src=fs.readFileSync(new URL('../playback-primary.js',import.meta.url),'utf8');
const def=src.match(/const SDK_CALL_MS=[^\n]*\n\s*const player=[^\n]*/)[0].replace('SDK_CALL_MS=6000','SDK_CALL_MS=120');
const logged=[];let reconnects=0;
const window={MAIRRuntime:{record:t=>logged.push(t)},JFMSpotifySDK:{reconnect:async()=>{reconnects++}}};
const raw={getCurrentState:()=>new Promise(()=>{}),resume:async()=>'ok',name:'MAIRFM'};
window.jfmSpotifyPlayer=raw;
const player=new Function('window',def+';return player')(window);
const p=player();
assert.equal(p,player(),'zelfde wrapper per speler');assert.equal(p.name,'MAIRFM');
assert.equal(await p.resume(),'ok','snelle aanroep komt gewoon door');
await assert.rejects(p.getCurrentState(),e=>e.code==='SDK_TIMEOUT','hangende aanroep faalt na de limiet');
assert.deepEqual(logged,['spotify.sdk-call-timeout']);assert.equal(reconnects,1,'speler wordt opnieuw opgebouwd');
console.log('MAIR SDK-tijdslimiet: PASS');
