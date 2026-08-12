const voiceSelect=document.getElementById('voiceMode');
const info=document.getElementById('voiceInfo');
const FISH_VOICE_ID='b347db033a6549378b48d00acb0d06cd';
const FISH_VERSION='fish-audio-v6-ios-native';
const JFM_BUILD='audit-fish-v6';
const IS_IOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
let selectedLanguage='en';
const speechCache=new Map();
let lastError='',lastProvider='',lastModel='',lastVoiceTitle='',lastLatency=0,lastAudibleTestAt=0,lastPlaybackMode='',lastPlaybackAt=0;

function setDJLanguage(){selectedLanguage='en';localStorage.setItem('jfm_dj_language','en');window.JFMDJLanguage='en';return'en'}
window.JFMSetDJLanguage=setDJLanguage;setDJLanguage();
function currentHost(){return{voice:'Fish Audio',id:FISH_VOICE_ID,title:lastVoiceTitle||'Selected Fish voice',model:lastModel||'adaptive',slot:0,start:0,end:24}}
window.JFMCurrentDJHost=currentHost;
function setInfo(text,state=''){if(info){info.textContent=text;info.dataset.state=state}renderHealth()}

// Fish is the only automatic Josh FM DJ voice. Do not silently fall back to an iPhone/system voice.
if(voiceSelect){voiceSelect.innerHTML='<option value="fish">Fish Audio — selected English AI DJ</option>';voiceSelect.value='fish';voiceSelect.disabled=true;localStorage.setItem('jfm_voice_mode','fish')}
try{const s=JSON.parse(localStorage.getItem('jfm_settings')||'{}');s.voiceMode='fish';localStorage.setItem('jfm_settings',JSON.stringify(s))}catch{}
setInfo('Fish Audio is de enige Josh FM DJ-stem. Bij een storing blijft de muziek leidend.');

function localizeKnownJingle(text){const s=String(text||'').trim(),pairs=[['Josh FM. Jouw muziek, jouw radioshow.','Josh FM. Your music, your radio show.'],['Je luistert naar Josh FM.','You are listening to Josh FM.'],['Dit is Josh FM.','This is Josh FM.'],['Josh FM.','Josh FM.']];for(const[nl,en]of pairs)if(s===nl||s===en)return en;return s}
window.JFMJingleText=(type='station')=>{const dict={station:['This is Josh FM.','You are listening to Josh FM.'],show:['Josh FM. Your music, your radio show.'],next:['Stay right here. More music is coming up next.']},a=dict[type]||dict.station;return a[Math.floor(Math.random()*a.length)]};

const AC=window.AudioContext||window.webkitAudioContext;
let djContext=AC?new AC():null,djGain=null,webAudioUnlocked=false,mediaUnlocked=false;
if(djContext){djGain=djContext.createGain();djGain.gain.value=1;djGain.connect(djContext.destination)}
const mediaAudio=new Audio();mediaAudio.preload='auto';mediaAudio.playsInline=true;mediaAudio.setAttribute('playsinline','');mediaAudio.volume=1;
const SILENT='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACA';
async function primeMedia(){if(mediaUnlocked)return true;try{mediaAudio.src=SILENT;mediaAudio.currentTime=0;const p=mediaAudio.play();if(p?.then)await p;mediaAudio.pause();mediaAudio.removeAttribute('src');mediaAudio.load();mediaUnlocked=true;return true}catch{return false}}
async function unlockAudio(){
  try{if(djContext?.state==='suspended')await djContext.resume();if(djContext){const b=djContext.createBuffer(1,1,24000),s=djContext.createBufferSource();s.buffer=b;s.connect(djGain);s.start(0)}webAudioUnlocked=!!djContext&&djContext.state==='running'}catch{webAudioUnlocked=false}
  await primeMedia().catch(()=>false);renderHealth();return webAudioUnlocked||mediaUnlocked
}
for(const ev of ['pointerdown','touchstart','click'])document.addEventListener(ev,()=>{unlockAudio().catch(()=>{})},{capture:true,passive:true});

