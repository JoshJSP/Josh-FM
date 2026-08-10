// Make DJ breaks behave like radio links: when the DJ is done, music continues immediately.
(()=>{
  const original=window.djBreak;
  if(typeof original!=='function')return;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function forceResume(){
    try{
      // First explicit resume right after the spoken break.
      await api('/me/player/play',{method:'PUT'});
      await sleep(450);

      // Spotify Connect can occasionally ignore the first resume on mobile.
      // Check the actual player state and retry once when needed.
      const state=await api('/me/player');
      if(state && !state.is_playing){
        await api('/me/player/play',{method:'PUT'});
        await sleep(300);
      }
      if(typeof refresh==='function')await refresh().catch(()=>{});
    }catch(e){
      console.warn('Josh FM kon muziek na DJ-break niet direct hervatten:',e);
    }
  }

  window.djBreak=async function(...args){
    try{
      return await original.apply(this,args);
    }finally{
      await forceResume();
    }
  };
})();
