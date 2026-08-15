(()=>{
'use strict';
if(window.__mairDiagnosticsHubV1)return;window.__mairDiagnosticsHubV1=true;
const $=id=>document.getElementById(id);
function ensureHub(){const pane=$('tab-settings');if(!pane)return null;let hub=$('mairDiagnosticsHub');if(hub)return hub;hub=document.createElement('article');hub.id='mairDiagnosticsHub';hub.className='card';hub.innerHTML='<div class="kicker">GEAVANCEERD</div><div class="row between"><h3 style="margin:0">Diagnose</h3><span id="mairDiagnosticsBadge" class="muted">GESLOTEN</span></div><p class="muted">Technische controles en tests staan hier bij elkaar.</p><button id="mairDiagnosticsToggle" type="button" class="secondary">Diagnose openen</button><div id="mairDiagnosticsBody" hidden style="margin-top:14px"></div>';
 const version=pane.querySelector('.versionbox');if(version)pane.insertBefore(hub,version);else pane.appendChild(hub);
 $('mairDiagnosticsToggle')?.addEventListener('click',()=>{const body=$('mairDiagnosticsBody'),b=$('mairDiagnosticsToggle'),badge=$('mairDiagnosticsBadge');if(!body)return;body.hidden=!body.hidden;b.textContent=body.hidden?'Diagnose openen':'Diagnose sluiten';if(badge)badge.textContent=body.hidden?'GESLOTEN':'OPEN'});
 return hub}
function addSection(id,title){const body=$('mairDiagnosticsBody');if(!body)return null;let s=$(id);if(s)return s;s=document.createElement('section');s.id=id;s.style.marginTop='14px';s.innerHTML=`<div class="kicker">${title}</div>`;body.appendChild(s);return s}
function moveCard(id,sectionTitle){const card=$(id);if(!card||card.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-'+id,sectionTitle);sec?.appendChild(card)}
function moveSelfTest(){const b=$('selfTest');const card=b?.closest('article.card');if(!card||card.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-selftest','SELF TEST');sec?.appendChild(card)}
function moveVoiceTest(){const btn=$('testVoice');if(!btn||btn.closest('#mairDiagnosticsBody'))return;const sec=addSection('diag-voice-test','STEMTEST');const info=$('voiceInfo');sec?.appendChild(btn);if(info)sec?.appendChild(info)}
function sync(){if(!ensureHub())return;moveVoiceTest();moveCard('mairVoiceCheckCard','COMPLETE VOICE CHECK');moveCard('jfmHealthCard','MAIR STATUS');moveSelfTest();const pane=$('tab-settings'),version=pane?.querySelector('.versionbox');if(pane&&version)pane.appendChild(version)}
function boot(){sync();let ticks=0;const timer=setInterval(()=>{sync();if(++ticks>40)clearInterval(timer)},250);const pane=$('tab-settings');if(pane){const mo=new MutationObserver(()=>sync());mo.observe(pane,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),15000)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('pageshow',()=>setTimeout(sync,120));
window.MAIRDiagnosticsHub={version:'mair-diagnostics-hub-v1',sync};
})();
