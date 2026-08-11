import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';

const MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
let tts=null;

async function ensureModel(){
  if(tts) return tts;
  tts=await KokoroTTS.from_pretrained(MODEL,{dtype:'q4',device:'wasm'});
  return tts;
}

self.onmessage=async e=>{
  const {id,type,text,voice,speed}=e.data||{};
  try{
    if(type==='load'){
      const model=await ensureModel();
      const voices=model.list_voices?.()||{};
      self.postMessage({id,ok:true,type:'loaded',voices});
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
      self.postMessage({id,ok:true,type:'audio',buffer,mime:blob.type||'audio/wav'},[buffer]);
      return;
    }
    throw new Error('Unknown worker command');
  }catch(err){
    self.postMessage({id,ok:false,error:String(err?.message||err)});
  }
};
