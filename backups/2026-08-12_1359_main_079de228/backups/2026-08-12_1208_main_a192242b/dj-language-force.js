(()=>{
  const original=window.makeDJScript;
  if(typeof original!=='function')return;
  function selectedLanguage(){
    const mode=document.getElementById('voiceMode')?.value||localStorage.getItem('jfm_voice_mode')||'';
    if(mode==='kokoro'||mode==='device')return'en';
    return (window.JFMDJLanguage||localStorage.getItem('jfm_dj_language')||'en').toLowerCase().startsWith('nl')?'nl':'en';
  }
  window.makeDJScript=makeDJScript=async function(track,fact,weather,manual){
    const lang=selectedLanguage();
    window.JFMDJLanguage=lang;localStorage.setItem('jfm_dj_language',lang);
    // Do not feed Dutch fact copy into an English break. Metadata-based English copy is handled by smart-dj.
    return original(track,lang==='en'?null:fact,weather,manual);
  };
})();