function cacheKey(text,jingle){return`${jingle?'j':'s'}|${String(text||'').trim()}`}
async function checkFishHealth(){try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);let r;try{r=await fetch('/api/tts',{method:'GET',cache:'no-store',signal:c.signal})}finally{clearTimeout(timer)}const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.voice?.detail||d?.detail||d?.error||`HTTP ${r.status}`);lastVoiceTitle=d?.voice?.title||lastVoiceTitle;lastError='';lastProvider='fish';renderHealth();return d}catch(e){lastError=e?.name==='AbortError'?'Fish health check timed out':String(e?.message||e);renderHealth();throw new Error(lastError)}}
async function fetchFish(text,jingle=false){
  const started=performance.now(),c=new AbortController(),timer=setTimeout(()=>c.abort(),18000);let r;
  try{r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(text||'').slice(0,1200),jingle:!!jingle}),signal:c.signal})}catch(e){if(e?.name==='AbortError')throw new Error('Fish Audio timed out');throw e}finally{clearTimeout(timer)}
  if(!r.ok){let detail=`HTTP ${r.status}`;try{const d=await r.json();const attempts=Array.isArray(d?.attempts)?d.attempts.map(x=>`${x.model}: ${x.status}${x.detail?` ${x.detail}`:''}`).join(' | '):'';detail=attempts||d?.detail||d?.error||detail}catch{}throw new Error(detail)}
  const provider=r.headers.get('X-JoshFM-TTS')||'',voice=r.headers.get('X-JoshFM-Voice')||'';lastModel=r.headers.get('X-JoshFM-Fish-Model')||'';lastLatency=Number(r.headers.get('X-JoshFM-TTS-MS')||Math.round(performance.now()-started));
  if(provider!=='fish-audio')throw new Error(`Unexpected TTS provider: ${provider||'unknown'}`);if(voice&&voice!==FISH_VOICE_ID)throw new Error(`Unexpected Fish voice ID: ${voice}`);
  const blob=await r.blob();if(!blob.size)throw new Error('Fish Audio returned empty audio');lastProvider='fish';lastError='';renderHealth();return{blob,model:lastModel,voice:voice||FISH_VOICE_ID,ms:lastLatency}
}
async function playWithMediaElement(blob,label){
  const url=URL.createObjectURL(blob);try{await primeMedia().catch(()=>false);mediaAudio.pause();mediaAudio.src=url;mediaAudio.currentTime=0;mediaAudio.volume=1;setInfo(`${label} ON AIR ✓`,'onair');await mediaAudio.play();await new Promise((resolve,reject)=>{let done=false;const finish=e=>{if(done)return;done=true;mediaAudio.onended=null;mediaAudio.onerror=null;clearTimeout(timer);e?reject(e):resolve()};const timer=setTimeout(()=>finish(new Error('Fish Audio playback timed out')),45000);mediaAudio.onended=()=>finish();mediaAudio.onerror=()=>finish(new Error('Browser could not play Fish Audio'))});lastPlaybackMode='html-audio';lastPlaybackAt=Date.now();return true}finally{mediaAudio.pause();mediaAudio.removeAttribute('src');mediaAudio.load();URL.revokeObjectURL(url)}}
async function playWithWebAudio(blob,label){if(!djContext)throw new Error('Web Audio unavailable');if(djContext.state==='suspended')await djContext.resume();const arr=await blob.arrayBuffer(),buffer=await djContext.decodeAudioData(arr.slice(0)),source=djContext.createBufferSource();source.buffer=buffer;source.connect(djGain);setInfo(`${label} ON AIR ✓`,'onair');await new Promise((resolve,reject)=>{source.onended=resolve;try{source.start(0)}catch(e){reject(e)}});lastPlaybackMode='web-audio';lastPlaybackAt=Date.now();return true}
async function playBlob(blob,label='Fish Audio'){
  if(!blob?.size)return false;let firstError='';
  // Safari/iOS is most reliable when the actual MP3 uses a media element unlocked by a real tap.
  const paths=IS_IOS?[playWithMediaElement,playWithWebAudio]:[playWithWebAudio,playWithMediaElement];
  for(const fn of paths){try{const ok=await fn(blob,label);if(ok){lastError='';renderHealth();return true}}catch(e){if(!firstError)firstError=String(e?.message||e)}}
  lastError=firstError||'Fish audio playback failed';renderHealth();return false
}
async function prepareFish(text,jingle=false){const key=cacheKey(text,jingle);if(speechCache.has(key))return speechCache.get(key);const promise=fetchFish(text,jingle).catch(e=>{speechCache.delete(key);throw e});speechCache.set(key,promise);renderHealth();return promise}
async function fishAudio(text,jingle=false){try{setInfo('Fish Audio is preparing the selected DJ voice…','preparing');const key=cacheKey(text,jingle),pack=await(speechCache.get(key)||prepareFish(text,jingle));speechCache.delete(key);const ok=await playBlob(pack.blob,'Fish Audio');if(!ok)throw new Error(lastError||'Fish audio playback failed');setInfo(`Fish Audio ✓ ${lastVoiceTitle?lastVoiceTitle+' · ':''}${pack.model||'model'} · ${pack.ms||0} ms`,'ready');return true}catch(e){lastError=String(e?.message||e).slice(0,320);setInfo(`Fish Audio failed: ${lastError}`,'error');return false}}
window.prepareSpeech=async(text='',jingle=false)=>{await unlockAudio();if(!String(text||'').trim())return false;try{await prepareFish(jingle?localizeKnownJingle(text):String(text),jingle);setInfo('Fish Audio DJ break is pre-generated ✓','prepared');return true}catch(e){lastError=String(e?.message||e);setInfo(`Fish pre-generation failed: ${lastError}`,'error');return false}};
window.speakText=async function(text,jingle=false){await unlockAudio();text=jingle?localizeKnownJingle(text):String(text||'');if(!text.trim())return false;return fishAudio(text,jingle)};
window.JFMDJAudio={context:djContext,unlock:unlockAudio,health:checkFishHealth,prepare:prepareFish,getErrors:()=>lastError?[lastError]:[],get status(){return{provider:lastProvider,model:lastModel,voiceId:FISH_VOICE_ID,voiceTitle:lastVoiceTitle,latencyMs:lastLatency,error:lastError,cacheSize:speechCache.size,audioUnlocked:webAudioUnlocked||mediaUnlocked,webAudioUnlocked,mediaUnlocked,playbackMode:lastPlaybackMode,lastPlaybackAt,build:JFM_BUILD,lastAudibleTestAt}},version:FISH_VERSION,get language(){return'en'},get host(){return currentHost()}};window.JFMBuild=JFM_BUILD;

