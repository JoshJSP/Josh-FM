// Josh FM DJ-now skip bridge — keeps one audio owner and guarantees the armed break is consumed after a manual Next.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  if(!window.JFMDJTransition){window.JFMDJTransition={version:'legacy-disabled-v225',disabled:true,transition:opts=>window.JFMDJHandoff?.runBreak?.(opts?.track||null,!!opts?.manual)??Promise.resolve(false),get busy(){return !!window.JFMDJHandoff?.busy}}}
  async function consumeAfterSkip(fromId){for(let i=0;i<28;i++){await wait(120+i*18);let s=null;try{s=await api('/me/player')}catch{};if(s?.item?.id&&s.item.id!==fromId&&s.is_playing){await wait(120);return window.JFMDJHandoff?.consumeArmedIfChanged?.(s)}}return false}
  window.addEventListener('click',e=>{if(!e.target?.closest?.('#next'))return;const from=String(window.JFMDJHandoff?.armed||'');if(!from)return;consumeAfterSkip(from).catch(()=>{})},true);
  window.JFMDJNowSkipBridge={version:'v225-deterministic-next',consumeAfterSkip};
})();
