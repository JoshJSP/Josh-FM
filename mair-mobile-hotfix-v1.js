(()=>{
'use strict';
if(window.__MAIRMobileHotfixV1)return;
window.__MAIRMobileHotfixV1=true;
const $=id=>document.getElementById(id);
const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
if(isIOS)document.documentElement.classList.add('mair-ios');

function installStyle(){
  if($('mairMobileHotfixStyle'))return;
  const style=document.createElement('style');
  style.id='mairMobileHotfixStyle';
  style.textContent=`
    /* The legacy live surface duplicates the MAIR now-playing header. */
    #jfmLiveMeta{display:none!important}
    .mair-ios .top{padding-top:calc(env(safe-area-inset-top) + 12px)!important}
    .mair-ios .shell{padding-top:0!important}
    @media(max-width:520px){
      #showMini{display:none!important}
      .mair-live-strip{gap:8px!important;min-width:0}
      .mair-live-strip>*{min-width:0}
      .mair-track-title{overflow-wrap:anywhere}
    }
    .mair-station-art{background-image:none!important;position:relative;overflow:hidden;display:grid!important;place-items:center;color:#fff;font-weight:950;letter-spacing:-.04em;text-align:center;font-size:18px;line-height:.95}
    .mair-station-art::after{content:attr(data-label);position:relative;z-index:2;text-shadow:0 2px 16px rgba(0,0,0,.55)}
    .mair-station-art::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.18),transparent 35%),linear-gradient(145deg,#3d1708,#120a07 65%,#090807);z-index:1}
    .mair-station-art.art-hits::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.18),transparent 35%),linear-gradient(145deg,#ff5a00,#6b1600 58%,#160704)}
    .mair-station-art.art-throwback::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.18),transparent 35%),linear-gradient(145deg,#7a451e,#26150b 62%,#0d0907)}
    .mair-station-art.art-chill::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.16),transparent 35%),linear-gradient(145deg,#233c4c,#17232c 60%,#0b0d0f)}
    .mair-station-art.art-party::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.17),transparent 35%),linear-gradient(145deg,#6d174e,#28102c 60%,#0d080d)}
    .mair-station-art.art-new::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.17),transparent 35%),linear-gradient(145deg,#274924,#142314 60%,#090d09)}
    .mair-station-art.art-mix::before{background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.18),transparent 35%),linear-gradient(145deg,#ff6a12,#351305 62%,#0e0907)}
  `;
  document.head.appendChild(style);
}

function repairBrandAndRadio(){
  document.querySelectorAll('#jfmLiveMeta').forEach(x=>x.remove());
  const statusTitle=$('jfmHealthCard')?.querySelector('h3');if(statusTitle)statusTitle.textContent='MAIR status';
  const showMini=$('showMini');if(showMini&&/Josh FM/i.test(showMini.textContent))showMini.textContent=showMini.textContent.replace(/Josh FM/gi,'MAIR');
  const detail=$('jfmDJDetail');if(detail)detail.textContent=String(detail.textContent||'').replace(/Josh FM/gi,'MAIR');
  const mode=($('modeMini')?.textContent||$('modeLabel')?.textContent||'').trim();
  if(mode&&$('mairRadioMode'))$('mairRadioMode').textContent=mode;
  const fallback=$('artFallback');if(fallback)fallback.textContent='MAIR';
  document.querySelectorAll('.mair-station-art').forEach(el=>{
    const card=el.closest('[data-mair-station]');
    const id=card?.dataset?.mairStation||'';
    const labels={mix:'MY\nMAIR',hits:'HITS',throwback:'THROW\nBACK',chill:'CHILL',party:'PARTY',new:'NEW'};
    el.dataset.label=labels[id]||'MAIR';
    el.setAttribute('aria-hidden','true');
  });
}

const speechCache=new Map();
const cacheKey=(text,jingle,profile)=>`${profile}|${jingle?'j':'s'}|${String(text||'').trim()}`;
function profile(){return window.MAIRDJProfiles?.current?.id||window.MAIRCurrentDJ?.id||localStorage.getItem('mair_dj_profile_v1')||'josh'}
function cleanSpeech(text){return String(text||'').trim().replace(/Josh\s*FM/gi,'MAIR FM').replace(/JoshFM/gi,'MAIR')}
async function fetchFish(text,jingle=false){
  const djProfile=profile(),r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:cleanSpeech(text),jingle:!!jingle,djProfile})});
  if(!r.ok){let detail=`HTTP ${r.status}`;try{const d=await r.json();detail=d?.detail||d?.error||detail;if(Array.isArray(d?.attempts)&&d.attempts.length)detail=d.attempts.map(x=>`${x.model}: ${x.status}${x.detail?` ${x.detail}`:''}`).join(' | ')}catch{}throw new Error(detail)}
  const blob=await r.blob();if(!blob.size)throw new Error('Fish Audio gaf geen audio terug.');
  return{blob,model:r.headers.get('X-JoshFM-Fish-Model')||'',voice:r.headers.get('X-JoshFM-Voice')||'',profile:r.headers.get('X-MAIR-DJ')||djProfile,latency:Number(r.headers.get('X-JoshFM-TTS-MS')||0)};
}
async function playBlob(blob){
  await window.JFMDJAudio?.unlock?.().catch?.(()=>{});
  const ctx=window.JFMDJAudio?.context;
  if(ctx){try{if(ctx.state==='suspended')await ctx.resume();const arr=await blob.arrayBuffer(),buf=await ctx.decodeAudioData(arr.slice(0)),src=ctx.createBufferSource();src.buffer=buf;src.connect(ctx.destination);await new Promise((resolve,reject)=>{src.onended=resolve;try{src.start(0)}catch(e){reject(e)}});return true}catch{}}
  const url=URL.createObjectURL(blob);try{const a=new Audio();a.preload='auto';a.playsInline=true;a.setAttribute('playsinline','');a.src=url;await a.play();await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Browser kon Fish Audio niet afspelen.'))});return true}finally{URL.revokeObjectURL(url)}
}
async function prepare(text,jingle=false){
  text=cleanSpeech(text);if(!text)return false;const k=cacheKey(text,jingle,profile());try{speechCache.set(k,await fetchFish(text,jingle));return true}catch(e){speechCache.delete(k);throw e}
}
async function speak(text,jingle=false){
  text=cleanSpeech(text);if(!text)return false;const k=cacheKey(text,jingle,profile());try{const pack=speechCache.get(k)||await fetchFish(text,jingle);speechCache.delete(k);return await playBlob(pack.blob)}catch(e){console.warn('MAIR Fish Audio',e);return false}
}
function setVoiceInfo(text,state=''){const el=$('voiceInfo');if(el){el.textContent=text;el.dataset.state=state}}
function localizeHealth(){
  const card=$('jfmHealthCard');if(!card)return;
  const title=card.querySelector('h3');if(title)title.textContent='MAIR status';
  const badge=$('jfmHealthBadge');if(badge){const map={CHECKING:'CONTROLEREN',UNKNOWN:'ONBEKEND',READY:'GEREED',ERROR:'FOUT'};badge.textContent=map[badge.textContent]||badge.textContent}
  const button=$('jfmHealthRefresh');if(button&&!button.disabled)button.textContent='Controleer Fish Audio';
  const rows=$('jfmHealthRows');if(rows){
    const replacements=[
      ['Primary voice:','Primaire stem:'],['Voice:','Stem:'],['Model:','Model:'],['TTS latency:','TTS-latentie:'],['Audio unlocked:','Audio vrijgegeven:'],['Playback route:','Afspeelroute:'],['Prepared breaks:','Voorbereide breaks:'],['Audible test:','Hoorbare test:'],['Build:','Build:'],['Last error:','Laatste fout:'],['not yet','nog niet'],['not used yet','nog niet gebruikt'],['not run yet','nog niet uitgevoerd'],['passed ','geslaagd ']
    ];
    rows.querySelectorAll('div').forEach(div=>{let html=div.innerHTML;for(const[a,b]of replacements)html=html.replaceAll(a,b);if(html!==div.innerHTML)div.innerHTML=html});
  }
}
function repairVoice(){
  localStorage.setItem('jfm_dj_language','nl');window.JFMDJLanguage='nl';window.JFMSetDJLanguage=()=>{localStorage.setItem('jfm_dj_language','nl');window.JFMDJLanguage='nl';return'nl'};
  window.JFMJingleText=(type='station')=>{const dict={station:['Dit is MAIR.','Je luistert naar MAIR.'],show:['MAIR. Jouw muziek, jouw radio.'],next:['Blijf luisteren. Straks meer muziek op MAIR.']},a=dict[type]||dict.station;return a[Math.floor(Math.random()*a.length)]};
  const select=$('voiceMode');if(select){select.innerHTML='<option value="fish">Fish Audio — Nederlandse MAIR DJ</option>';select.value='fish';select.disabled=true}
  const info=$('voiceInfo');if(info&&(/Josh FM/i.test(info.textContent)||/English/i.test(info.textContent)||/enige DJ-stem/i.test(info.textContent)))setVoiceInfo('Fish Audio gebruikt de Nederlandse MAIR DJ-stem. Bij een storing wordt de break overgeslagen en blijft de muziek spelen.');
  window.prepareSpeech=prepare;window.speakText=speak;
  window.MAIRVoiceEngine?.register?.('fish',{prepare,speak,health:()=>window.JFMDJAudio?.status||null});
  if(window.JFMDJAudio){try{Object.defineProperty(window.JFMDJAudio,'language',{configurable:true,get:()=> 'nl'})}catch{}}
  const btn=$('testVoice');if(btn){btn.onclick=async()=>{const old=btn.textContent;btn.disabled=true;btn.textContent='Luistertest bezig…';setVoiceInfo('Fish Audio maakt een Nederlandse MAIR-test klaar…','preparing');try{await window.JFMDJAudio?.unlock?.();const ok=await speak('Dit is MAIR. Als je deze stem hoort, werkt de DJ-audio goed.',false);setVoiceInfo(ok?'✓ Stem hoorbaar getest — Fish Audio werkt.':'Fish Audio-test mislukt — audio kon niet worden afgespeeld.',ok?'ready':'error');return ok}catch(e){setVoiceInfo(`Fish Audio-test mislukt — ${String(e?.message||e)}.`,'error');return false}finally{btn.disabled=false;btn.textContent=old;localizeHealth()}}}
  localizeHealth();
}

function install(){installStyle();repairBrandAndRadio();repairVoice();const target=$('jfmHealthCard');if(target)new MutationObserver(()=>localizeHealth()).observe(target,{subtree:true,childList:true,characterData:true});setInterval(()=>{repairBrandAndRadio();repairVoice();localizeHealth()},2000);window.MAIRMobileHotfix={version:'mair-mobile-hotfix-v1.1-nl',repair:repairBrandAndRadio,prepareSpeech:prepare,speakText:speak,localizeHealth}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
