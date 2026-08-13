(()=>{
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
    const failures=Number(playback.failures||0),stalls=Number(radio.stalls||0);
    return{version:'build8',ready:missing.length===0&&failures<5&&stalls<2,modules,missing,failures,stalls,recoveries:Number(playback.recoveries||0),at:Date.now()};
  }
  window.JFMBetaStatus={version:'build8',snapshot,get status(){return snapshot()}};
})();
