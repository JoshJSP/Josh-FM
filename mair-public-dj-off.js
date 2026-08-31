// Public MAIR: DJ is intentionally disabled. DJ source files and stored state remain in the repository/backoffice.
(()=>{
'use strict';
if(window.MAIRPublicDJOff)return;
window.MAIR_PUBLIC_DJ_ENABLED=false;
const $=id=>document.getElementById(id);
function preserveSettings(){
  try{
    const current=JSON.parse(localStorage.getItem('jfm_settings')||'{}');
    localStorage.setItem('jfm_settings',JSON.stringify({...current,talk:0,facts:false,time:false,weather:false,jingles:false}));
  }catch{}
}
function installStyle(){
  if($('mairPublicDjOffStyle'))return;
  const style=document.createElement('style');
  style.id='mairPublicDjOffStyle';
  style.textContent=`
    #djNow,#skipTalk,#mairDJProfiles,#mairDJSheet,#mairDjScheduleStatus,#mairDjLiveArt,
    .mair-dj-card-v2,.mair-dj-settings,.mair-dj-sheet,[data-mair-dj],.mair-dj-live-art{display:none!important}
    html[data-mair-public-dj="off"] #djText{display:none!important}
    /* De praatfrequentie en stemkeuze zijn zonder DJ betekenisloze bedieningen. */
    html[data-mair-public-dj="off"] #talk,
    html[data-mair-public-dj="off"] #talkValue,
    html[data-mair-public-dj="off"] #voiceMode,
    html[data-mair-public-dj="off"] #testVoice,
    html[data-mair-public-dj="off"] #factSource{display:none!important}
  `;
  document.head.appendChild(style);
}
function hideCardFor(id){
  const el=$(id);if(!el)return;
  const card=el.closest('article.card');if(card)card.style.display='none';
}
function cleanPublicCopy(){
  const results=$('searchResults');
  if(results&&/DJ/i.test(results.textContent||''))results.innerHTML='<p class="muted">Zoek in heel Spotify en voeg een nummer toe aan je MAIR-planning.</p>';
  document.querySelectorAll('#b7RequestSheet .muted').forEach(el=>{if(/DJ/i.test(el.textContent||''))el.textContent='Je verzoek krijgt voorrang in de programmering.'});
}
// Normaal bestaat window.MAIRDJ hier helemaal niet, omdat dj-now-queue.js
// mair-dj-v2.js niet laadt als MAIR_DJ_ENABLED uit staat. Deze functie is de
// vangnetlaag voor het geval de DJ toch aanwezig is (oude cache, handmatig
// geladen script, of iemand die de vlag halverwege omzet).
//
// De methodenamen hieronder zijn de ECHTE publieke API van mair-dj-v2.js
// (window.MAIRDJ={version,prepare,air,armManual,skipNext,cancelActive,...}).
// De vorige lijst stubte namen die nooit hebben bestaan, waardoor deze
// kill-switch de DJ in de praktijk niet stopte.
const DJ_ENTRY_POINTS=['prepare','air','armManual','runVoiceCheck'];
function stopPublicDj(){
  const dj=window.MAIRDJ;
  try{dj?.cancelActive?.('public-dj-disabled')}catch{}
  try{dj?.skipNext?.()}catch{}
  try{window.JFMDJAudio?.stop?.()}catch{}
  try{window.JFMDJAudio?.cancel?.()}catch{}
  // speakText blijft bewust intact: de startjingle en het (opt-in) nieuwsbulletin
  // gebruiken dezelfde centrale stem. De DJ kan niet meer praten omdat zijn
  // ingangen hieronder dicht staan, niet omdat de stem is gesloopt.
  if(dj){
    const off=async()=>false;
    for(const name of DJ_ENTRY_POINTS){
      try{if(typeof dj[name]==='function')dj[name]=off}catch{}
    }
  }
}
function apply(){
  document.documentElement.dataset.mairPublicDj='off';
  preserveSettings();installStyle();
  const talk=$('talk');if(talk)talk.value='0';
  for(const id of ['facts','timeMention','weatherMention','jingles']){const el=$(id);if(el)el.checked=false}
  const quick=$('djNow')?.closest('.grid2');if(quick)quick.style.display='none';
  hideCardFor('djText');hideCardFor('talk');hideCardFor('voiceMode');
  $('mairDJProfiles')?.setAttribute('hidden','');$('mairDJSheet')?.setAttribute('hidden','');
  cleanPublicCopy();stopPublicDj();
}
function boot(){apply();setTimeout(apply,250);setTimeout(apply,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('mair:foundation-ready',()=>setTimeout(apply,0));
window.addEventListener('mair:dj-v2-state',()=>stopPublicDj());
window.MAIRPublicDJOff={version:'public-dj-off-v1',apply,enabled:false};
})();
