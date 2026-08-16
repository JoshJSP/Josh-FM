(()=>{
'use strict';
if(window.__mairAudioStartSignal)return;window.__mairAudioStartSignal=true;
let seq=0;
function emit(type,target,route,extra={}){try{window.dispatchEvent(new CustomEvent(type,{detail:{token:Number(target?.__mairVoiceToken||0),provider:'fish',route,at:Date.now(),...extra}}))}catch{}}
function newToken(target){if(!target.__mairVoiceToken)target.__mairVoiceToken=++seq;return target.__mairVoiceToken}
function clearToken(target){if(target)target.__mairVoiceToken=0}
function isVoiceBlob(a){return /^blob:/i.test(String(a?.currentSrc||a?.src||''))}
const NativeAudio=window.Audio;
if(typeof NativeAudio==='function'){
  function decorate(a){if(!a||a.__mairVoiceSignalBound)return a;a.__mairVoiceSignalBound=true;
    a.addEventListener('playing',()=>{if(!isVoiceBlob(a))return;newToken(a);emit('mair:voice-playback-start',a,'html-audio')});
    a.addEventListener('ended',()=>{if(a.__mairVoiceToken)emit('mair:voice-playback-end',a,'html-audio');clearToken(a)});
    a.addEventListener('error',()=>{if(a.__mairVoiceToken)emit('mair:voice-playback-error',a,'html-audio');clearToken(a)});
    return a
  }
  function PatchedAudio(...args){return decorate(new NativeAudio(...args))}
  PatchedAudio.prototype=NativeAudio.prototype;try{Object.setPrototypeOf(PatchedAudio,NativeAudio)}catch{}window.Audio=PatchedAudio;
}
const sourceProto=window.AudioBufferSourceNode?.prototype;
if(sourceProto&&typeof sourceProto.start==='function'&&!sourceProto.__mairVoiceStartWrapped){
  const nativeStart=sourceProto.start;
  Object.defineProperty(sourceProto,'__mairVoiceStartWrapped',{value:true,configurable:true});
  sourceProto.start=function(...args){
    const isVoiceContext=!!window.JFMDJAudio?.context&&this.context===window.JFMDJAudio.context;
    if(isVoiceContext&&!this.__mairVoiceSignalBound){this.__mairVoiceSignalBound=true;this.addEventListener?.('ended',()=>{if(this.__mairVoiceToken)emit('mair:voice-playback-end',this,'web-audio');clearToken(this)},{once:true})}
    const result=nativeStart.apply(this,args);
    if(isVoiceContext){newToken(this);emit('mair:voice-playback-start',this,'web-audio')}
    return result
  }
}
window.MAIRAudioStartSignal={version:'mair-audio-start-signal-v2',routes:['html-audio-playing-event','web-audio-buffer-start']};
})();
