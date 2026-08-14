// MAIR runtime facade — stable MAIR-owned access to critical subsystems while legacy JFM globals remain compatibility aliases.
(()=>{
'use strict';
if(window.MAIRRuntime)return;
const owners={playback:'playback-primary',station:'mair-station-controller',dj:'dj-authoritative',voice:'mair-voice-engine',pwa:'pwa-platform'};
const resolve=()=>({
 playback:window.JFMPlayback||window.JFMPlaybackPrimary||null,
 station:window.MAIRStationController||null,
 dj:window.JFMDJAuthoritative||null,
 voice:window.MAIRVoiceEngine||null,
 pwa:window.MAIRPWAPolish||window.JFMPWAPlatform||null,
 foundation:window.MAIRFoundation||null
});
function status(){const r=resolve();return{owners,ready:{playback:!!r.playback,station:!!r.station,dj:!!r.dj,voice:!!r.voice,foundation:!!r.foundation},speaking:!!r.voice?.speaking,stationId:localStorage.getItem('jfm_music_channel_v1')||'mix',djSchedule:r.dj?.state?.()||null}}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:runtime-ready',{detail:status()}))}catch{}}
function bindAliases(){const r=resolve();if(r.playback&&!window.MAIRPlayback)window.MAIRPlayback=r.playback;if(r.dj&&!window.MAIRDJ)window.MAIRDJ=r.dj;if(r.voice&&!window.MAIRVoice)window.MAIRVoice=r.voice;if(r.station&&!window.MAIRStationsRuntime)window.MAIRStationsRuntime=r.station}
function refresh(){bindAliases();emit();return status()}
window.MAIRRuntime={version:'mair-runtime-core-v1',owners,resolve,status,refresh};
['mair:foundation-ready','mair:djchange','mair:channelchange','mair:dj-speaking','pageshow'].forEach(name=>window.addEventListener(name,refresh));
setTimeout(refresh,0);setTimeout(refresh,700);setTimeout(refresh,1800);
})();