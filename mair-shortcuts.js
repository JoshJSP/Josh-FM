// MAIR toetsenbord (laptop): spatie = afspelen/pauze, pijl rechts/links = volgende/vorige,
// pijl omhoog/omlaag = volume. Alleen op de Radio-tab, buiten invoervelden en zonder modifier-toets;
// een gefocuste knop houdt zijn eigen spatie en op andere tabs blijft pijl-omlaag gewoon scrollen.
(()=>{
'use strict';
if(window.MAIRShortcuts)return;
const KEYS={' ':'play','ArrowRight':'next','ArrowLeft':'prev','ArrowUp':'volume+','ArrowDown':'volume-'},STEP=.05;
function typing(t){return !!t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.closest?.('[role=slider],[role=dialog]'))}
// Achter een open overlay (Car Mode, verzoek-sheet, diagnostiek, slaapscherm, passenger) doen sneltoetsen niets.
const OVERLAY_CLASSES=['mair-car-mode-open','mair-car-mode','jfm-car-mode','mair-request-open','mair-diagnostics-open'];
function overlayOpen(){
  const b=document.body;if(b&&OVERLAY_CLASSES.some(c=>b.classList?.contains(c)))return true;
  for(const id of ['mairSleepOverlay','mairPassengerSheet']){const el=document.getElementById(id);if(el&&!el.hidden)return true}
  return false;
}
function onKey(e){
  const id=KEYS[e.key];
  if(!id||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.repeat&&!id.startsWith('volume'))return;
  if(typing(e.target)||(e.key===' '&&e.target?.closest?.('button,a,summary')))return;
  const play=document.getElementById('play');
  if(!play||play.offsetParent===null||overlayOpen())return;
  if(id.startsWith('volume')){
    const pb=window.JFMPlayback;if(typeof pb?.setVolume!=='function')return;
    const now=Number.isFinite(Number(pb.volume))?Number(pb.volume):1;
    e.preventDefault();pb.setVolume(Math.max(0,Math.min(1,Math.round((now+(id==='volume+'?STEP:-STEP))*100)/100)));return;
  }
  const b=document.getElementById(id);
  if(!b||b.disabled||b.offsetParent===null)return;
  e.preventDefault();b.click();
}
document.addEventListener('keydown',onKey);
window.MAIRShortcuts={version:'mair-shortcuts-v2',keys:{...KEYS}};
})();
