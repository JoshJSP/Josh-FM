// MAIR Voice Lab — compare the four production DJ voices with one identical script.
(()=>{
'use strict';
if(window.MAIRVoiceLab)return;
const $=id=>document.getElementById(id),DJS=['josh','maya','max','noah'];
const SAMPLE='Dit is MAIR. Je hoorde net een sterke plaat, straks heb ik nieuwe muziek voor je. Eerst gaan we door met een track die je waarschijnlijk vanaf de eerste seconde kent.';
let active=null,lastError='',meta={};
async function unlock(){try{return await window.JFMDJAudio?.unlock?.()}catch{return false}}
async function inspect(id){try{const r=await fetch('/api/tts?djProfile='+encodeURIComponent(id),{cache:'no-store'}),d=await r.json().catch(()=>({}));meta[id]=d;render();return d}catch(e){lastError=String(e?.message||e);render();return null}}
async function play(id){if(active)return false;active=id;lastError='';render();await unlock();try{const r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:SAMPLE,djProfile:id})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d?.detail||d?.error||`TTS HTTP ${r.status}`)}const blob=await r.blob(),url=URL.createObjectURL(blob),a=new Audio(url);a.preload='auto';await a.play();await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(Error('Voice Lab audio kon niet worden afgespeeld'))});URL.revokeObjectURL(url);active=null;render();return true}catch(e){lastError=String(e?.message||e);active=null;render();return false}}
function card(){let c=$('mairVoiceLabCard');if(c)return c;const pane=$('tab-settings');if(!pane)return null;c=document.createElement('article');c.id='mairVoiceLabCard';c.className='card';c.innerHTML='<div class="kicker">VOICE LAB</div><h3>Vergelijk de MAIR DJ-stemmen</h3><p class="muted">Iedere DJ leest exact dezelfde tekst. Zo hoor je alleen het verschil in stem en delivery.</p><div id="mairVoiceLabButtons" class="grid2"></div><p id="mairVoiceLabInfo" class="muted" style="margin-top:10px"></p>';const version=pane.querySelector('.versionbox');pane.insertBefore(c,version||null);const box=$('mairVoiceLabButtons');for(const id of DJS){const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.voiceLab=id;b.textContent=`▶ ${id[0].toUpperCase()+id.slice(1)}`;b.addEventListener('click',()=>play(id));box.appendChild(b);inspect(id)}render();return c}
function render(){DJS.forEach(id=>{const b=document.querySelector(`[data-voice-lab="${id}"]`);if(b){b.disabled=!!active;b.textContent=active===id?`⏳ ${id[0].toUpperCase()+id.slice(1)}`:`▶ ${id[0].toUpperCase()+id.slice(1)}`}});const i=$('mairVoiceLabInfo');if(!i)return;if(lastError){i.textContent='Fout: '+lastError;return}const summary=DJS.map(id=>{const d=meta[id];return d?.cast?.label?`${id}: ${d.cast.label}`:`${id}: controleren…`}).join(' · ');i.textContent=summary}
function boot(){card();setTimeout(card,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRVoiceLab={version:'mair-voice-lab-v1',play,inspect,sample:SAMPLE,get status(){return{active,error:lastError,meta}}};
})();