function installHealthCard(){if(document.getElementById('jfmHealthCard'))return;const settingsPane=document.getElementById('tab-settings');if(!settingsPane)return;const voiceCard=voiceSelect?.closest('.card'),card=document.createElement('article');card.className='card';card.id='jfmHealthCard';card.innerHTML='<div class="kicker">STATION HEALTH</div><div class="row between"><h3 style="margin:0">Josh FM status</h3><span id="jfmHealthBadge" class="accent">CHECKING</span></div><div id="jfmHealthRows" class="muted" style="margin-top:10px;line-height:1.7"></div><button id="jfmHealthRefresh" class="secondary" type="button">Check Fish Audio</button>';if(voiceCard?.nextSibling)settingsPane.insertBefore(card,voiceCard.nextSibling);else settingsPane.appendChild(card);document.getElementById('jfmHealthRefresh')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Checking…';try{await checkFishHealth()}catch{}finally{b.disabled=false;b.textContent='Check Fish Audio';renderHealth()}});renderHealth()}
function renderHealth(){const rows=document.getElementById('jfmHealthRows'),badge=document.getElementById('jfmHealthBadge');if(!rows||!badge)return;const healthy=lastProvider==='fish'&&!lastError;badge.textContent=lastError?'ERROR':healthy?'READY':'UNKNOWN';const safe=s=>String(s||'—').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));rows.innerHTML=`<div><b>Primary voice:</b> Fish Audio</div><div><b>Voice:</b> ${safe(lastVoiceTitle||FISH_VOICE_ID)}</div><div><b>Model:</b> ${safe(lastModel||'adaptive')}</div><div><b>TTS latency:</b> ${lastLatency?`${lastLatency} ms`:'—'}</div><div><b>Audio unlocked:</b> ${webAudioUnlocked||mediaUnlocked?'yes':'not yet'}</div><div><b>Playback route:</b> ${safe(lastPlaybackMode||'not used yet')}</div><div><b>Prepared breaks:</b> ${speechCache.size}</div><div><b>Audible test:</b> ${lastAudibleTestAt?`passed ${new Date(lastAudibleTestAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`:'not run yet'}</div><div><b>Build:</b> ${JFM_BUILD}</div>${lastError?`<div><b>Last error:</b> ${safe(lastError)}</div>`:''}`}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHealthCard);else installHealthCard();setInterval(renderHealth,3000);
const testButton=document.getElementById('testVoice');if(testButton)testButton.onclick=async()=>{testButton.disabled=true;const old=testButton.textContent;testButton.textContent='Luistertest bezig…';await unlockAudio();const text='This is Josh FM. If you can hear this voice, the DJ audio test is working correctly.';let ok=false;try{const h=await checkFishHealth();setInfo(`Fish connected ✓ ${h?.voice?.title||'selected voice'} · playing audible test…`,'checking');ok=await window.speakText(text,false);if(ok){lastAudibleTestAt=Date.now();setInfo(`✓ Stem hoorbaar getest — ${lastVoiceTitle||'Fish Audio'} werkt via ${lastPlaybackMode||'audio'}.`,'ready')}else setInfo(`Fish test FAILED — ${lastError||'audio was not completed'}.`,'error')}catch(e){lastError=String(e?.message||e);setInfo(`Fish test FAILED — ${lastError}.`,'error')}finally{testButton.disabled=false;testButton.textContent=old;renderHealth()}return ok};
