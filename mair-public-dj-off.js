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
function stopPublicDj(){
  try{window.MAIRDJ?.cancelActive?.('public-dj-disabled')}catch{}
  try{window.MAIRDJ?.skipNext?.()}catch{}
  try{window.JFMDJAudio?.stop?.()}catch{}
  try{window.JFMDJAudio?.cancel?.()}catch{}
  try{if(typeof window.speakText==='function')window.speakText=async()=>false}catch{}
  const dj=window.MAIRDJ;
  if(dj){
    const off=async()=>false;
    for(const name of ['playNow','armNow','trigger','prepare','run','speak','breakNow','forceBreak','scheduleNow']){
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
