// Legacy compatibility shim.
// The old DJ transition engine used to pause, rewind and restart Spotify itself.
// That duplicated ownership with dj-handoff-v34.js and caused race conditions.
(()=>{
  if(!window.JFMDJTransition){
    window.JFMDJTransition={
      version:'legacy-disabled-v35',
      disabled:true,
      transition:opts=>window.JFMDJHandoff?.runBreak?.(opts?.track||null,!!opts?.manual)??Promise.resolve(false),
      get busy(){return !!window.JFMDJHandoff?.busy}
    };
  }
})();
