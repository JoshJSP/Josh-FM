// MAIR DJ compatibility shim.
// DJ v3 uses the central Fish Audio engine only; no second iOS audio wrapper is loaded here.
(()=>{
  window.JFMDJResume={version:'single-voice-route-v3',owner:'mair-dj-v2.js',duplicateIOSBridge:false};
})();
