(()=>{
  const VERSION='piper-ronnie-nl-v1-20260811';
  const VOICE='nl_NL-ronnie-medium';
  const BASE='https://huggingface.co/rhasspy/piper-voices/resolve/main/nl/nl_NL/ronnie/medium/';
  const MODEL_URL=BASE+VOICE+'.onnx?download=true';
  const CONFIG_URL=BASE+VOICE+'.onnx.json?download=true';
  const state={session:null,config:null,loading:null,error:'',lastReport:null};

  async function cachedFetch(url,key){
    if('caches' in window){
      const c=await caches.open('josh-fm-piper-model-v1');
      const hit=await c.match(key);
      if(hit)return hit;
      const r=await fetch(url,{mode:'cors'});
      if(!r.ok)throw new Error(`Piper-bestand kon niet worden geladen (HTTP ${r.status})`);
      await c.put(key,r.clone()); return r;
    }
    const r=await fetch(url,{mode:'cors'}); if(!r.ok)throw new Error(`Piper-bestand kon niet worden geladen (HTTP ${r.status})`); return r;
  }

  async function load(){
    if(state.session)return state;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      const ort=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/+esm');
      ort.env.wasm.numThreads=1;
      const [mr,cr]=await Promise.all([cachedFetch(MODEL_URL,'piper-ronnie-model'),cachedFetch(CONFIG_URL,'piper-ronnie-config')]);
      const [model,config]=await Promise.all([mr.arrayBuffer(),cr.json()]);
      state.config=config;
      state.session=await ort.InferenceSession.create(model,{executionProviders:['wasm']});
      state.ort=ort; state.error=''; return state;
    })().catch(e=>{state.loading=null;state.error=String(e?.message||e);throw e;});
    return state.loading;
  }

  async function phonemize(text){
    const {phonemize}=await import('https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/+esm');
    const voice=state.config?.espeak?.voice||'nl';
    const out=await phonemize(String(text||''),voice);
    const joined=Array.isArray(out)?out.join(' '):String(out||'');
    if(!joined.trim())throw new Error('Piper-fonemizer gaf geen Nederlandse fonemen terug.');
    return Array.from(joined.trim().normalize('NFD'));
  }

  function idsFromPhonemes(chars){
    const map=state.config?.phoneme_id_map;
    if(!map)throw new Error('Piper phoneme_id_map ontbreekt.');
    const one=x=>Array.isArray(x)?x:[x];
    const ids=[];
    ids.push(...one(map['^'])); ids.push(...one(map['_']));
    for(const ch of chars){if(map[ch]!=null){ids.push(...one(map[ch]));ids.push(...one(map['_']));}}
    ids.push(...one(map['$']));
    return ids.filter(Number.isFinite);
  }

  function wavBlob(samples,sampleRate){
    const a=samples instanceof Float32Array?samples:Float32Array.from(samples||[]),b=new ArrayBuffer(44+a.length*2),v=new DataView(b);
    const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    s(0,'RIFF');v.setUint32(4,36+a.length*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,a.length*2,true);
    let o=44;for(const x of a){const n=Math.max(-1,Math.min(1,x));v.setInt16(o,n<0?n*32768:n*32767,true);o+=2;} return new Blob([b],{type:'audio/wav'});
  }

  async function synthesize(text){
    await load();
    const chars=await phonemize(text),ids=idsFromPhonemes(chars);
    if(ids.length<4)throw new Error('Te weinig Piper-fonemen om spraak te maken.');
    const ort=state.ort,cfg=state.config;
    const input=new ort.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,ids.length]);
    const input_lengths=new ort.Tensor('int64',BigInt64Array.from([BigInt(ids.length)]),[1]);
    const inf=cfg.inference||{};
    const scales=new ort.Tensor('float32',Float32Array.from([inf.noise_scale??0.667,inf.length_scale??1.0,inf.noise_w??0.8]),[3]);
    const feeds={input,input_lengths,scales};
    if((cfg.num_speakers||1)>1)feeds.sid=new ort.Tensor('int64',BigInt64Array.from([0n]),[1]);
    const out=await state.session.run(feeds),tensor=out.output||Object.values(out)[0];
    if(!tensor?.data?.length)throw new Error('Piper gaf geen audio terug.');
    const audio=Float32Array.from(tensor.data),sampleRate=cfg.audio?.sample_rate||22050;
    return{blob:wavBlob(audio,sampleRate),sampleRate,model:VOICE,device:'wasm'};
  }

  async function capabilities(){
    let reachable=false;try{const r=await fetch(CONFIG_URL,{method:'GET'});reachable=r.ok}catch{}
    const report={version:VERSION,engine:'Piper neural TTS',voice:VOICE,language:'nl_NL',modelHost:BASE,hostReachable:reachable,wasm:typeof WebAssembly==='object',cache:'caches' in window,loaded:!!state.session,device:'wasm',error:state.error};state.lastReport=report;return report;
  }

  async function speak(text){
    try{const r=await synthesize(text),url=URL.createObjectURL(r.blob),a=new Audio(url);await new Promise((res,rej)=>{a.onended=res;a.onerror=()=>rej(new Error('Piper-audio kon niet worden afgespeeld.'));a.play().catch(rej)});URL.revokeObjectURL(url);return{ok:true,voice:'Piper Ronnie (Nederlands)',model:VOICE,version:VERSION,device:'wasm'};}catch(e){state.error=String(e?.message||e);return{ok:false,error:state.error,voice:'Piper Ronnie (Nederlands)',version:VERSION};}
  }
  window.JFMLocalVoice={version:VERSION,load,synthesize,speak,capabilities,get report(){return state.lastReport;},get error(){return state.error;}};
})();
