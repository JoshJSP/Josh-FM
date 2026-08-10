(()=>{
  const VERSION='mms-nl-pages-v1-20260811';
  const MODEL='mms-tts-nld-onnx';
  const MODEL_HOST='https://joshjsp.github.io/Josh-FM/';
  const MODEL_BASE=`${MODEL_HOST}${MODEL}/`;
  const state={pipe:null,loading:null,lastReport:null,error:'',device:null};

  async function loadTransformers(){
    if(window.__JFM_TRANSFORMERS)return window.__JFM_TRANSFORMERS;
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
      window.__JFM_TRANSFORMERS=mod;
      return mod;
    }catch(e){
      throw new Error('Transformers.js kon niet worden geladen: '+String(e?.message||e));
    }
  }

  async function fetchJson(url){
    const r=await fetch(url,{cache:'default'});
    if(!r.ok)throw new Error(`${url.split('/').pop()} kon niet worden geladen (HTTP ${r.status})`);
    return r.json();
  }

  function makeTokenizer(vocab){
    const entries=Object.entries(vocab);
    const unk=vocab['<unk>']??vocab['[UNK]']??0;
    const pad=vocab['<pad>']??vocab['[PAD]']??0;
    const map=new Map(entries.map(([k,v])=>[k,Number(v)]));
    return text=>{
      const normalized=String(text||'')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g,' ')
        .trim();
      const ids=[];
      for(const ch of normalized){
        if(map.has(ch))ids.push(map.get(ch));
        else if(ch===' '&&map.has('|'))ids.push(map.get('|'));
        else ids.push(unk);
      }
      if(!ids.length)ids.push(pad);
      return BigInt64Array.from(ids.map(BigInt));
    };
  }

  function isAppleMobile(){
    const ua=navigator.userAgent||'';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  }

  async function load(){
    if(state.pipe)return state.pipe;
    if(state.loading)return state.loading;

    state.loading=(async()=>{
      const {AutoModel,Tensor,env}=await loadTransformers();

      // Serve our validated ONNX export from GitHub Pages instead of Hugging Face.
      env.allowLocalModels=false;
      env.allowRemoteModels=true;
      env.remoteHost=MODEL_HOST;
      env.remotePathTemplate='{model}/{file}';
      env.useBrowserCache=true;

      const vocab=await fetchJson(`${MODEL_BASE}vocab.json`);
      const tokenize=makeTokenizer(vocab);

      // ONNX Runtime Web supports WASM on Safari/iOS. Its WebGPU EP is not
      // supported there, so do not waste time attempting it on iPhone/iPad.
      const devices=isAppleMobile()?['wasm']:(navigator.gpu?['webgpu','wasm']:['wasm']);
      let model=null,last=null,device=null;
      for(const candidate of devices){
        try{
          model=await AutoModel.from_pretrained(MODEL,{device:candidate,dtype:'fp32'});
          device=candidate;
          break;
        }catch(e){
          last=e;
        }
      }
      if(!model){
        throw new Error('Nederlands ONNX-model kon niet worden gestart: '+String(last?.message||last));
      }

      state.device=device;
      state.pipe=async text=>{
        const ids=tokenize(text);
        const mask=BigInt64Array.from({length:ids.length},()=>1n);
        const input_ids=new Tensor('int64',ids,[1,ids.length]);
        const attention_mask=new Tensor('int64',mask,[1,ids.length]);
        const out=await model({input_ids,attention_mask});
        const t=out.waveform||out.audio||Object.values(out).find(x=>x?.data&&x?.dims&&x.dims.length<=2);
        if(!t?.data)throw new Error('Het neural model gaf geen waveform terug.');
        return{
          audio:Float32Array.from(t.data),
          sampling_rate:model.config?.sampling_rate||16000
        };
      };
      state.error='';
      return state.pipe;
    })().catch(e=>{
      state.loading=null;
      state.error=String(e?.message||e);
      throw e;
    });

    return state.loading;
  }

  function wavBlob(samples,sampleRate){
    const data=samples instanceof Float32Array?samples:Float32Array.from(samples||[]);
    const buf=new ArrayBuffer(44+data.length*2);
    const v=new DataView(buf);
    const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    s(0,'RIFF');v.setUint32(4,36+data.length*2,true);s(8,'WAVE');s(12,'fmt ');
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);
    v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');
    v.setUint32(40,data.length*2,true);
    let o=44;
    for(const x of data){
      const n=Math.max(-1,Math.min(1,x));
      v.setInt16(o,n<0?n*32768:n*32767,true);
      o+=2;
    }
    return new Blob([buf],{type:'audio/wav'});
  }

  async function capabilities(){
    let cache=false;
    try{cache=!!window.caches}catch{}
    let hostReachable=false;
    try{
      const r=await fetch(`${MODEL_BASE}joshfm-model.json`,{method:'GET',cache:'default'});
      hostReachable=r.ok;
    }catch{}
    const report={
      version:VERSION,
      engine:'MMS neural TTS',
      model:MODEL,
      modelHost:MODEL_BASE,
      hostReachable,
      webgpu:!!navigator.gpu,
      wasm:typeof WebAssembly==='object',
      cache,
      device:state.device,
      loaded:!!state.pipe,
      error:state.error
    };
    state.lastReport=report;
    return report;
  }

  async function synthesize(text){
    const pipe=await load();
    const out=await pipe(String(text||''));
    if(!out.audio?.length)throw new Error('Het neural model gaf geen audio terug.');
    return{
      blob:wavBlob(out.audio,out.sampling_rate),
      sampleRate:out.sampling_rate,
      model:MODEL,
      device:state.device
    };
  }

  async function speak(text){
    try{
      const r=await synthesize(text);
      const url=URL.createObjectURL(r.blob);
      const a=new Audio(url);
      await new Promise((resolve,reject)=>{
        a.onended=resolve;
        a.onerror=()=>reject(new Error('Neural audio kon niet worden afgespeeld.'));
        a.play().catch(reject);
      });
      URL.revokeObjectURL(url);
      return{ok:true,voice:'Nederlandse neural AI (MMS)',model:MODEL,version:VERSION,device:state.device};
    }catch(e){
      state.error=String(e?.message||e);
      return{ok:false,error:state.error,voice:'Nederlandse neural AI (MMS)',version:VERSION};
    }
  }

  window.JFMLocalVoice={
    version:VERSION,
    load,
    synthesize,
    speak,
    capabilities,
    get report(){return state.lastReport;},
    get error(){return state.error;}
  };
})();
