// MAIR runtime facade — stable MAIR-owned access to critical subsystems while legacy JFM globals remain compatibility aliases.
(()=>{
'use strict';
if(window.MAIRRuntime)return;
const owners={playback:'playback-primary + mair-reload-audibility',station:'mair-station-controller',dj:'mair-dj-v2',djCopy:'api/dj-writer + mair-dj-profile-polish',voice:'mair-voice-engine + api/tts',pwa:'pwa-platform',musicDirector:'rotation-engine + station-clock',memory:'mair-dj-memory',imaging:'mair-imaging',liveNews:'mair-live-news + api/live-headlines',voiceLab:'mair-voice-lab',soak:'mair-soak-monitor',director:'mair-station-director'};
let emitting=false;
const resolve=()=>({
 playback:window.JFMPlayback||window.JFMPlaybackPrimary||null,
 reload:window.MAIRReloadAudibilityGuard||null,
 station:window.MAIRStationController||null,
 dj:window.MAIRDJ||window.JFMDJAuthoritative||null,
 voice:window.MAIRVoiceEngine||null,
 pwa:window.MAIRPWAPolish||window.JFMPWAPlatform||null,
 foundation:window.MAIRFoundation||null,
 profiles:window.MAIRDJProfiles||null,
 clock:window.JFMStationClock||null,
 musicDirector:window.JFMRotation||null,
 memory:window.MAIRDJMemory||null,
 imaging:window.MAIRImaging||null,
 liveNews:window.MAIRLiveNews||null,
 voiceLab:window.MAIRVoiceLab||null,
 soak:window.MAIRSoakMonitor||null,
 director:window.MAIRStationDirector||null
});
function status(){const r=resolve();return{owners,ready:{playback:!!r.playback,reloadGuard:!!r.reload,station:!!r.station,dj:!!r.dj,voice:!!r.voice,foundation:!!r.foundation,profiles:!!r.profiles,clock:!!r.clock,musicDirector:!!r.musicDirector,memory:!!r.memory,imaging:!!r.imaging,liveNews:!!r.liveNews,voiceLab:!!r.voiceLab,soak:!!r.soak,director:!!r.director},speaking:!!r.voice?.speaking,stationId:localStorage.getItem('jfm_music_channel_v1')||'mix',show:r.clock?.current?.()?.show||null,djSchedule:r.dj?.state?.()||r.dj?.diagnostics?.()||null,reload:r.reload?.status||null,djProfile:r.profiles?.current||null,imaging:r.imaging?.status?.()||null,news:r.liveNews?.peek?.()||null,soak:r.soak?.summary?.()||null}}
function emit(){if(emitting)return;emitting=true;try{window.dispatchEvent(new CustomEvent('mair:runtime-ready',{detail:status()}))}catch{}finally{emitting=false}}
function bindAliases(){const r=resolve();if(r.playback&&!window.MAIRPlayback)window.MAIRPlayback=r.playback;if(r.dj&&!window.MAIRDJ)window.MAIRDJ=r.dj;if(r.voice&&!window.MAIRVoice)window.MAIRVoice=r.voice;if(r.station&&!window.MAIRStationsRuntime)window.MAIRStationsRuntime=r.station}
function refresh(){bindAliases();emit();return status()}
window.MAIRRuntime={version:'mair-runtime-core-v1.2-radio-experience',owners,resolve,status,refresh};
['mair:foundation-ready','mair:djchange','mair:channelchange','mair:dj-speaking','mair:reload-audibility','mair:dj-memory','mair:imaging','mair:live-news','mair:soak','jfm:show-change','pageshow'].forEach(name=>window.addEventListener(name,refresh));
setTimeout(refresh,0);setTimeout(refresh,700);setTimeout(refresh,1800);
})();