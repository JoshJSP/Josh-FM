(()=>{
  const MODEL='facebook/mms-tts-nld';
  const state={pipe:null,loading:null,lastReport:null,error:''};
  async function loadTransformers(){
    if(window.__JFM_TRANSFORMERS)return window.__JFM_TRANSFORMERS;
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
      window.__JFM_TRANSFORMERS=mod;return mod;
    }catch(e){throw new Error('Transformers.js kon niet worden geladen: '+String(e?.message||e));}
  }
  async function load(){
    if(state.pipe)return state.pipe;if(state.loading)return state.loading;
    state.loading=(async()=>{
      const {pipeline}=await loadTransformers();
      const devices=navigator.gpu?['webgpu','wasm']:['wasm'];let last=null;
      for(const device of devices){
        try{state.pipe=await pipeline('text-to-speech',MODEL,{device});state.error='';return state.pipe}catch(e){last=e;state.pipe=null}
      }
      throw new Error('Het Nederlandse neural model kon niet lokaal worden gestart: '+String(last?.message||last||'onbekende fout'));
    })().catch(e=>{state.loading=null;state.error=String(e?.message||e);throw e});
    return state.loading;
  }
  function wavBlob(samples,sampleRate){
    const data=samples instanceof Float32Array?samples:Float32Array.from(samples||[]),buf=new ArrayBuffer(44+data.length*2),v=new DataView(buf);
    const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};s(0,'RIFF');v.setUint32(4,36+data.length*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,data.length*2,true);
    let o=44;for(const x of data){const n=Math.max(-1,Math.min(1,x));v.setInt16(o,n<0?n*32768:n*32767,true);o+=2}return new Blob([buf],{type:'audio/wav'});
  }
  async function capabilities(){
    let cache=false;try{cache=!!window.caches}catch{}const report={engine:'MMS neural TTS',model:MODEL,webgpu:!!navigator.gpu,wasm:typeof WebAssembly==='object',cache,loaded:!!state.pipe,error:state.error};state.lastReport=report;return report;
  }
  async function synthesize(text){
    const pipe=await load(),out=await pipe(String(text||''));const audio=out.audio||out.waveform,sr=out.sampling_rate||out.samplingRate||16000;if(!audio?.length)throw new Error('Het neural model gaf geen audio terug.');return{blob:wavBlob(audio,sr),sampleRate:sr,model:MODEL};
  }
  async function speak(text){
    try{const r=await synthesize(text),url=URL.createObjectURL(r.blob),a=new Audio(url);await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Neural audio kon niet worden afgespeeld.'));a.play().catch(reject)});URL.revokeObjectURL(url);return{ok:true,voice:'Nederlandse neural AI (MMS)',model:MODEL}}catch(e){state.error=String(e?.message||e);return{ok:false,error:state.error,voice:'Nederlandse neural AI (MMS)'}}
  }
  window.JFMLocalVoice={load,synthesize,speak,capabilities,get report(){return state.lastReport},get error(){return state.error}};
})();