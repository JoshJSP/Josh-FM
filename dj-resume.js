// Automatic DJ breaks use the same Spotify recovery route as the rest of Josh FM.
(()=>{
  const original=window.djBreak;if(typeof original!=='function')return;
  window.djBreak=async function(...args){try{return await original.apply(this,args)}finally{try{const s=await api('/me/player').catch(()=>null);if(s?.is_playing)return;if(window.JFMPlayback?.playUri)await window.JFMPlayback.playUri(null);else if(window.jfmPlayUri)await window.jfmPlayUri(null)}catch(e){console.warn('DJ resume',e)}}};
})();