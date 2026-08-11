// Josh FM — Safari/iOS Fish Audio playback bridge.
// Keeps Fish as the only DJ voice, while using a reusable media element that is primed by a real user gesture.
(()=>{
  const isiOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  if(!isiOS)return;

  const audio=new Audio();
  audio.preload='auto';
  audio.playsInline=true;
  audio.setAttribute('playsinline','');
  audio.volume=1;
  let primed=false,busy=false,lastError='',lastSuccessAt=0,lastMode='';
  const SILENT='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACA';

  async function prime(){
    try{
      if(primed)return true;
      audio.src=SILENT;
      audio.currentTime=0;
      const p=audio.play();
      if(p?.then)await p;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      primed=true;
      window.dispatchEvent(new CustomEvent('jfm:dj-audio-unlocked',{detail:{mode:'html-audio'}}));
      return true;
    }catch(e){lastError=String(e?.message||e);return false}
  }

  document.addEventListener('pointerdown',prime,{capture:true,passive:true});
  document.addEventListener('touchstart',prime,{capture:true,passive:true});
  document.addEventListener('click',prime,{capture:true,passive:true});

  async function playBlob(blob){
    if(!blob?.size)throw new Error('Fish Audio returned empty audio');
    const url=URL.createObjectURL(blob);
    try{
      audio.pause();
      audio.src=url;
      audio.currentTime=0;
      audio.volume=1;
      await audio.play();
      await new Promise((resolve,reject)=>{
        let done=false;
        const finish=(err)=>{if(done)return;done=true;audio.onended=null;audio.onerror=null;err?reject(err):resolve()};
        audio.onended=()=>finish();
        audio.onerror=()=>finish(new Error('Safari could not play Fish Audio'));
        setTimeout(()=>finish(new Error('Fish Audio playback timed out')),45000);
      });
      lastMode='html-audio';lastSuccessAt=Date.now();lastError='';return true;
    }finally{
      audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);
    }
  }

  const original=window.speakText;
  if(typeof original!=='function')return;
  window.speakText=async function(text,jingle=false){
    const mode=document.getElementById('voiceMode')?.value||localStorage.getItem('jfm_voice_mode')||'fish';
    if(mode!=='fish')return original(text,jingle);
    if(busy)return false;
    busy=true;
    try{
      await prime().catch(()=>false);
      // Reuse the existing Fish generator/cache. This does not introduce any device/Samantha voice fallback.
      const pack=await window.JFMDJAudio?.prepare?.(String(text||''),!!jingle);
      if(pack?.blob){
        try{return await playBlob(pack.blob)}catch(e){lastError=String(e?.message||e)}
      }
      // If Safari's media element path fails, let the existing Web Audio path consume the same prepared cache.
      const ok=await original(text,jingle);
      if(ok){lastMode='web-audio-fallback';lastSuccessAt=Date.now();lastError='';return true}
      if(!lastError)lastError='Fish Audio was generated but could not be played';
      return false;
    }catch(e){lastError=String(e?.message||e);return false}
    finally{
      busy=false;
      try{window.dispatchEvent(new CustomEvent('jfm:dj-audio-health',{detail:{ok:!lastError,stage:'ios-playback',error:lastError||'',mode:lastMode}}))}catch{}
    }
  };

  window.JFMIOSDJAudio={version:'ios-fish-playback-v1',prime,get state(){return{primed,busy,lastError,lastSuccessAt,lastMode}}};
})();
