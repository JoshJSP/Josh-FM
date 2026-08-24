(()=>{
'use strict';
if(window.__mairPersonalSourceSync)return;window.__mairPersonalSourceSync=true;
const $=id=>document.getElementById(id),CHANNEL_KEY='jfm_music_channel_v1',PLAYBACK_SOURCE_KEY='mair_playback_source_v1';
function activatePersonal(reason='personal-source'){
  try{localStorage.setItem(CHANNEL_KEY,'mix');localStorage.setItem(PLAYBACK_SOURCE_KEY,JSON.stringify({kind:'station',id:'mix',at:Date.now(),reason}));localStorage.removeItem('mair_active_category_v2')}catch{}
  try{document.body.dataset.musicChannel='mix'}catch{}
  try{window.dispatchEvent(new CustomEvent('mair:channelchange',{detail:{id:'mix',label:'MY MAIR',loading:false,reason}}))}catch{}
  try{window.MAIRStations?.sync?.();window.MAIRRadioHome?.refresh?.();window.MAIREasyUse?.sync?.()}catch{}
  return true;
}
async function buildPersonal(options={}){
  const shouldActivate=options.activate!==false,shouldCommit=options.commit!==false,announce=options.announce!==false;
  if(shouldActivate)activatePersonal('personal-source-rebuild');
  saveSettings();
  const info=$('queueInfo');if(info&&announce){info.style.color='';info.textContent='Persoonlijke radioset wordt gemaakt…'}
  const src=$('source')?.value||'top';let tracks=[];
  if(src==='top'){
    for(const range of ['short_term','medium_term','long_term']){const d=await api(`/me/top/tracks?limit=40&time_range=${range}`);tracks.push(...(d.items||[]))}
  }else if(src==='recent'){
    const d=await api('/me/player/recently-played?limit=50');tracks=(d.items||[]).map(x=>x.track);
  }else if(src==='saved'){
    let off=0;while(off<150){const d=await api(`/me/tracks?limit=50&offset=${off}`);tracks.push(...(d.items||[]).map(x=>x.track));if(!d.next)break;off+=50}
  }else{
    const id=parsePlaylist($('playlist')?.value||'');if(!id)throw Error('Plak een geldige Spotify playlist-link of ID.');let off=0;while(off<150){const d=await api(`/playlists/${id}/items?limit=50&offset=${off}`);tracks.push(...(d.items||[]).map(x=>x.item).filter(Boolean));if(!d.next)break;off+=50}
  }
  tracks=[...new Map(tracks.filter(Boolean).map(t=>[t.id,t])).values()];
  if(settings.mode==='throwback'){const old=tracks.filter(t=>Number((t.album?.release_date||'9999').slice(0,4))<=2016);if(old.length>=8)tracks=old}
  const skips=skipMap();tracks.sort((a,b)=>(skips[a.id]||0)-(skips[b.id]||0)+(Math.random()-.5)*2);let result=tracks.slice(0,50).map(trackObj);
  if(!result.length)throw Error('Ik kon geen tracks voor deze persoonlijke radioset vinden.');
  if(shouldCommit)result=window.JFMQueue?.commit?.(result,{source:'personal',station:'mix',reason:'personal-source-rebuild'})||(queue=result);
  try{window.__jfmStationQueueSig='';window.jfmRenderNext?.();window.JFMProgramDirector?.render?.()}catch{}
  if(info&&announce)info.textContent=`${result.length} tracks klaar · MY MAIR.`;
  if(announce)try{window.dispatchEvent(new CustomEvent('mair:station-selected',{detail:{id:'mix',label:'MY MAIR',count:result.length,verified:true,started:false,reason:'personal-source'}}))}catch{}
  return result;
}
function install(){
  const source=$('source'),rebuild=$('rebuild');
  if(source&&!source.dataset.mairPersonalSourceSync){source.dataset.mairPersonalSourceSync='1';source.addEventListener('change',()=>{activatePersonal('source-change');try{queue=[]}catch{}},true)}
  if(rebuild&&!rebuild.dataset.mairPersonalSourceSync){rebuild.dataset.mairPersonalSourceSync='1';rebuild.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();buildPersonal().catch(err=>{const info=$('queueInfo');if(info){info.textContent='Radioset maken mislukt: '+String(err?.message||err);info.style.color='#ffb4b4'}})},true)}
  if(!window.__mairPersonalBuildWrapped&&typeof window.buildSet==='function'){
    const inherited=window.buildSet;window.buildSet=async(...args)=>{const active=localStorage.getItem(CHANNEL_KEY)||'mix';return active==='mix'?buildPersonal():inherited(...args)};window.__mairPersonalBuildWrapped=true;
  }
}
window.addEventListener('click',e=>{const b=e.target?.closest?.('[data-mair-station="mix"],[data-jfm-channel="mix"]');if(b)activatePersonal('my-mair-tap')},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('pageshow',()=>setTimeout(install,0));
window.MAIRPersonalSourceSync={version:'mair-personal-source-sync-v1',activatePersonal,buildPersonal,install};
})();
