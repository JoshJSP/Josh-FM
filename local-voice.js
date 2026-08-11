(()=>{
  const VERSION='piper-web-nl-v2-20260811';
  const PREFERRED='nl_NL-ronnie-medium';
  const state={tts:null,voice:null,loading:null,error:'',lastReport:null};

  async function load(){
    if(state.tts&&state.voice)return state;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      const tts=await import('https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm');
      const voices=await tts.voices();
      const keys=Array.isArray(voices)?voices.map(v=>v.id||v.voiceId||v.key).filter(Boolean):Object.keys(voices||{});
      const dutch=keys.filter(k=>/^nl_NL-/i.test(k));
      const voice=keys.includes(PREFERRED)?PREFERRED:(dutch.find(k=>/ronnie/i.test(k))||dutch.find(k=>/medium/i.test(k))||dutch[0]);
      if(!voice)throw new Error('Geen Nederlandse Piper-stem gevonden in de browserruntime.');
      state.tts=tts;state.voice=voice;state.error='';
      return state;
    })().catch(e=>{state.loading=null;state.error=String(e?.message||e);throw e;});
    return state.loading;
  }

  async function synthesize(text){
    await load();
    const clean=String(text||'').trim();
    if(!clean)throw new Error('Geen tekst ontvangen voor Piper.');
    let blob;
    try{
      blob=await state.tts.predict({text:clean,voiceId:state.voice});
    }catch(e){
      state.error='Piper predict mislukt: '+String(e?.message||e);
      throw new Error(state.error);
    }
    if(!(blob instanceof Blob)||blob.size<1000){
      state.error='Piper gaf geen geldig audiobestand terug.';
      throw new Error(state.error);
    }
    return{blob,model:state.voice,device:'wasm'};
  }

  async function capabilities(){
    let stored=[];
    try{await load();stored=await state.tts.stored();}catch{}
    const report={version:VERSION,engine:'Piper TTS Web',voice:state.voice||PREFERRED,language:'nl_NL',wasm:typeof WebAssembly==='object',cache:true,loaded:Array.isArray(stored)&&stored.includes(state.voice),device:'wasm',error:state.error};
    state.lastReport=report;return report;
  }

  async function speak(text){
    try{
      const r=await synthesize(text),url=URL.createObjectURL(r.blob),a=new Audio(url);
      await new Promise((res,rej)=>{a.onended=res;a.onerror=()=>rej(new Error('Piper-audio kon niet worden afgespeeld.'));a.play().catch(rej)});
      URL.revokeObjectURL(url);return{ok:true,voice:'Piper Nederlands',model:state.voice,version:VERSION,device:'wasm'};
    }catch(e){state.error=String(e?.message||e);return{ok:false,error:state.error,voice:'Piper Nederlands',version:VERSION};}
  }

  window.JFMLocalVoice={version:VERSION,load,synthesize,speak,capabilities,get report(){return state.lastReport;},get error(){return state.error;}};
})();
