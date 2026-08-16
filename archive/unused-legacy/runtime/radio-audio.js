// Josh FM radio-style audio handoff: automatic DJ breaks duck music instead of pausing it.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function volume(v){try{const p=window.jfmSpotifyPlayer;if(p?.setVolume){await p.setVolume(v);return true}}catch{}return false}
  async function alive(){try{const p=window.jfmSpotifyPlayer;if(!p)return;const s=await p.getCurrentState();if(s?.paused)await p.resume()}catch{}}
  window.djBreak=djBreak=async function(track=null,manual=false){
    if(djBusy)return;djBusy=true;
    try{
      const target=track||(playback?.item?trackObj(playback.item):null);
      const [fact,weather]=await Promise.all([getFact(target),getWeather()]);
      const text=await makeDJScript(target,fact,weather,manual);
      const el=document.getElementById('djText');if(el)el.textContent=text;
      document.getElementById('factSource')?.classList.add('hidden');
      await volume(.12);await wait(50);
      if(document.getElementById('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch{}}
      await speakText(text,false);
      await wait(60);await volume(1);await alive();
    }catch(e){console.warn('Josh FM DJ break',e);try{await volume(1);await alive()}catch{}}
    finally{djBusy=false}
  };
})();