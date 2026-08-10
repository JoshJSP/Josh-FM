(()=>{
  const VERSION='mms-nl-pages-v3-20260811';
  const MODEL='mms-tts-nld-onnx';
  const MODEL_HOST='https://joshjsp.github.io/Josh-FM/';
  const MODEL_BASE=`${MODEL_HOST}${MODEL}/`;
  const state={pipe:null,loading:null,lastReport:null,error:'',device:null,tokenizerSelfTest:false};

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

  // Match Hugging Face VitsTokenizer for facebook/mms-tts-nld:
  // 1) lowercase text, 2) strip chars outside vocab, 3) insert token id 0
  // before, between and after every character when add_blank=true.
  function makeTokenizer(vocab,tokenizerConfig={}){
    const map=new Map(Object.entries(vocab).map(([k,v])=>[k,Number(v)]));
    const addBlank=tokenizerConfig.add_blank!==false;
    const normalize=tokenizerConfig.normalize!==false;
    const blankId=0;
    return text=>{
      let normalized=String(text||'').normalize('NFKC');
      if(normalize)normalized=normalized.toLowerCase();
      normalized=[...normalized].filter(ch=>map.has(ch)).join('').trim();
      if(!normalized)return BigInt64Array.from([0n]);
      const chars=[...normalized];
      const ids=[];
      if(addBlank)ids.push(blankId);
      for(const ch of chars){
        ids.push(map.get(ch));
        if(addBlank)ids.push(blankId);
      }
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
      env.allowLocalModels=false;
      env.allowRemoteModels=true;
      env.remoteHost=MODEL_HOST;
      env.remotePathTemplate='{model}';
      env.useBrowserCache=true;

      const [vocab,tokenizerConfig]=await Promise.all([
        fetchJson(`${MODEL_BASE}vocab.json`),
        fetchJson(`${MODEL_BASE}tokenizer_config.json`)
      ]);
      const tokenize=makeTokenizer(vocab,tokenizerConfig);

      // Self-test: VITS add_blank must make N visible chars become 2N+1 ids,
      // and every even position must be token id 0.
      const probe=tokenize('ab');
      state.tokenizerSelfTest=probe.length===5&&probe[0]===0n&&probe[2]===0n&&probe[4]===0n;
      if(!state.tokenizerSelfTest)throw new Error('Interne tokenizer-selftest mislukt.');

      const devices=isAppleMobile()?['wasm']:(navigator.gpu?['webgpu','wasm']:['wasm']);
      let model=null,last=null,device=null;
      for(const candidate of devices){
        try{
          model=await AutoModel.from_pretrained(MODEL,{device:candidate,dtype:'fp32'});
          device=candidate;
          break;
        }catch(e){last=e;}
      }
      if(!model)throw new Error('Nederlands ONNX-model kon niet worden gestart: '+String(last?.message||last));

      state.device=device;
      state.pipe=async text=>{
        const ids=tokenize(text);
        const mask=BigInt64Array.from({length:ids.length},()=>1n);
        const input_ids=new Tensor('int64',ids,[1,ids.length]);
        const attention_mask=new Tensor('int64',mask,[1,ids.length]);
        const out=await model({input_ids,attention_mask});
        const t=out.waveform||out.audio||Object.values(out).find(x=>x?.data&&x?.dims&&x.dims.length<=2);
        if(!t?.data)throw new Error('Het neural model gaf geen waveform terug.');
        const audio=Float32Array.from(t.data);
        if(audio.length<1000)throw new Error('Het neural model gaf onverwacht korte audio terug.');
        return{audio,sampling_rate:model.config?.sampling_rate||16000};
      };
      state.error='';
      return state.pipe;
    })().catch(e=>{state.loading=null;state.error=String(e?.message||e);throw e;});
    return state.loading;
  }

  function wavBlob(samples,sampleRate){
    const data=samples instanceof Float32Array?samples:Float32Array.from(samples||[]);
    const buf=new ArrayBuffer(44+data.length*2),v=new DataView(buf);
    const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    s(0,'RIFF');v.setUint32(4,36+data.length*2,true);s(8,'WAVE');s(12,'fmt ');
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);
    v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,data.length*2,true);
    let o=44;for(const x of data){const n=Math.max(-1,Math.min(1,x));v.setInt16(o,n<0?n*32768:n*32767,true);o+=2;}
    return new Blob([buf],{type:'audio/wav'});
  }

  async function capabilities(){
    let cache=false;try{cache=!!window.caches}catch{}
    let hostReachable=false;try{const r=await fetch(`${MODEL_BASE}joshfm-model.json`,{cache:'default'});hostReachable=r.ok}catch{}
    const report={version:VERSION,engine:'MMS neural TTS',model:MODEL,modelHost:MODEL_BASE,hostReachable,
      webgpu:!!navigator.gpu,wasm:typeof WebAssembly==='object',cache,device:state.device,loaded:!!state.pipe,
      tokenizerSelfTest:state.tokenizerSelfTest,error:state.error};
    state.lastReport=report;return report;
  }

  async function synthesize(text){
    const pipe=await load(),out=await pipe(String(text||''));
    if(!out.audio?.length)throw new Error('Het neural model gaf geen audio terug.');
    return{blob:wavBlob(out.audio,out.sampling_rate),sampleRate:out.sampling_rate,model:MODEL,device:state.device};
  }

  // Kept for compatibility. Josh FM itself plays synthesize() through its unlocked AudioContext on iOS.
  async function speak(text){
    try{
      const r=await synthesize(text),url=URL.createObjectURL(r.blob),a=new Audio(url);
      await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Neural audio kon niet worden afgespeeld.'));a.play().catch(reject)});
      URL.revokeObjectURL(url);return{ok:true,voice:'Nederlandse neural AI (MMS)',model:MODEL,version:VERSION,device:state.device};
    }catch(e){state.error=String(e?.message||e);return{ok:false,error:state.error,voice:'Nederlandse neural AI (MMS)',version:VERSION};}
  }

  window.JFMLocalVoice={version:VERSION,load,synthesize,speak,capabilities,get report(){return state.lastReport;},get error(){return state.error;}};
})();
