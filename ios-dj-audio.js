// Josh FM — Safari/iOS Fish Audio playback bridge.
// Keeps Fish as the only DJ voice, while using a reusable media element primed by a real user gesture.
(()=>{
  const isiOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  if(!isiOS)return;
  const audio=new Audio();audio.preload='auto';audio.playsInline=true;audio.setAttribute('playsinline','');audio.volume=1;
  let primed=false,busy=false,lastError='',lastSuccessAt=0,lastMode='',lastStartedAt=0,lastEndedAt=0,lastBytes=0;
  const log=[];const SILENT='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACA';
  const trace=(stage,extra={})=>{log.unshift({at:Date.now(),stage,...extra});if(log.length>40)log.length=40;try{window.dispatchEvent(new CustomEvent('jfm:dj-audio-playback',{detail:{stage,...extra}}))}catch{}};
  async function prime(){try{if(primed)return true;audio.src=SILENT;audio.currentTime=0;const p=audio.play();if(p?.then)await p;audio.pause();audio.removeAttribute('src');audio.load();primed=true;trace('primed');return true}catch(e){lastError=String(e?.message||e);trace('prime-failed',{error:lastError});return false}}
  ['pointerdown','touchstart','click'].forEach(name=>document.addEventListener(name,prime,{capture:true,passive:true}));
  async function playBlob(blob){
    if(!blob?.size)throw new Error('Fish Audio returned empty audio');lastBytes=blob.size;const url=URL.createObjectURL(blob);
    try{audio.pause();audio.src=url;audio.currentTime=0;audio.volume=1;audio.muted=false;audio.load();trace('play-request',{bytes:lastBytes});await audio.play();lastStartedAt=Date.now();trace('play-started',{bytes:lastBytes});await new Promise((resolve,reject)=>{let done=false,timer;const finish=err=>{if(done)return;done=true;clearTimeout(timer);audio.onended=null;audio.onerror=null;err?reject(err):resolve()};audio.onended=()=>finish();audio.onerror=()=>finish(new Error('Safari could not play Fish Audio'));timer=setTimeout(()=>finish(new Error('Fish Audio playback timed out')),45000)});lastEndedAt=Date.now();lastMode='html-audio';lastSuccessAt=lastEndedAt;lastError='';trace('play-ended',{bytes:lastBytes});return true}
    finally{audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
  }
  const original=window.speakText;if(typeof original!=='function')return;
  window.speakText=async function(text,jingle=false){
    const mode=document.getElementById('voiceMode')?.value||localStorage.getItem('jfm_voice_mode')||'fish';if(mode!=='fish')return original(text,jingle);if(busy){trace('busy-skip');return false}busy=true;
    try{await prime().catch(()=>false);const pack=await window.JFMDJAudio?.prepare?.(String(text||''),!!jingle);if(pack?.blob){try{return await playBlob(pack.blob)}catch(e){lastError=String(e?.message||e);trace('html-audio-failed',{error:lastError})}}const ok=await original(text,jingle);if(ok){lastMode='web-audio-fallback';lastSuccessAt=Date.now();lastError='';trace('web-audio-success');return true}if(!lastError)lastError='Fish Audio was generated but could not be played';trace('all-playback-failed',{error:lastError});return false}catch(e){lastError=String(e?.message||e);trace('playback-exception',{error:lastError});return false}finally{busy=false;try{window.dispatchEvent(new CustomEvent('jfm:dj-audio-health',{detail:{ok:!lastError,stage:'ios-playback',error:lastError||'',mode:lastMode}}))}catch{}}
  };
  window.JFMIOSDJAudio={version:'ios-fish-playback-v2-diagnostics',prime,log:()=>[...log],get state(){return{primed,busy,lastError,lastSuccessAt,lastMode,lastStartedAt,lastEndedAt,lastBytes}}};
})();
