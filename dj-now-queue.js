// Josh FM DJ-now skip bridge — guarantees the armed break is consumed after a manual Next.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  if(!window.JFMDJTransition){window.JFMDJTransition={version:'legacy-disabled-v225',disabled:true,transition:opts=>window.JFMDJHandoff?.runBreak?.(opts?.track||null,!!opts?.manual)??Promise.resolve(false),get busy(){return !!window.JFMDJHandoff?.busy}}}
  async function consumeAfterSkip(fromId){for(let i=0;i<28;i++){await wait(120+i*18);let s=null;try{s=await api('/me/player')}catch{};if(s?.item?.id&&s.item.id!==fromId&&s.is_playing){await wait(120);return window.JFMDJHandoff?.consumeArmedIfChanged?.(s)}}return false}
  window.addEventListener('click',e=>{if(!e.target?.closest?.('#next'))return;const from=String(window.JFMDJHandoff?.armed||'');if(!from)return;consumeAfterSkip(from).catch(()=>{})},true);
  function radioManualCopy(){if(typeof window.makeDJScript!=='function'||window.makeDJScript.__radio225)return;const old=window.makeDJScript;const wrapped=async function(track,fact,weather,manual){if(manual&&track){const a=(track.artists||[]).join(' and '),n=track.name||'';if(a&&n)return `On Josh FM, ${a} with ${n}. Let’s take this one from the top.`}return old(track,fact,weather,manual)};wrapped.__radio225=true;window.makeDJScript=makeDJScript=wrapped}
  radioManualCopy();setTimeout(radioManualCopy,600);setTimeout(radioManualCopy,1600);
  window.JFMDJNowSkipBridge={version:'v225-deterministic-next-radio',consumeAfterSkip};
})();
