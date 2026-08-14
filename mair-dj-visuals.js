// MAIR DJ visuals — one visual source for Josh, Maya, Max and Noah.
(()=>{
'use strict';
if(window.MAIRDJVisuals)return;
const AVATARS={josh:'./assets/dj-josh.webp',maya:'./assets/dj-maya.webp',max:'./assets/dj-max.webp',noah:'./assets/dj-noah.webp'};
function idFrom(el){if(!el)return'josh';for(const id of Object.keys(AVATARS))if(el.classList?.contains(`dj-${id}`)||el.dataset?.mairDj===id)return id;const card=el.closest?.('[data-mair-dj]');return AVATARS[card?.dataset?.mairDj]?card.dataset.mairDj:(window.MAIRCurrentDJ?.id||window.MAIRDJProfiles?.current?.id||'josh')}
function img(id,kind='avatar'){const src=AVATARS[id]||AVATARS.josh;return `<img class="mair-dj-photo mair-dj-photo-${kind}" src="${src}" alt="" loading="eager" decoding="async">`}
function decorate(el){if(!el||el.dataset.mairConceptPhoto==='1')return;const id=idFrom(el);el.dataset.mairConceptPhoto='1';el.dataset.mairDjId=id;el.insertAdjacentHTML('afterbegin',img(id,el.classList.contains('mair-profile-avatar')?'profile':'avatar'));}
function sync(){const profiles=window.MAIRDJProfiles?.profiles;if(profiles)for(const[id,src]of Object.entries(AVATARS))if(profiles[id])profiles[id].avatar=src;document.querySelectorAll('.mair-dj-avatar,.mair-profile-avatar,.mair-concept-avatar').forEach(decorate)}
function observer(){if(window.__mairDjVisualObserver)return;window.__mairDjVisualObserver=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes||[]){if(n.nodeType!==1)continue;if(n.matches?.('.mair-dj-avatar,.mair-profile-avatar,.mair-concept-avatar'))decorate(n);n.querySelectorAll?.('.mair-dj-avatar,.mair-profile-avatar,.mair-concept-avatar').forEach(decorate)}});window.__mairDjVisualObserver.observe(document.body,{childList:true,subtree:true})}
function boot(){sync();observer();window.addEventListener('mair:djchange',()=>requestAnimationFrame(sync));window.addEventListener('mair:dj-speaking',()=>requestAnimationFrame(sync));window.addEventListener('pageshow',sync);window.MAIRDJVisuals={version:'mair-dj-visuals-v1-concepts',avatars:{...AVATARS},sync,img}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();