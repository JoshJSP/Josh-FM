// MAIR runtime bootstrap — progress + rebuilt DJ v2 + unified audio unlock + diagnostics.
(()=>{
  const load=(src,id)=>new Promise(resolve=>{
    if(document.getElementById(id))return resolve(true);
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s);
  });
  async function boot(){
    await load('./progress-clock-v226.js','jfm-progress-v226');
    await load('./mair-spotify-coordinator-v2.js','mair-spotify-coordinator-v2');
    await load('./dj-memory.js','mair-dj-memory-v1');
    await load('./radio-brain.js','mair-radio-brain-v1');
    await load('./dj-context-builder.js','mair-dj-context-builder-v1');
    await load('./dj-quality-gate.js','mair-dj-quality-gate-v1');
    await load('./mair-test-simulator.js','mair-test-simulator-v1');
    await load('./mair-observability.js','mair-observability-v1');
    await load('./mair-dj-v2.js','mair-dj-v2');
    await load('./mair-dj-cadence-fix.js','mair-dj-cadence-fix-v1');
    await load('./mair-audio-unlock-v1.js','mair-audio-unlock-v1');
    await load('./mair-background-guard.js','mair-background-guard-v1');
    await load('./mair-voice-check.js','mair-voice-check-v1');
    await load('./mair-diagnostics-hub.js','mair-diagnostics-hub-v1');
    await load('./mair-test-lab.js','mair-test-lab-v1');
    setTimeout(()=>load('./beta-status.js','jfm-beta-status-v8'),2600);
  }
  boot();
  window.JFMV226Bootstrap={version:'mair-test-lab-correlated-diagnostics-bootstrap',get ready(){return !!(window.MAIRDJ&&window.MAIRObservability&&window.MAIRTestSimulator&&window.MAIRTestLab&&window.JFMProgressClock&&window.MAIRAudioUnlock&&window.MAIRBackgroundGuard&&window.MAIRSpotifyCoordinator)}};
})();
