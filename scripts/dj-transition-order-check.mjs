import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../mair-dj-v2.js',import.meta.url),'utf8');
const start=source.indexOf('async function air(');
const end=source.indexOf('\nasync function naturalTransition',start);
assert.ok(start>=0&&end>start,'DJ air() runtime ontbreekt');
const air=source.slice(start,end);

const staleNext=air.indexOf("if(pack.nextHintId&&expectedTrackId");
const staleVoice=air.indexOf("if(pack.voiceProfileId");
const voiceReady=air.indexOf('await ensureVoiceReady();');
const hint=air.indexOf('const hinted=truth()');
const fastPause=air.indexOf('await pauseMusic(uri)',hint);
const validate=air.indexOf('const s=await stableCurrent',fastPause);
const imaging=air.indexOf('MAIRImaging?.beforeBreak',validate);
const speak=air.indexOf('await playPrepared(pack)',validate);
const rewindResume=air.indexOf('await restoreMusic(uri,{rewind})',speak);

assert.ok(staleNext>=0&&staleVoice>=0&&voiceReady>=0,'DJ preflight/voice-ready validatie ontbreekt');
assert.ok(fastPause>=0,'Spotify-hold ontbreekt');
assert.ok(staleNext<fastPause&&staleVoice<fastPause,'Stale track/profiel moet vóór transportwijziging worden geweigerd');
assert.ok(voiceReady<fastPause,'Voice start-ready moet vóór de Spotify-hold bevestigd zijn');
assert.ok(hint>=0&&fastPause>hint,'Nieuwe track moet via actuele playback-truth direct worden vastgehouden');
assert.ok(fastPause<validate,'REGRESSIE: Spotify wordt pas na remote stabiliteitscontrole gepauzeerd');
assert.ok(imaging<0||(validate<imaging&&imaging<speak),'Radio-imaging mag alleen tussen validatie en DJ-audio draaien');
assert.ok(validate<speak,'DJ mag pas spreken nadat de vastgehouden track is gevalideerd');
assert.ok(speak<rewindResume,'Nieuwe track moet pas na de DJ vanaf het begin worden hervat');
assert.ok(source.includes("stableCurrent(expectedId='',timeoutMs=2400,playing=true)"),'stableCurrent ondersteunt gepauzeerde overgang niet');
assert.ok(source.includes("paused?1600:2400,paused?false:true"),'Gehouden overgang wordt niet als gepauzeerd gevalideerd');
assert.ok(source.includes('if(audioStatus().audioUnlocked)return true'),'Voice-ready pad moet instant zijn als audio al ontgrendeld is');

console.log('MAIR DJ transition order: PASS — voice ready, hold vóór validatie, imaging veilig, DJ vóór muziek');
