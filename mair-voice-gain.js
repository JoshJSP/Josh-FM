// MAIR stemvolume in de data: schaalt een gedecodeerde DJ-stem naar een WAV-blob.
// Op iPhone is HTMLMediaElement.volume vast, en WebAudio valt daar bij een vergrendeld scherm stil.
// Door de samples zelf te schalen volgt de stem de volumeschuif op elk toestel, via het gewone <audio>-pad.
// Elke fout geeft de originele blob terug: een te harde stem is beter dan geen stem.
(()=>{
'use strict';
if(window.MAIRVoiceGain)return;
const MAX_SECONDS=90;
function wav(buf,gain){
  const ch=Math.min(buf.numberOfChannels,2),len=buf.length,rate=buf.sampleRate,data=len*ch*2,view=new DataView(new ArrayBuffer(44+data));
  const str=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i))};
  str(0,'RIFF');view.setUint32(4,36+data,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,ch,true);view.setUint32(24,rate,true);view.setUint32(28,rate*ch*2,true);view.setUint16(32,ch*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,data,true);
  const chans=Array.from({length:ch},(_,c)=>buf.getChannelData(c));let o=44;
  for(let i=0;i<len;i++)for(let c=0;c<ch;c++){const v=Math.max(-1,Math.min(1,chans[c][i]*gain));view.setInt16(o,v<0?v*32768:v*32767,true);o+=2}
  return view;
}
async function scale(blob,gain,ctx){
  const g=Number(gain);
  if(!ctx?.decodeAudioData||!Number.isFinite(g)||g>=0.95)return blob;
  try{
    const buf=await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    if(!buf||buf.duration>MAX_SECONDS)return blob;
    return new Blob([wav(buf,Math.max(0,g))],{type:'audio/wav'});
  }catch(e){window.MAIRRuntime?.caught?.('voice-gain.scale',e);return blob}
}
window.MAIRVoiceGain={version:'mair-voice-gain-v1',scale,wav};
})();
