(()=>{
'use strict';
if(window.__mairDjLiveTruth)return;window.__mairDjLiveTruth=true;
const $=id=>document.getElementById(id);
function dj(){return window.MAIRCurrentDJ||window.MAIRDJProfiles?.current||{id:'josh',name:'Josh',role:'MAIR DJ'}}
function avatar(d=dj()){const id=d?.id||'josh',name=d?.name||'Josh';return `<span class="mair-concept-avatar dj-${id}" aria-label="${name}"><span class="mair-concept-face">${name[0]}</span><span class="mair-concept-onair">MAIR · ON AIR</span><b>${name}</b></span>`}
function setLive(on,detail={}){const art=document.querySelector('#tab-radio .art');if(!art)return;let live=$('mairDjLiveArt');if(!live){live=document.createElement('div');live.id='mairDjLiveArt';live.className='mair-dj-live-art hidden';art.parentNode?.insertBefore(live,art.nextSibling)}if(on){const d=detail.dj||dj();live.innerHTML=avatar(d)+'<span class="mair-dj-live-label">DJ LIVE</span>';live.classList.remove('hidden');art.classList.add('mair-art-dj-hidden')}else{live.classList.add('hidden');art.classList.remove('mair-art-dj-hidden')}}
function status(active){const s=$('mairDjScheduleStatus');if(!s)return;const d=dj();if(active){s.textContent=`${d.name} · DJ live`;s.dataset.live='1'}else if(s.dataset.live==='1'){s.textContent=`${d.name} · overgang wordt uitgevoerd`;s.dataset.live='0'}}
window.addEventListener('mair:dj-v2-state',e=>{if(window.MAIRDJ?.version?.startsWith('v3')&&e.detail?.phase!=='SPEAKING'){setLive(false);status(false)}});
window.addEventListener('mair:dj-speaking',e=>{const on=!!(e.detail?.speaking??e.detail?.active);setLive(on,e.detail||{});status(on)});
window.addEventListener('pagehide',()=>setLive(false));window.addEventListener('pageshow',()=>{if(!window.MAIRVoiceEngine?.speaking)setLive(false)});
window.MAIRDJLiveTruth={version:'mair-dj-live-truth-v1',setLive};
})();