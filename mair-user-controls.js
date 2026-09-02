// MAIR user controls — Settings owns only persistent user preferences, not Sleep or diagnostics.
(()=>{
'use strict';
if(window.MAIRUserControls)return;
const $=id=>document.getElementById(id),CAR='jfm_car_mode',OLD_CAR='mair_car_mode_v1';
function isCar(){return false}
// Car Mode is de overlay op de Radio-tab (prototypes/mair-car-mode-wave.js). De oude
// globale schakelaar hoorde bij de tweede Car Mode uit runtime-modes.js en is weg.
// setCar blijft als no-op bestaan voor oude aanroepers en ruimt de oude vlag op.
function setCar(){try{localStorage.removeItem(CAR);localStorage.removeItem(OLD_CAR)}catch{};document.body.classList.remove('mair-car-mode','jfm-car-mode');return false}
function purgeLegacyUi(){['jfmRuntimeModes','jfmSleepCard','mairAdvancedDiagnostics'].forEach(id=>$(id)?.remove());const card=$('mairUserControlsCard');if(card){card.querySelector('.mair-sleep-head')?.remove();card.querySelector('.mair-sleep-options')?.remove()}}
function inject(){const pane=$('tab-settings');if(!pane)return;purgeLegacyUi();let card=$('mairUserControlsCard');if(!card){card=document.createElement('article');card.id='mairUserControlsCard';card.className='card mair-settings-card mair-user-controls';card.innerHTML='<div class="kicker">GEBRUIK</div><h3>Luisteren</h3><p class="muted">Car Mode open je met de knop op de Radio-tab.</p>';const version=pane.querySelector('.versionbox');pane.insertBefore(card,version||null);if(version)pane.appendChild(version)}}
function boot(){setCar();inject();window.addEventListener('pageshow',()=>{setCar();purgeLegacyUi();inject()});window.MAIRUserControls={version:'mair-user-controls-v1.5-settings-only',setCar,purgeLegacyUi,get carMode(){return isCar()}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
