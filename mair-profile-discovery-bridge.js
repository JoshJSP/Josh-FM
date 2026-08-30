(()=>{
'use strict';
if(window.MAIRProfileDiscoveryBridge)return;
const $=id=>document.getElementById(id),SET_SIZE=50;
function clamp(v){return Math.max(0,Math.min(100,Number(v)||0))}
function source(){return $('discovery')}
function targetCount(pct){return Math.round(SET_SIZE*clamp(pct)/100)}
function labelText(pct){pct=clamp(pct);return `${pct}% · ±${targetCount(pct)}/${SET_SIZE} nieuw`}
function currentValue(){const src=source(),stored=Number(localStorage.getItem('jfm_discovery'));return clamp(src?src.value:(Number.isFinite(stored)?stored:30))}
function pushToEngine(value,kind){const src=source();if(!src)return false;src.value=String(clamp(value));src.dispatchEvent(new Event(kind,{bubbles:true}));return true}
function card(){
 const section=document.createElement('section');section.id='mairProfileDiscoveryCard';section.className='mair-profile-card';
 const value=currentValue();
 section.innerHTML=`<div class="mair-profile-section-title"><i>✦</i><span><b>Muziekontdekking</b><small>Bepaal hoeveel nieuwe muziek MY MAIR voor je zoekt</small></span></div><div style="border:1px solid #292a2f;border-radius:17px;padding:14px;background:#0d0d0f"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><span style="font-size:13px;font-weight:800;color:#f2f2f4">Hoeveel nieuwe muziek?</span><b id="mairProfileDiscoveryValue" style="font-size:13px;color:#ff7a12;white-space:nowrap">${labelText(value)}</b></div><input id="mairProfileDiscovery" type="range" min="0" max="100" step="10" value="${value}" style="width:100%;accent-color:#ff6a00"><div style="display:flex;justify-content:space-between;margin-top:8px;color:#777983;font-size:9px"><span>Vertrouwd</span><span>Veel ontdekken</span></div></div>`;
 const slider=section.querySelector('#mairProfileDiscovery'),out=section.querySelector('#mairProfileDiscoveryValue');
 slider.addEventListener('input',()=>{const v=clamp(slider.value);out.textContent=labelText(v);pushToEngine(v,'input')});
 slider.addEventListener('change',()=>{const v=clamp(slider.value);out.textContent=labelText(v);pushToEngine(v,'change')});
 return section
}
function install(){
 const page=$('mairProfilePage');if(!page||$('mairProfileDiscoveryCard'))return false;
 const cards=[...page.querySelectorAll(':scope > .mair-profile-card')],numbers=cards.find(x=>x.querySelector('.mair-profile-section-title b')?.textContent?.trim()==='Jouw cijfers');
 const node=card();if(numbers)numbers.insertAdjacentElement('afterend',node);else page.prepend(node);return true
}
function refresh(){const slider=$('mairProfileDiscovery'),out=$('mairProfileDiscoveryValue');if(!slider||!out)return install();const v=currentValue();if(document.activeElement!==slider)slider.value=String(v);out.textContent=labelText(slider.value);return true}
const events=['jfm:trackchange','mair:taste-feedback','mair:request-confirmed','mair:station-selected','mair:mode-analytics','mair:discovery-counted','mair:discoveries-reset','mair:profile-reset'];
for(const name of events)window.addEventListener(name,()=>setTimeout(refresh,220));
window.addEventListener('pageshow',()=>setTimeout(refresh,150));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refresh,150)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,250),{once:true});else setTimeout(refresh,250);
setInterval(refresh,2000);
window.MAIRProfileDiscoveryBridge={version:'profile-discovery-bridge-v1',install,refresh,value:currentValue};
})();