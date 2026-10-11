// MAIR toetsenbord: spatie = afspelen/pauze, pijl rechts/links = volgende/vorige.
// Alleen buiten invoervelden en zonder modifier-toets; een gefocuste knop houdt zijn eigen spatie.
(()=>{
'use strict';
if(window.MAIRShortcuts)return;
const KEYS={' ':'play','ArrowRight':'next','ArrowLeft':'prev'};
function typing(t){return !!t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.closest?.('[role=slider],[role=dialog]'))}
function onKey(e){
  const id=KEYS[e.key];
  if(!id||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.repeat)return;
  if(typing(e.target)||(e.key===' '&&e.target?.closest?.('button,a,summary')))return;
  const b=document.getElementById(id);
  if(!b||b.disabled||b.offsetParent===null)return;
  e.preventDefault();b.click();
}
document.addEventListener('keydown',onKey);
window.MAIRShortcuts={version:'mair-shortcuts-v1',keys:{...KEYS}};
})();
