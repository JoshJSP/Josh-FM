// Legacy compatibility shim. MAIR DJ v2 owns scheduling, pre-generation, voice playback and Spotify handoff.
(()=>{
  const run=async(...args)=>{
    if(window.MAIRDJ?.air)return window.MAIRDJ.air(...args);
    return false;
  };
  window.JFMDJTransition={version:'legacy-shim-to-mair-dj-v2',transition:()=>run(),get busy(){return !!window.MAIRDJ?.diagnostics?.().busy}};
  window.JFMDJHandoff={version:'legacy-shim-to-mair-dj-v2',runBreak:()=>run(),get busy(){return !!window.MAIRDJ?.diagnostics?.().busy},get lastFailure(){return window.MAIRDJ?.diagnostics?.().error||''}};
})();
