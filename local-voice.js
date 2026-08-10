(()=>{
  const state={voices:[],voice:null,lastReport:null};
  const preferredNames=['premium','enhanced','siri','xander','claire','ellen','fenna','flo','nl-nl'];
  const norm=s=>String(s||'').toLowerCase();
  function score(v){
    const lang=norm(v.lang),name=norm(v.name);let n=0;
    if(lang==='nl-nl')n+=100;else if(lang.startsWith('nl'))n+=80;
    preferredNames.forEach((x,i)=>{if(name.includes(x))n+=40-i});
    if(v.localService)n+=12;
    return n;
  }
  function refresh(){
    const all=('speechSynthesis'in window)?speechSynthesis.getVoices():[];
    state.voices=all.filter(v=>norm(v.lang).startsWith('nl')).sort((a,b)=>score(b)-score(a));
    state.voice=state.voices[0]||null;
    return state.voice;
  }
  if('speechSynthesis'in window){speechSynthesis.addEventListener?.('voiceschanged',refresh);refresh();setTimeout(refresh,500);setTimeout(refresh,1800)}
  async function capabilities(){
    const voice=refresh();
    const webgpu=!!navigator.gpu;
    const wasm=typeof WebAssembly==='object';
    let cache=false;try{cache=!!window.caches; if(cache){const c=await caches.open('jfm-local-voice-probe');await c.put(new Request(location.origin+'/?jfm-local-probe=1'),new Response('ok'));await c.delete(new Request(location.origin+'/?jfm-local-probe=1'))}}catch{cache=false}
    const report={voice:voice?{name:voice.name,lang:voice.lang,local:!!voice.localService}:null,dutchVoices:state.voices.map(v=>({name:v.name,lang:v.lang,local:!!v.localService})),webgpu,wasm,cache,userAgent:navigator.userAgent};
    state.lastReport=report;return report;
  }
  function speak(text,{jingle=false}={}){
    return new Promise(resolve=>{
      if(!('speechSynthesis'in window))return resolve({ok:false,error:'Web Speech is niet beschikbaar op dit apparaat.'});
      const voice=refresh();if(!voice)return resolve({ok:false,error:'Geen Nederlandse iPhone-stem gevonden. Download eerst een Nederlandse stem in iOS.'});
      speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text||''));u.lang='nl-NL';u.voice=voice;u.rate=jingle?1.03:.96;u.pitch=jingle?1.01:.96;u.volume=1;
      let done=false;const finish=(ok,error='')=>{if(done)return;done=true;resolve({ok,error,voice:voice.name})};u.onend=()=>finish(true);u.onerror=e=>finish(false,e?.error||'De lokale iPhone-stem stopte onverwacht.');
      try{speechSynthesis.speak(u)}catch(e){finish(false,String(e?.message||e))}
      setTimeout(()=>finish(false,'De lokale iPhone-stem gaf binnen 45 seconden geen eindmelding.'),45000);
    });
  }
  window.JFMLocalVoice={refresh,capabilities,speak,get voice(){return refresh()},get voices(){refresh();return [...state.voices]},get report(){return state.lastReport}};
})();