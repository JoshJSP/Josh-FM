(()=>{
  const info=document.getElementById('voiceInfo');
  const test=document.getElementById('testVoice');
  const voiceSelect=document.getElementById('voiceMode');
  const HOSTS=['am_michael','af_heart','bm_george','bf_emma','am_fenrir','am_puck'];
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let worker=null,seq=0,pending=new Map(),ready=false,lastError='';

  const lang=()=>window.JFMDJLanguage||localStorage.getItem('jfm_dj_language')||'en';
  const host=()=>window.JFMCurrentDJHost?.().voice||HOSTS[Math.floor(new Date().getHours()/2)%HOSTS.length];

  function progress(p,label){
    const fill=document.getElementById('voiceProgressFill'),text=document.getElementById('voiceProgressLabel'),wrap=fill?.parentElement?.parentElement;
    if(wrap)wrap.style.display='block';
    if(fill)fill.style.width=Math.max(0,Math.min(100,p))+'%';
    if(text)text.textContent=label;
  }

  function terminate(reason=''){
    try{worker?.terminate()}catch{}
    worker=null;ready=false;
    for(const [,x] of pending){clearTimeout(x.timer);x.reject(new Error(reason||'Kokoro worker stopped'))}
    pending.clear();
    if(reason)lastError=reason;
  }

  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker('./kokoro-worker.js?v=3',{type:'module'});
    worker.onmessage=e=>{
      const m=e.data||{},x=pending.get(m.id);if(!x)return;
      clearTimeout(x.timer);pending.delete(m.id);
      if(m.ok)x.resolve(m);else x.reject(new Error(m.error||'Kokoro worker error'));
    };
    worker.onerror=e=>terminate('Kokoro worker error: '+(e.message||'unknown'));
    return worker;
  }

  function ask(type,payload={},timeout=30000){
    const w=ensureWorker(),id=++seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);terminate(`${type} timed out after ${Math.round(timeout/1000)} seconds`);reject(new Error(lastError))},timeout);
      pending.set(id,{resolve,reject,timer});
      w.postMessage({id,type,...payload});
    });
  }

  function chunks(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(clean.length<=90)return [clean];
    const sentences=clean.match(/[^.!?]+[.!?]?/g)||[clean];
    const out=[];let cur='';
    for(const s0 of sentences){const s=s0.trim();if(!s)continue;if((cur+' '+s).trim().length<=90){cur=(cur+' '+s).trim();continue}if(cur)out.push(cur);if(s.length<=90){cur=s;continue}const words=s.split(' ');cur='';for(const w of words){if((cur+' '+w).trim().length>90){if(cur)out.push(cur);cur=w}else cur=(cur+' '+w).trim()}}
    if(cur)out.push(cur);return out.filter(Boolean);
  }

  async function load(){
    if(ready)return true;
    progress(15,'Kokoro q4-model laden…');
    const r=await ask('load',{},isIOS?70000:90000);
    ready=!!r.ok;
    progress(70,`Stemmodel geladen · ${host()}`);
    return ready;
  }

  async function playArrayBuffer(buffer,mime='audio/wav'){
    const ctx=window.JFMDJAudio?.context;
    if(!ctx)throw new Error('AudioContext niet beschikbaar');
    try{await window.JFMDJAudio?.unlock?.()}catch{}
    if(ctx.state==='suspended')await ctx.resume();
    const decoded=await ctx.decodeAudioData(buffer.slice(0));
    const src=ctx.createBufferSource();src.buffer=decoded;src.connect(ctx.destination);
    await new Promise((resolve,reject)=>{src.onended=resolve;try{src.start(0)}catch(e){reject(e)}});
    return true;
  }

  async function speakDevice(text,jingle=false){
    if(!('speechSynthesis' in window))return false;
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang=lang()==='nl'?'nl-NL':'en-US';u.rate=jingle?1.03:.97;u.pitch=jingle?1:.94;u.volume=1;
    const voices=speechSynthesis.getVoices();
    const names=lang()==='nl'?['Xander','Claire']:['Samantha','Daniel','Karen','Moira','Tessa','Alex'];
    u.voice=names.map(n=>voices.find(v=>v.name===n)).find(Boolean)||voices.find(v=>v.lang?.toLowerCase().startsWith(lang()==='nl'?'nl':'en'))||null;
    if(info)info.textContent=`iPhone fallback — ${u.voice?.name||u.lang} ✓`;
    return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};u.onend=()=>finish(true);u.onerror=()=>finish(false);speechSynthesis.speak(u);setTimeout(()=>finish(false),25000)});
  }

  async function producedJingle(){
    if(lang()!=='en')return false;
    try{
      const id=1+Math.floor(Math.random()*10);
      const r=await Promise.race([fetch(`/api/jingle?id=${id}`,{cache:'force-cache'}),new Promise((_,rej)=>setTimeout(()=>rej(new Error('jingle timeout')),4500))]);
      if(!r.ok)return false;
      const b=await r.arrayBuffer();if(!b.byteLength)return false;
      return playArrayBuffer(b,r.headers.get('content-type')||'audio/mpeg');
    }catch{return false}
  }

  async function speakKokoro(text,jingle=false){
    if(lang()!=='en')return false;
    try{
      await load();
      const parts=chunks(text);const voice=host();
      for(let i=0;i<parts.length;i++){
        progress(74+Math.round((i/Math.max(1,parts.length))*20),`DJ ${voice} maakt deel ${i+1}/${parts.length}…`);
        if(info)info.textContent=`Kokoro q4 generating ${voice} · ${i+1}/${parts.length}`;
        const r=await ask('generate',{text:parts[i],voice,speed:jingle?1.04:1.0},isIOS?18000:30000);
        await playArrayBuffer(r.buffer,r.mime);
      }
      progress(100,`Stem werkt ✓ · ${voice}`);
      if(info)info.textContent=`Josh FM DJ — ${voice} · Kokoro q4 ✓`;
      return true;
    }catch(e){
      lastError=String(e?.message||e);
      if(info)info.textContent=`Kokoro gestopt: ${lastError}. iPhone-stem wordt gebruikt.`;
      progress(92,'Kokoro reageert niet — iPhone fallback…');
      return false;
    }
  }

  window.prepareSpeech=async function(text,jingle=false){
    if(jingle&&lang()==='en')return true;
    if((voiceSelect?.value||localStorage.getItem('jfm_voice_mode'))!=='kokoro')return false;
    try{return await load()}catch{return false}
  };

  window.speakText=async function(text,jingle=false){
    try{await window.JFMDJAudio?.unlock?.()}catch{}
    if(jingle&&lang()==='en'&&await producedJingle())return true;
    const mode=voiceSelect?.value||localStorage.getItem('jfm_voice_mode')||'kokoro';
    if(mode==='kokoro'&&await speakKokoro(text,jingle))return true;
    return speakDevice(text,jingle);
  };

  if(test)test.onclick=async()=>{
    test.disabled=true;progress(5,'Stemtest starten…');
    const text=lang()==='nl'?'Dit is Josh FM.':`This is Josh FM. ${host()} is on air.`;
    let ok=false;
    try{ok=await window.speakText(text,false);progress(100,ok?(ready?'Kokoro stemtest voltooid ✓':'Fallback-stem werkt ✓'):'Stemtest mislukt')}catch(e){progress(100,'Stemtest mislukt');if(info)info.textContent=String(e?.message||e)}finally{test.disabled=false}
    return ok;
  };

  window.JFMKokoroWorker={load,terminate,get ready(){return ready},get error(){return lastError},host};
})();
