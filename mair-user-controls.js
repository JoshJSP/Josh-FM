// MAIR user controls — Settings owns only persistent user preferences, not Sleep or diagnostics.
(()=>{
'use strict';
if(window.MAIRUserControls)return;
const $=id=>document.getElementById(id),CAR='jfm_car_mode',OLD_CAR='mair_car_mode_v1';
function isCar(){return localStorage.getItem(CAR)==='1'||localStorage.getItem(OLD_CAR)==='1'}
function setCar(on){localStorage.setItem(CAR,on?'1':'0');localStorage.removeItem(OLD_CAR);document.body.classList.toggle('mair-car-mode',!!on);document.body.classList.toggle('jfm-car-mode',!!on);try{window.JFMRuntimeModes?.set?.('car',!!on)}catch{}const input=$('mairCarMode');if(input)input.checked=!!on}
function purgeLegacyUi(){['jfmRuntimeModes','jfmSleepCard','mairAdvancedDiagnostics'].forEach(id=>$(id)?.remove());const card=$('mairUserControlsCard');if(card){card.querySelector('.mair-sleep-head')?.remove();card.querySelector('.mair-sleep-options')?.remove()}}
function inject(){const pane=$('tab-settings');if(!pane)return;purgeLegacyUi();let card=$('mairUserControlsCard');if(!card){card=document.createElement('article');card.id='mairUserControlsCard';card.className='card mair-settings-card mair-user-controls';card.innerHTML='<div class="kicker">GEBRUIK</div><h3>Luisteren</h3><label class="switch"><input id="mairCarMode" type="checkbox"><span></span><b>Car Mode</b></label>';const version=pane.querySelector('.versionbox');pane.insertBefore(card,version||null);if(version)pane.appendChild(version)}$('mairCarMode').checked=isCar();if(!$('mairCarMode').dataset.mairCarBound){$('mairCarMode').dataset.mairCarBound='1';$('mairCarMode').addEventListener('change',e=>setCar(e.target.checked))}}
function boot(){setCar(isCar());inject();window.addEventListener('pageshow',()=>{setCar(isCar());purgeLegacyUi();inject()});window.MAIRUserControls={version:'mair-user-controls-v1.5-settings-only',setCar,purgeLegacyUi,get carMode(){return isCar()}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
