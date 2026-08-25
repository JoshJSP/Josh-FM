// MAIR user controls — user-facing listening controls only. Sleep lives in the dedicated Sleep screen.
(()=>{
'use strict';
if(window.MAIRUserControls)return;
const $=id=>document.getElementById(id),CAR='jfm_car_mode',OLD_CAR='mair_car_mode_v1',OLD_SLEEP='mair_sleep_timer_v1';
function isCar(){return localStorage.getItem(CAR)==='1'||localStorage.getItem(OLD_CAR)==='1'}
function setCar(on){localStorage.setItem(CAR,on?'1':'0');localStorage.removeItem(OLD_CAR);document.body.classList.toggle('mair-car-mode',!!on);document.body.classList.toggle('jfm-car-mode',!!on);try{window.JFMRuntimeModes?.set?.('car',!!on)}catch{}const input=$('mairCarMode');if(input)input.checked=!!on}
function setSleep(mode){const sleep=window.MAIRSleep;if(!sleep)return false;if(mode==='after-track')return sleep.scheduleAfterTrack?.()??false;const n=Number(mode);if(Number.isFinite(n)&&n>0)return sleep.scheduleMinutes?.(n)??false;return sleep.cancel?.()??false}
function sleepState(){const s=window.MAIRSleep?.status?.()||{};return{mode:s.mode||'off',deadline:Number(s.endsAt||0),trackId:String(s.trackId||''),remaining:Number(s.remainingMs||0)}}
function purgeLegacyUi(){['jfmRuntimeModes','jfmSleepCard','mairAdvancedDiagnostics'].forEach(id=>$(id)?.remove());const card=$('mairUserControlsCard');if(card){card.querySelector('.mair-sleep-head')?.remove();card.querySelector('.mair-sleep-options')?.remove();card.querySelectorAll('[data-mair-sleep],#mairSleepStatus').forEach(x=>x.remove())}}
function inject(){const pane=$('tab-settings');if(!pane)return;purgeLegacyUi();let card=$('mairUserControlsCard');if(!card){card=document.createElement('article');card.id='mairUserControlsCard';card.className='card mair-settings-card mair-user-controls';card.innerHTML='<div class="kicker">GEBRUIK</div><h3>Luisteren</h3><label class="switch"><input id="mairCarMode" type="checkbox"><span></span><b>Car Mode</b></label>';const version=pane.querySelector('.versionbox');pane.insertBefore(card,version||null);if(version)pane.appendChild(version)}const input=$('mairCarMode');if(input){input.checked=isCar();if(input.dataset.mairBound!=='1'){input.dataset.mairBound='1';input.addEventListener('change',e=>setCar(e.target.checked))}}}
function boot(){try{localStorage.removeItem(OLD_SLEEP)}catch{}setCar(isCar());inject();window.addEventListener('pageshow',()=>{setCar(isCar());purgeLegacyUi();inject()});window.MAIRSleepTimer={version:'mair-sleep-compat-v2-dedicated-screen',set:setSleep,consumeAfterTrack:()=>false,get state(){return sleepState()}};window.MAIRUserControls={version:'mair-user-controls-v1.5-car-only',setCar,setSleep,purgeLegacyUi,get carMode(){return isCar()}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
