// MAIR runtime facade — stable MAIR-owned access to critical subsystems while legacy JFM globals remain compatibility aliases.
(()=>{
'use strict';
if(window.MAIRRuntime)return;
const owners={playback:'playback-primary + mair-reload-audibility',station:'mair-station-controller',dj:'mair-dj-v2',djCopy:'api/dj-writer + mair-dj-profile-polish',voice:'mair-voice-engine + api/tts',pwa:'pwa-platform'};
let emitting=false;
const resolve=()=>({
 playback:window.JFMPlayback||window.JFMPlaybackPrimary||null,
 reload:window.MAIRReloadAudibilityGuard||null,
 station:window.MAIRStationController||null,
 dj:window.MAIRDJ||window.JFMDJAuthoritative||null,
 voice:window.MAIRVoiceEngine||null,
 pwa:window.MAIRPWAPolish||window.JFMPWAPlatform||null,
 foundation:window.MAIRFoundation||null,
 profiles:window.MAIRDJProfiles||null
});
function status(){const r=resolve();return{owners,ready:{playback:!!r.playback,reloadGuard:!!r.reload,station:!!r.station,dj:!!r.dj,voice:!!r.voice,foundation:!!r.foundation,profiles:!!r.profiles},speaking:!!r.voice?.speaking,stationId:localStorage.getItem('jfm_music_channel_v1')||'mix',djSchedule:r.dj?.state?.()||r.dj?.diagnostics?.()||null,reload:r.reload?.status||null,djProfile:r.profiles?.current||null}}
function emit(){if(emitting)return;emitting=true;try{window.dispatchEvent(new CustomEvent('mair:runtime-ready',{detail:status()}))}catch{}finally{emitting=false}}
function bindAliases(){const r=resolve();if(r.playback&&!window.MAIRPlayback)window.MAIRPlayback=r.playback;if(r.dj&&!window.MAIRDJ)window.MAIRDJ=r.dj;if(r.voice&&!window.MAIRVoice)window.MAIRVoice=r.voice;if(r.station&&!window.MAIRStationsRuntime)window.MAIRStationsRuntime=r.station}
function refresh(){bindAliases();emit();return status()}
window.MAIRRuntime={version:'mair-runtime-core-v1.1-owned-paths',owners,resolve,status,refresh};
['mair:foundation-ready','mair:djchange','mair:channelchange','mair:dj-speaking','mair:reload-audibility','pageshow'].forEach(name=>window.addEventListener(name,refresh));
setTimeout(refresh,0);setTimeout(refresh,700);setTimeout(refresh,1800);
})();