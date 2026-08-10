const voiceSelect=document.getElementById('voiceMode');
if(voiceSelect){
  const previous=voiceSelect.value||'auto';
  voiceSelect.innerHTML=`
    <option value="auto">Automatisch — ElevenLabs eerst</option>
    <option value="elevenlabs">ElevenLabs — radio DJ</option>
    <option value="openai">OpenAI — AI-stem</option>
    <option value="device">iPhone-stem</option>`;
  voiceSelect.value=['auto','elevenlabs','openai','device'].includes(previous)?previous:'auto';
}

async function playAudioResponse(response,label,info){
  const contentType=response.headers.get('content-type')||'';
  if(!response.ok||!contentType.includes('audio')) return false;
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const audio=new Audio(url);
  if(info) info.textContent=`${label} actief ✓`;
  await audio.play();
  await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve});
  URL.revokeObjectURL(url);
  return true;
}

async function providerError(response){
  let message=`HTTP ${response.status}`;
  try{
    const d=await response.json();
    let detail=d.detail||'';
    if(typeof detail==='string'&&detail.length>220) detail=detail.slice(0,220)+'…';
    message=[d.error,detail,d.code].filter(Boolean).join(' · ')||message;
  }catch{}
  return message;
}

async function tryElevenLabs(text,jingle,info){
  if(info) info.textContent='ElevenLabs-stem wordt geladen…';
  try{
    const r=await fetch('/api/tts-elevenlabs',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,jingle})
    });
    if(await playAudioResponse(r,'ElevenLabs',info)) return {ok:true};
    return {ok:false,error:await providerError(r)};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}

async function tryOpenAI(text,jingle,info){
  if(info) info.textContent='OpenAI-stem wordt geladen…';
  try{
    const r=await fetch('/api/tts',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,jingle})
    });
    if(await playAudioResponse(r,'OpenAI',info)) return {ok:true};
    return {ok:false,error:await providerError(r)};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}

async function speakDevice(text,jingle,info){
  if(info) info.textContent='Nederlandse iPhone-stem actief';
  await new Promise(resolve=>{
    if(!('speechSynthesis' in window)) return resolve();
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='nl-NL';u.rate=jingle?1.03:.96;u.pitch=jingle?1.02:.94;
    const voices=speechSynthesis.getVoices();
    const v=voices.find(x=>x.lang?.toLowerCase()==='nl-nl')||voices.find(x=>x.lang?.toLowerCase().startsWith('nl'))||null;
    if(v)u.voice=v;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);
  });
}

window.speakText=async function(text,jingle=false){
  const mode=document.getElementById('voiceMode')?.value||'auto';
  const info=document.getElementById('voiceInfo');
  const errors=[];

  if(mode==='auto'||mode==='elevenlabs'){
    const result=await tryElevenLabs(text,jingle,info);
    if(result.ok)return;
    errors.push('ElevenLabs: '+result.error);
    if(mode==='elevenlabs'){
      if(info)info.textContent='ElevenLabs fout: '+result.error;
      return;
    }
  }

  if(mode==='auto'||mode==='openai'){
    const result=await tryOpenAI(text,jingle,info);
    if(result.ok)return;
    errors.push('OpenAI: '+result.error);
    if(mode==='openai'){
      if(info)info.textContent='OpenAI fout: '+result.error;
      return;
    }
  }

  if(mode==='device') return speakDevice(text,jingle,info);

  if(info)info.textContent='AI-stemmen niet beschikbaar; iPhone-fallback. '+errors.join(' | ');
  return speakDevice(text,jingle,info);
};

const testButton=document.getElementById('testVoice');
if(testButton){
  testButton.onclick=()=>window.speakText('Dit is Josh FM. Je luistert naar jouw persoonlijke Nederlandse radioshow.');
}
