// DJ NU queues a manual break for the end of the current track instead of interrupting immediately.
(()=>{
  const btn=document.getElementById('djNow');
  if(!btn)return;
  let armedForId=null;
  let armedTrack=null;
  const setState=armed=>{
    btn.dataset.queued=armed?'1':'0';
    const b=btn.querySelector('b'),s=btn.querySelector('span');
    if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';
    if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen';
  };
  btn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(!playback?.item?.id||djBusy)return;
    if(armedForId===playback.item.id){armedForId=null;armedTrack=null;setState(false);return}
    armedForId=playback.item.id;
    armedTrack=trackObj(playback.item);
    setState(true);
  },true);

  let seenId=playback?.item?.id||null;
  setInterval(async()=>{
    const currentId=playback?.item?.id||null;
    if(!currentId){seenId=currentId;return}
    if(seenId&&currentId!==seenId&&armedForId===seenId){
      const ended=armedTrack;
      armedForId=null;armedTrack=null;setState(false);
      try{
        tracksSinceTalk=0;
        if(typeof scheduleTalk==='function')scheduleTalk();
        await djBreak(ended,true);
      }catch(e){console.warn('Queued DJ break failed',e)}
    }
    seenId=currentId;
  },700);
})();