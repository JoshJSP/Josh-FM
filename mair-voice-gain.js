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
// Radiobewerking: highpass tegen rommel, minder modder, meer presence, lichte compressie,
// en dan naar een vast spraakniveau met piekgrens. Zo klinken alle DJ's en beide providers even hard.
const TARGET_RMS=0.1,PEAK=0.89;
function level(buf){let sum=0,peak=0,n=0;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);sum+=v*v;if(v>peak)peak=v}n+=d.length}return{rms:n?Math.sqrt(sum/n):0,peak}}
function normGain({rms,peak}){if(!(rms>0)||!(peak>0))return 1;return Math.min(TARGET_RMS/rms,PEAK/peak)}
async function polish(blob){
  try{
    const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!OAC)return blob;
    const src=await new OAC(1,1,44100).decodeAudioData((await blob.arrayBuffer()).slice(0));
    if(!src||!src.length||src.duration>MAX_SECONDS)return blob;
    const ctx=new OAC(1,src.length,src.sampleRate),node=ctx.createBufferSource();node.buffer=src;
    const f=(type,freq,gain=0)=>{const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=freq;b.gain.value=gain;return b};
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=3;comp.attack.value=0.005;comp.release.value=0.12;comp.knee.value=6;
    const chain=[f('highpass',90),f('peaking',250,-2),f('peaking',3500,3),comp];
    chain.reduce((a,b)=>(a.connect(b),b),node).connect(ctx.destination);node.start();
    const out=await ctx.startRendering();
    return new Blob([wav(out,normGain(level(out)))],{type:'audio/wav'});
  }catch(e){window.MAIRRuntime?.caught?.('voice-gain.polish',e);return blob}
}
window.MAIRVoiceGain={version:'mair-voice-gain-v2',scale,wav,polish,normGain};
})();
