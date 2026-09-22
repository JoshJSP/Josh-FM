(()=>{
'use strict';
if(window.__mairDiagnosticsHubV1)return;window.__mairDiagnosticsHubV1=true;
const $=id=>document.getElementById(id);let expanded=false,visible=false;
function applyOpenState(next=expanded){expanded=!!next;const body=$('mairDiagnosticsBody'),b=$('mairDiagnosticsToggle'),badge=$('mairDiagnosticsBadge');if(!body)return false;body.hidden=!expanded;body.style.display=expanded?'block':'none';body.setAttribute('aria-hidden',expanded?'false':'true');if(b){b.textContent=expanded?'Technische details sluiten':'Technische details openen';b.setAttribute('aria-expanded',expanded?'true':'false')}if(badge)badge.textContent=expanded?'OPEN':'GESLOTEN';return true}
function purgeRetired(){['mairAdvancedDiagnostics','jfmSleepCard','jfmDataPortability'].forEach(id=>$(id)?.remove())}
function ensureSheet(){let sheet=$('mairDiagnosticsSheet');if(sheet)return sheet;sheet=document.createElement('aside');sheet.id='mairDiagnosticsSheet';sheet.className='mair-diagnostics-sheet';sheet.hidden=true;sheet.setAttribute('aria-hidden','true');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','mairDiagnosticsTitle');sheet.innerHTML='<div class="mair-diagnostics-shell"><header class="mair-diagnostics-header"><div><span>GEAVANCEERD</span><h2 id="mairDiagnosticsTitle">Diagnostiek & tests</h2><p>Technische status, herstel en testfuncties staan los van de normale radio.</p></div><button id="mairDiagnosticsClose" type="button" aria-label="Diagnostiek sluiten">×</button></header><div id="mairDiagnosticsSheetContent"></div></div>';document.body.appendChild(sheet);return sheet}
function showSheet(next=true){const sheet=ensureSheet();visible=!!next;sheet.hidden=!visible;sheet.classList.toggle('is-open',visible);sheet.setAttribute('aria-hidden',visible?'false':'true');document.body.classList.toggle('mair-diagnostics-open',visible);if(visible){sync();applyOpenState(true);setTimeout(()=>$('mairDiagnosticsClose')?.focus(),0)}return visible}
function ensureHub(){const host=ensureSheet().querySelector('#mairDiagnosticsSheetContent');if(!host)return null;purgeRetired();let hub=$('mairDiagnosticsHub');if(hub){if(hub.parentNode!==host)host.appendChild(hub);applyOpenState(expanded);return hub}hub=document.createElement('article');hub.id='mairDiagnosticsHub';hub.className='card';hub.innerHTML='<div class="kicker">SYSTEEM</div><div class="row between"><h3 style="margin:0">Technische onderdelen</h3><span id="mairDiagnosticsBadge" class="muted">GESLOTEN</span></div><p class="muted">Open dit alleen wanneer je iets wilt controleren of herstellen.</p><button id="mairDiagnosticsToggle" type="button" class="secondary" aria-expanded="false">Technische details openen</button><div id="mairDiagnosticsBody" hidden aria-hidden="true" style="margin-top:14px;display:none"></div>';host.appendChild(hub);applyOpenState(false);return hub}
function addSection(id,title){const body=$('mairDiagnosticsBody');if(!body)return null;let s=$(id);if(s)return s;s=document.createElement('section');s.id=id;s.style.marginTop='14px';s.innerHTML=`<div class="kicker">${title}</div>`;body.appendChild(s);return s}
function moveCard(id,sectionTitle){const card=$(id);if(!card||card.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-'+id,sectionTitle);sec?.appendChild(card)}
function moveSelfTest(){const b=$('selfTest');const card=b?.closest('article.card');if(!card||card.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-selftest','VOLLEDIGE MAIR CHECK');sec?.appendChild(card)}
function moveVoiceTest(){const btn=$('testVoice');if(!btn||btn.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-voice-test','STEMTEST');const info=$('voiceInfo');sec?.appendChild(btn);if(info)sec?.appendChild(info)}
function moveControl(id,sectionId,title){const control=$(id);if(!control||control.closest('#mairDiagnosticsBody'))return;addSection(sectionId,title)?.appendChild(control)}
// Live DJ. Staat sinds 22 september 2026 standaard aan. Deze schakelaar zet
// hem per toestel uit en weer aan; de vlag zelf woont in brand-config.js en
// wordt pas bij de volgende boot gelezen, dus na omzetten is herladen nodig.
// Hij staat ook hier in Diagnostiek omdat de DJ-uit-laag alle gewone
// DJ-bediening verbergt zodra je hem uitzet.
function ensureDjSwitch(){
  const body=$('mairDiagnosticsBody');if(!body)return;
  const sec=addSection('diag-live-dj','LIVE DJ (BETA)');if(!sec)return;
  let card=$('mairLiveDjCard');
  if(!card){
    card=document.createElement('article');card.id='mairLiveDjCard';card.className='card';
    card.innerHTML='<div class="row between"><h3 style="margin:0">Live DJ</h3><span data-mair-dj-state class="muted">UIT</span></div><p class="muted" data-mair-dj-hint>Dezelfde schakelaar staat ook in Instellingen.</p><button data-mair-dj-toggle data-mair-dj-label type="button" class="secondary">Live DJ aanzetten</button>';
    sec.appendChild(card);
  }
  paintDjSwitch();
}
// Dezelfde schakelaar staat op twee plekken: in Instellingen, waar je hem zoekt,
// en hier in Diagnostiek, waar hij ook bereikbaar blijft als de DJ-uit-laag de
// gewone DJ-bediening verbergt. Eén eigenaar, gebonden op attribuut.
function paintDjSwitch(){
  const on=window.MAIR_DJ_ENABLED===true;
  document.querySelectorAll('[data-mair-dj-state]').forEach(el=>{el.textContent=on?'AAN':'UIT'});
  document.querySelectorAll('[data-mair-dj-toggle][data-mair-dj-label]').forEach(el=>{el.textContent=on?'Live DJ uitzetten':'Live DJ aanzetten'});
}
function toggleDj(){
  const next=window.MAIR_DJ_ENABLED!==true;
  try{window.MAIRFlags?.setDJEnabled?.(next)}catch{}
  const message=next?'Live DJ staat aan vanaf de volgende keer laden. MAIRFM wordt nu herladen.':'Live DJ staat uit vanaf de volgende keer laden. MAIRFM wordt nu herladen.';
  document.querySelectorAll('[data-mair-dj-hint]').forEach(el=>{el.textContent=message});
  setTimeout(()=>{try{location.reload()}catch{}},700);
}
function sync(){purgeRetired();if(!ensureHub())return;ensureDjSwitch();moveVoiceTest();moveControl('mairImagingPreview','diag-imaging-test','SONIC LOGO TEST');moveCard('mairTraceCard','CENTRALE RUNTIME STATUS');moveCard('mairTestLabCard','MAIR TEST LAB');moveCard('mairVoiceCheckCard','COMPLETE VOICE CHECK');moveCard('mairVoiceEngineCard','VOICE ENGINE');moveCard('mairVoiceLabCard','VOICE LAB');moveCard('mairSoakCard','RELIABILITY MONITOR');moveCard('mairStationDirectorCard','STATION DIRECTOR');for(const id of ['jfmDiagnostics','jfmHealthCard'])$(id)?.classList.add('mairfm-legacy-diagnostics');moveSelfTest();applyOpenState(expanded)}
function handleClick(e){if(e.target?.closest?.('[data-mair-dj-toggle]')){e.preventDefault();e.stopPropagation();toggleDj();return}if(e.target?.closest?.('#mairDiagnosticsToggle')){e.preventDefault();e.stopPropagation();applyOpenState(!expanded);return}if(e.target?.closest?.('#mairDiagnosticsClose')||e.target===$('mairDiagnosticsSheet')){e.preventDefault();showSheet(false)}}
document.addEventListener('click',handleClick,false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&visible)showSheet(false)});
function boot(){paintDjSwitch();sync();let ticks=0;const timer=setInterval(()=>{sync();if(++ticks>=80)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('pageshow',()=>setTimeout(sync,120));window.addEventListener('mair:diagnostics-open',()=>showSheet(true));
window.MAIRDiagnosticsHub={version:'mair-diagnostics-hub-v2-isolated-sheet',sync,paintDjSwitch,purgeRetired,open:()=>showSheet(true),close:()=>showSheet(false),toggle:()=>showSheet(!visible),get isOpen(){return visible}};
})();
