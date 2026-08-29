// MAIRFM Sleep — approved landscape bedside adapter.
(()=>{
'use strict';
if(window.MAIRSleepLandscapePrototype)return;
const media=window.matchMedia('(orientation: landscape) and (min-width:700px)');
const $=id=>document.getElementById(id);
let enabled=true,lastApplied=false,volumeTimer=null;
function overlay(){return $('mairSleepOverlay')}
function artworkSrc(){const img=$('artImg');return String(img?.currentSrc||img?.src||'').trim()||'mair-icon-512.png'}
async function setVolume(percent){const value=Math.max(0,Math.min(100,Math.round(Number(percent)||0))),deviceId=String(window.JFMSpotifySDK?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();let ok=false;try{if(window.jfmSpotifyPlayer?.setVolume){await window.jfmSpotifyPlayer.setVolume(value/100);ok=true}}catch{}try{if(typeof window.api==='function'){const suffix=deviceId?`&device_id=${encodeURIComponent(deviceId)}`:'';await window.api(`/me/player/volume?volume_percent=${value}${suffix}`,{method:'PUT'});ok=true}}catch{}try{localStorage.setItem('mair_volume_percent',String(value));window.dispatchEvent(new CustomEvent('mair:volume-change',{detail:{percent:value,source:'sleep-screen'}}))}catch{}return ok}
function ensureExtras(){const node=overlay(),wrap=node?.querySelector('.mair-sleep-wrap');if(!wrap)return;
 let art=$('mairSleepArtwork');if(!art){art=document.createElement('img');art.id='mairSleepArtwork';art.className='mair-sleep-artwork';art.alt='Albumhoes';wrap.appendChild(art)}art.src=artworkSrc();
 let adjust=$('mairSleepAdjust');if(!adjust){adjust=document.createElement('button');adjust.id='mairSleepAdjust';adjust.type='button';adjust.className='mair-sleep-adjust';adjust.textContent='☾  Timer aanpassen';adjust.onclick=()=>node.classList.toggle('mair-sleep-adjusting');wrap.appendChild(adjust)}
 let volume=$('mairSleepVolume');if(!volume){volume=document.createElement('label');volume.id='mairSleepVolume';volume.className='mair-sleep-volume';volume.innerHTML='<span>🔊</span><input id="mairSleepVolumeRange" type="range" min="0" max="100" value="55" aria-label="Volume"><output id="mairSleepVolumeValue">55</output>';wrap.appendChild(volume);const range=$('mairSleepVolumeRange'),out=$('mairSleepVolumeValue'),saved=Math.max(0,Math.min(100,Number(localStorage.getItem('mair_volume_percent'))||55));range.value=String(saved);if(out)out.value=String(saved);range?.addEventListener('input',()=>{const n=Math.max(0,Math.min(100,Number(range.value)||0));if(out)out.value=String(n);clearTimeout(volumeTimer);volumeTimer=setTimeout(()=>setVolume(n),80)});range?.addEventListener('change',()=>setVolume(Number(range.value)||0))}
 node.querySelectorAll('[data-sleep-minutes]').forEach(btn=>btn.addEventListener('click',()=>node.classList.remove('mair-sleep-adjusting')))
}
function sync(){const node=overlay();if(!node)return false;ensureExtras();const apply=enabled&&media.matches;node.classList.toggle('mair-sleep-landscape-v2',apply);node.dataset.sleepLayout=apply?'landscape-bedside':'default';lastApplied=apply;const art=$('mairSleepArtwork');if(art)art.src=artworkSrc();try{window.dispatchEvent(new CustomEvent('mair:sleep-layout',{detail:{layout:node.dataset.sleepLayout,active:apply}}))}catch{}return apply}
function status(){return{version:'landscape-bedside-volume-2026-08-29',enabled,matches:media.matches,applied:lastApplied,sleepAvailable:!!window.MAIRSleep,overlayAvailable:!!overlay()}}
function setEnabled(v){enabled=!!v;sync();return status()}
function boot(){sync();media.addEventListener?.('change',sync);window.addEventListener('resize',sync,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});['mair:sleep','mair:foundation-ready','jfm:trackchange','jfm:playback-state'].forEach(name=>window.addEventListener(name,sync));const observer=new MutationObserver(()=>{if(overlay()){sync();observer.disconnect()}});if(!overlay())observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(sync,250);setTimeout(sync,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRSleepLandscapePrototype={version:'landscape-bedside-volume-2026-08-29',enable:()=>setEnabled(true),disable:()=>setEnabled(false),sync,setVolume,status};
})();