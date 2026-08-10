window.speakText = async function(text,jingle=false){
  const mode=document.getElementById('voiceMode')?.value||'auto';
  const info=document.getElementById('voiceInfo');

  if(mode!=='device'){
    try{
      if(info) info.textContent='AI-stem wordt getest…';
      const r=await fetch('/api/tts',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,jingle})
      });

      const contentType=r.headers.get('content-type')||'';
      if(r.ok&&contentType.includes('audio')){
        const blob=await r.blob();
        const url=URL.createObjectURL(blob);
        const audio=new Audio(url);
        if(info) info.textContent='AI-stem actief ✓';
        await audio.play();
        await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve});
        URL.revokeObjectURL(url);
        return;
      }

      let message=`HTTP ${r.status}`;
      try{
        const d=await r.json();
        message=[d.error,d.detail,d.model?`model: ${d.model}`:'',d.voice?`stem: ${d.voice}`:''].filter(Boolean).join(' · ');
      }catch{}
      if(info) info.textContent='AI-stem fout: '+message;
      if(mode==='openai') return;
    }catch(e){
      if(info) info.textContent='AI-stem verbindingsfout: '+String(e?.message||e);
      if(mode==='openai') return;
    }
  }

  await new Promise(resolve=>{
    if(!('speechSynthesis' in window)) return resolve();
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='nl-NL';
    u.rate=jingle?1.03:.96;
    u.pitch=jingle?1.02:.94;
    const voices=speechSynthesis.getVoices();
    const v=voices.find(x=>x.lang?.toLowerCase()==='nl-nl')||voices.find(x=>x.lang?.toLowerCase().startsWith('nl'))||null;
    if(v) u.voice=v;
    u.onend=resolve;u.onerror=resolve;
    speechSynthesis.speak(u);
  });
};

const testButton=document.getElementById('testVoice');
if(testButton){
  testButton.onclick=()=>window.speakText('Dit is Josh FM. Je luistert naar jouw persoonlijke Nederlandse radioshow.');
}
