// MAIR runtime bootstrap.
//
// Dit bestand laadde vroeger de DJ en de runtime-kritische modules door elkaar in
// een enkele keten. Ze staan nu bewust in twee aparte functies: loadRuntime()
// draait altijd, loadDJ() alleen als window.MAIR_DJ_ENABLED true is (zie
// brand-config.js). Zonder DJ blijven de progress clock, radio brain,
// observability, audio unlock, background guard, diagnostics en test lab dus
// gewoon laden en werken.
//
// De aanroepen staan bewust als losse load('./bestand.js','id')-regels en niet in
// een array: de predeploy-gate car-mode-cache-boot-check.mjs loopt de bootgraaf
// statisch door om te bewijzen dat elk geladen bestand ook in de service-worker
// CORE-lijst staat. Een array met variabelen zou die controle blind maken.
(()=>{
  const load=(src,id)=>new Promise(resolve=>{
    if(document.getElementById(id))return resolve(true);
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s);
  });

  // Altijd laden. Niets hiervan hangt af van window.MAIRDJ.
  async function loadRuntime(){
    await load('./progress-clock-v226.js','jfm-progress-v226');
    await load('./radio-brain.js','mair-radio-brain-v1');
    await load('./mair-test-simulator.js','mair-test-simulator-v1');
    await load('./mair-observability.js','mair-observability-v1');
    await load('./mair-audio-unlock-v1.js','mair-audio-unlock-v1');
    await load('./mair-background-guard.js','mair-background-guard-v1');
    await load('./mair-diagnostics-hub.js','mair-diagnostics-hub-v1');
    await load('./mair-test-lab.js','mair-test-lab-v1');
  }

  // Alleen met de DJ aan. mair-dj-v2.js is de enige scheduler; zonder dat bestand
  // bestaat window.MAIRDJ niet en kan er geen break worden ingepland of uitgezonden.
  // De ondersteunende modules zijn inert zonder orchestrator, maar worden hier toch
  // meegeschakeld zodat een uitgeschakelde DJ ook geen werk doet.
  async function loadDJ(){
    await load('./dj-memory.js','mair-dj-memory-v1');
    await load('./dj-context-builder.js','mair-dj-context-builder-v1');
    await load('./dj-quality-gate.js','mair-dj-quality-gate-v1');
    await load('./mair-dj-v2.js','mair-dj-v2');
    await load('./mair-dj-cadence-fix.js','mair-dj-cadence-fix-v1');
    await load('./mair-voice-check.js','mair-voice-check-v1');
  }

  // Met de DJ uit: de opruimlaag verbergt elke zichtbare DJ-bediening en zet de
  // praatinstellingen uit. speakText blijft intact voor de startjingle.
  async function loadDJOff(){
    await load('./mair-public-dj-off.js','mair-public-dj-off-v1');
  }

  async function boot(){
    await loadRuntime();
    if(window.MAIR_DJ_ENABLED===true)await loadDJ();
    else await loadDJOff();
    setTimeout(()=>load('./beta-status.js','jfm-beta-status-v8'),2600);
  }
  boot();

  window.JFMV226Bootstrap={
    version:'mair-runtime-bootstrap-v2-dj-flagged',
    get djEnabled(){return window.MAIR_DJ_ENABLED===true},
    // 'ready' beschrijft alleen de runtime-kritische laag. De DJ telt hier bewust
    // niet in mee, anders zou een uitgeschakelde DJ als storing worden gelezen.
    get ready(){return !!(window.MAIRObservability&&window.MAIRTestSimulator&&window.MAIRTestLab&&window.JFMProgressClock&&window.MAIRAudioUnlock&&window.MAIRBackgroundGuard)},
    get djReady(){return !!window.MAIRDJ}
  };
})();
