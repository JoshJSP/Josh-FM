// MAIRFM Sleep: liggende layout van ontwerp 3 zit in mair-sleep.js. Dit bestand houdt alleen de statusknop voor de
// diagnostiek in leven (mair-car-sleep-integration.js leest MAIRSleepLandscapePrototype.status()).
(()=>{
'use strict';
if(window.MAIRSleepLandscapePrototype)return;
const media=window.matchMedia('(orientation: landscape) and (max-height:500px)');
const status=()=>({version:'sleep-design3-2026-10-17',matches:media.matches,applied:media.matches,sleepAvailable:!!window.MAIRSleep,overlayAvailable:!!document.getElementById('mairSleepOverlay')});
window.MAIRSleepLandscapePrototype={version:'sleep-design3-2026-10-17',enable:status,disable:status,sync:()=>media.matches,status};
})();
