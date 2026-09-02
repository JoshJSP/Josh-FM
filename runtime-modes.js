// MAIR runtime modes — compatibiliteitslaag, geen eigen UI meer.
//
// Dit bestand bouwde een tweede, volledige Car Mode: een fullscreen sectie #jfmCarView
// met eigen transportknoppen, die bij elke boot in de DOM werd gezet en aan te zetten was
// via een schakelaar in Instellingen. Daarnaast bestond de echte Car Mode al
// (prototypes/mair-car-mode-wave.js, de knop op de Radio-tab). Twee Car Modes die elkaar
// niet kenden, met een knop "Volgende DJ-break overslaan" die naar een element wees dat
// niet bestaat, in een app waar de DJ uit staat.
//
// De view, de schakelaar en de bijbehorende CSS zijn verwijderd. Wat blijft is de kleine
// API die andere modules echt gebruiken:
//   integration-guards.js -> state().data, state().battery, dataBudget()
//   live-ui.js            -> shouldRunNonCritical(), batteryBudget()
// Die modi (data saver, battery, night) waren al eerder uitgezet; deze laag geeft daarom
// vaste, ruime waarden terug in plaats van te doen alsof er nog iets te kiezen valt.
(()=>{
  const KEY='jfm_car_mode',OLD='mair_car_mode_v1';
  // Oude toestand opruimen: anders blijft een toestel met jfm_car_mode='1' uit een
  // vorige versie de body-klassen dragen zonder dat er nog iets bij hoort.
  try{localStorage.removeItem(KEY);localStorage.removeItem(OLD)}catch{}
  try{document.body?.classList.remove('jfm-car-mode','mair-car-mode')}catch{}
  try{document.getElementById('jfmCarView')?.remove()}catch{}

  const state=()=>({car:false,data:false,battery:false,night:false,nightAuto:false,nightEffective:false});
  const api={
    version:'runtime-modes-v4-compat-only',
    state,
    // set() bestaat nog omdat oude aanroepers hem verwachten, maar er valt niets meer te
    // zetten: Car Mode is de overlay op de Radio-tab en heeft geen globale schakelaar.
    set:()=>false,
    apply:()=>true,
    shouldRunNonCritical:()=>true,
    dataBudget:()=>({artwork:true,prefetch:true,discoveryRefreshMs:15*60*1000,maxDiscoveryPercent:100}),
    batteryBudget:()=>({uiIntervalMs:2500,background:true,animations:true})
  };
  window.JFMRuntimeModes=api;
  window.MAIRCarMode=api;
})();
