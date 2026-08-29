// Public MAIR: DJ is intentionally disabled. DJ source files and stored state remain in the repository/backoffice.
(()=>{
'use strict';
if(window.MAIRPublicDJOff)return;
window.MAIR_PUBLIC_DJ_ENABLED=false;
const $=id=>document.getElementById(id);
function preserveSettings(){try{const current=JSON.parse(localStorage.getItem('jfm_settings')||'{}');localStorage.setItem('jfm_settings',JSON.stringify({...current,talk:0,facts:false,time:false,weather:false,jingles:false}))}catch{}}
function installStyle(){if($('mairPublicDjOffStyle'))return;const style=document.createElement('style');style.id='mairPublicDjOffStyle';style.textContent=`#djNow,#skipTalk,#mairDJProfiles,#mairDJSheet,#mairDjScheduleStatus,#mairDjLiveArt,.mair-dj-card-v2,.mair-dj-settings,.mair-dj-sheet,[data-mair-dj],.mair-dj-live-art{display:none!important}html[data-mair-public-dj="off"] #djText{display:none!important}`;document.head.appendChild(style)}
function hideCardFor(id){const el=$(id);if(!el)return;const card=el.closest('article.card');if(card)card.remove()}
function text(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim().toUpperCase()}
function purgeRemainingDjUi(){
  const radio=$('tab-radio');
  if(radio){[...radio.querySelectorAll('article,section,button,div')].forEach(el=>{const t=text(el);if(!t)return;if((t.includes('DJ · EVEN STIL')||t.includes('EVEN STIL VOOR DE MUZIEK')||t.includes('VOLGENDE RADIOMOMENT WORDT OVERGESLAGEN'))&&t.length<220){const card=el.closest('article.card,button,section')||el;if(card&&card!==radio)card.remove()}})}
  const settings=$('tab-settings');
  if(settings){[...settings.querySelectorAll('article.card')].forEach(card=>{const t=text(card);if(t.includes('DJ ROTATION')||t.includes('WIE PRESENTEERT MAIR')||t.includes('DJ-INSTELLINGEN')||t.includes('MAIR VOICE ENGINE'))card.remove()});[...settings.children].forEach(el=>{const t=text(el);if((t==='DJ'||t==='DJ ROTATION')&&!el.querySelector('input,button,select'))el.remove()})}
}
function cleanPublicCopy(){const results=$('searchResults');if(results&&/DJ/i.test(results.textContent||''))results.innerHTML='<p class="muted">Zoek in heel Spotify en voeg een nummer toe aan je MAIR-planning.</p>';document.querySelectorAll('#b7RequestSheet .muted').forEach(el=>{if(/DJ/i.test(el.textContent||''))el.textContent='Je verzoek krijgt voorrang in de programmering.'})}
function stopPublicDj(){try{window.MAIRDJ?.cancelActive?.('public-dj-disabled')}catch{}try{window.MAIRDJ?.skipNext?.()}catch{}try{window.JFMDJAudio?.stop?.()}catch{}try{window.JFMDJAudio?.cancel?.()}catch{}try{if(typeof window.speakText==='function')window.speakText=async()=>false}catch{}const dj=window.MAIRDJ;if(dj){const off=async()=>false;for(const name of ['playNow','armNow','trigger','prepare','run','speak','breakNow','forceBreak','scheduleNow'])try{if(typeof dj[name]==='function')dj[name]=off}catch{}}}
function apply(){document.documentElement.dataset.mairPublicDj='off';document.documentElement.dataset.mairDj='retired';preserveSettings();installStyle();const talk=$('talk');if(talk)talk.value='0';for(const id of ['facts','timeMention','weatherMention','jingles']){const el=$(id);if(el)el.checked=false}const quick=$('djNow')?.closest('.grid2');if(quick)quick.remove();hideCardFor('djText');hideCardFor('talk');hideCardFor('voiceMode');$('mairDJProfiles')?.remove();$('mairDJSheet')?.remove();purgeRemainingDjUi();cleanPublicCopy();stopPublicDj()}
function boot(){apply();setTimeout(apply,100);setTimeout(apply,400);setTimeout(apply,1200);let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;purgeRemainingDjUi()},50)}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('mair:foundation-ready',()=>setTimeout(apply,0));window.addEventListener('mair:dj-v2-state',()=>stopPublicDj());window.MAIRPublicDJOff={version:'public-dj-off-v2-hard-ui-purge',apply,enabled:false};
})();