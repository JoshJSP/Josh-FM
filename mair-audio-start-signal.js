(()=>{
'use strict';
if(window.__mairAudioStartSignal)return;window.__mairAudioStartSignal=true;
const NativeAudio=window.Audio;if(typeof NativeAudio!=='function')return;
let seq=0;
function emit(type,a,extra={}){try{window.dispatchEvent(new CustomEvent(type,{detail:{token:Number(a.__mairVoiceToken||0),provider:'fish',route:'html-audio',at:Date.now(),...extra}}))}catch{}}
function decorate(a){if(!a||a.__mairVoiceSignalBound)return a;a.__mairVoiceSignalBound=true;a.addEventListener('playing',()=>{if(!a.__mairVoiceToken)a.__mairVoiceToken=++seq;emit('mair:voice-playback-start',a) });a.addEventListener('ended',()=>{if(a.__mairVoiceToken)emit('mair:voice-playback-end',a);a.__mairVoiceToken=0});a.addEventListener('error',()=>{if(a.__mairVoiceToken)emit('mair:voice-playback-error',a);a.__mairVoiceToken=0});return a}
function PatchedAudio(...args){return decorate(new NativeAudio(...args))}
PatchedAudio.prototype=NativeAudio.prototype;try{Object.setPrototypeOf(PatchedAudio,NativeAudio)}catch{}window.Audio=PatchedAudio;
window.MAIRAudioStartSignal={version:'mair-audio-start-signal-v1',route:'html-audio-playing-event'};
})();