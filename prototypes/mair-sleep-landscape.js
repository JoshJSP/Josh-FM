// MAIRFM Sleep — landscape bedside adapter with live artwork + volume.
(()=>{
'use strict';
if(window.MAIRSleepLandscapePrototype)return;
const media=window.matchMedia('(orientation: landscape) and (min-width: 700px)');
let enabled=true,lastApplied=false;
const $=id=>document.getElementById(id);
function overlay(){return $('mairSleepOverlay')}
function artworkSrc(){const img=$('artImg');const src=String(img?.currentSrc||img?.src||'').trim();return src||'mair-icon-512.png'}
function ensureExtras(){const node=overlay();const wrap=node?.querySelector('.mair-sleep-wrap');if(!wrap)return;let art=$('mairSleepLandscapeArt');if(!art){art=document.createElement('img');art.id='mairSleepLandscapeArt';art.className='mair-sleep-landscape-art';art.alt='Albumhoes';wrap.appendChild(art)}art.src=artworkSrc();let vol=$('mairSleepLandscapeVolume');if(!vol){vol=document.createElement('label');vol.id='mairSleepLandscapeVolume';vol.className='mair-sleep-landscape-volume';vol.innerHTML='<span>🔊</span><input id="mairSleepLandscapeVolumeRange" type="range" min="0" max="100" value="55" aria-label="Volume"><output id="mairSleepLandscapeVolumeValue">55</output>';wrap.appendChild(vol);const range=$('mairSleepLandscapeVolumeRange'),out=$('mairSleepLandscapeVolumeValue');range?.addEventListener('input',()=>{const n=Math.max(0,Math.min(100,Number(range.value)||0));if(out)out.value=String(n)});range?.addEventListener('change',async()=>{const n=Math.max(0,Math.min(100,Number(range.value)||0));try{if(window.jfmSpotifyPlayer?.setVolume)await window.jfmSpotifyPlayer.setVolume(n/100)}catch{}})}}
function sync(){const node=overlay();if(!node)return false;ensureExtras();const shouldApply=enabled&&media.matches;node.classList.toggle('mair-sleep-landscape-v2',shouldApply);node.dataset.sleepLayout=shouldApply?'landscape-bedside':'default';lastApplied=shouldApply;const art=$('mairSleepLandscapeArt');if(art)art.src=artworkSrc();try{window.dispatchEvent(new CustomEvent('mair:sleep-layout',{detail:{layout:node.dataset.sleepLayout,active:shouldApply}}))}catch{}return shouldApply}
function setEnabled(value){enabled=!!value;sync();return status()}
function status(){return{version:'landscape-bedside-2026-08-29b',enabled,matches:media.matches,applied:lastApplied,sleepAvailable:!!window.MAIRSleep,overlayAvailable:!!overlay()}}
function boot(){sync();media.addEventListener?.('change',sync);window.addEventListener('resize',sync,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});['mair:sleep','mair:foundation-ready','jfm:trackchange','jfm:playback-state'].forEach(n=>window.addEventListener(n,sync));const observer=new MutationObserver(()=>{if(overlay()){sync();observer.disconnect()}});if(!overlay())observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(sync,250);setTimeout(sync,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRSleepLandscapePrototype={version:'landscape-bedside-2026-08-29b',enable:()=>setEnabled(true),disable:()=>setEnabled(false),sync,status};
})();
