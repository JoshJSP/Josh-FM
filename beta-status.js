(()=>{
  const RECENT_WINDOW_MS=10*60*1000;
  function snapshot(){
    const modules={
      playback:!!window.JFMPlayback,
      state:!!window.JFMPlaybackState,
      dj:!!window.JFMDJAuthoritative,
      djQuality:!!window.JFMDJQuality,
      music:!!window.JFMMusicIntelligence,
      taste:!!window.JFMTasteModel,
      model:!!window.JFMProductModel,
      ux:!!window.JFMProductUX,
      pwa:!!window.JFMPWA,
      health:!!window.JFMRadioCoreHealth
    };
    const missing=Object.keys(modules).filter(k=>!modules[k]);
    const playback=window.JFMPlayback?.health||{};
    const radio=window.JFMRadioCoreHealth?.state||{};
    const truth=window.JFMPlaybackState?.get?.()||{};
    const failures=Number(playback.failures||0),stalls=Number(radio.stalls||0);
    const now=Date.now();
    const recentEvents=window.JFMRadioCoreHealth?.events?.()||[];
    const recentStalls=recentEvents.filter(e=>e?.type==='playback-stall'&&now-Number(e?.at||0)<RECENT_WINDOW_MS).length;
    const currentError=String(truth.lastError||'').trim();
    const telemetry={failureBudget:failures<5,stallBudget:stalls<2};
    const moduleGate={ready:missing.length===0};
    const ready=moduleGate.ready&&!currentError&&recentStalls<2;
    return{version:'build8.1-recoverable-health',ready,modules,missing,failures,stalls,recentStalls,currentError,moduleGate,telemetry,recoveries:Number(playback.recoveries||0),at:now};
  }
  window.JFMBetaStatus={version:'build8.1-recoverable-health',snapshot,get status(){return snapshot()}};
})();
