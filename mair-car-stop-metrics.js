// MAIRFM Car Mode — dunne API-laag voor afstand/tijd tot de volgende stop.
// Dit bestand vroeg eerst elke 15 s eigen GPS + Directions aan en schreef de nav-kaart om. Car Mode
// rekent dat nu zelf uit de eigen positie en route (prototypes/mair-car-mode-wave.js), zonder extra Mapbox-aanvragen.
(()=>{
'use strict';
if(window.MAIRCarStopMetrics)return;
const state=()=>{try{return window.MAIRCarModePrototype?.status?.()||null}catch{return null}};
window.MAIRCarStopMetrics={version:'2026-10-16-v5-uit-carmode',refresh:()=>{try{window.MAIRCarModePrototype?.render?.()}catch{}},status:()=>({active:!!state()?.legMetrics,metrics:state()?.legMetrics||null})};
})();
