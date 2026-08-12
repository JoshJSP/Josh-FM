import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';

const MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
let tts=null,backend='';

async function ensureModel(){
  if(tts) return tts;
  const hasWebGPU=!!self.navigator?.gpu;
  backend=hasWebGPU?'webgpu':'wasm';
  // Safari 26+ on iPhone supports WebGPU and handles this model more reliably there than in large WASM workers.
  const opts=hasWebGPU?{dtype:'fp32',device:'webgpu'}:{dtype:'q4',device:'wasm'};
  try{
    tts=await KokoroTTS.from_pretrained(MODEL,opts);
  }catch(primary){
    if(hasWebGPU){
      backend='wasm';
      tts=await KokoroTTS.from_pretrained(MODEL,{dtype:'q4',device:'wasm'});
    }else throw primary;
  }
  return tts;
}

self.onmessage=async e=>{
  const {id,type,text,voice,speed}=e.data||{};
  try{
    if(type==='probe'){
      self.postMessage({id,ok:true,type:'probe',webgpu:!!self.navigator?.gpu,backend:!!self.navigator?.gpu?'webgpu':'wasm'});
      return;
    }
    if(type==='load'){
      const model=await ensureModel();
      const voices=model.list_voices?.()||{};
      self.postMessage({id,ok:true,type:'loaded',voices,backend});
      return;
    }
    if(type==='generate'){
      const model=await ensureModel();
      const audio=await model.generate(String(text||''),{voice:voice||'am_michael',speed:speed||1});
      let blob;
      if(audio?.toBlob) blob=await audio.toBlob();
      else if(audio?.toWav) blob=new Blob([await audio.toWav()],{type:'audio/wav'});
      if(!blob?.size) throw new Error('Kokoro returned no audio');
      const buffer=await blob.arrayBuffer();
      self.postMessage({id,ok:true,type:'audio',buffer,mime:blob.type||'audio/wav',backend},[buffer]);
      return;
    }
    throw new Error('Unknown worker command');
  }catch(err){
    self.postMessage({id,ok:false,error:String(err?.message||err),backend});
  }
};
