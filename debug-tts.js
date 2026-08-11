const voiceSelect=document.getElementById('voiceMode');
const info=document.getElementById('voiceInfo');
const FISH_VOICE_ID='b347db033a6549378b48d00acb0d06cd';
const FISH_VERSION='fish-audio-s2-pro-v1-20260811';
let selectedMode=localStorage.getItem('jfm_voice_mode')||'fish';
if(!['fish','device'].includes(selectedMode))selectedMode='fish';
let selectedLanguage='en';
function setDJLanguage(){selectedLanguage='en';localStorage.setItem('jfm_dj_language','en');window.JFMDJLanguage='en';return'en'}
window.JFMSetDJLanguage=setDJLanguage;setDJLanguage();
function currentHost(){return{voice:'Fish Audio',id:FISH_VOICE_ID,slot:0,start:0,end:24}}
window.JFMCurrentDJHost=currentHost;
if(voiceSelect){
  voiceSelect.innerHTML='<option value="fish">Fish Audio — English AI DJ</option><option value="device">iPhone English voice — fallback</option>';
  voiceSelect.value=selectedMode;
  localStorage.setItem('jfm_voice_mode',selectedMode);
  voiceSelect.onchange=()=>{
    selectedMode=voiceSelect.value;
    localStorage.setItem('jfm_voice_mode',selectedMode);
    try{const s=JSON.parse(localStorage.getItem('jfm_settings')||'{}');s.voiceMode=selectedMode;localStorage.setItem('jfm_settings',JSON.stringify(s))}catch{}
    if(info)info.textContent=selectedMode==='fish'?'Fish Audio selected — your English Josh FM DJ voice is active.':'iPhone English voice selected — used as fallback.';
  };
}
if(info)info.textContent='Fish Audio is the primary Josh FM voice. The iPhone English voice is the fallback.';
function localizeKnownJingle(text){
  const s=String(text||'').trim();
  const pairs=[
    ['Josh FM. Jouw muziek, jouw radioshow.','Josh FM. Your music, your radio show.'],
    ['Je luistert naar Josh FM.','You are listening to Josh FM.'],
    ['Dit is Josh FM.','This is Josh FM.'],
    ['Josh FM.','Josh FM.']
  ];
  for(const[nl,en]of pairs)if(s===nl||s===en)return en;
  return s;
}
window.JFMJingleText=(type='station')=>{
  const dict={station:['This is Josh FM.','You are listening to Josh FM.'],show:['Josh FM. Your music, your radio show.'],next:['Stay right here. More music is coming up next.']};
  const a=dict[type]||dict.station;return a[Math.floor(Math.random()*a.length)]
};
const AC=window.AudioContext||window.webkitAudioContext;
let djContext=AC?new AC():null,djGain=null,audioUnlocked=false,lastError='';
if(djContext){djGain=djContext.createGain();djGain.gain.value=1;djGain.connect(djContext.destination)}
async function unlockAudio(){
  try{
    if(djContext?.state==='suspended')await djContext.resume();
    if(djContext){const b=djContext.createBuffer(1,1,24000),s=djContext.createBufferSource();s.buffer=b;s.connect(djGain);s.start(0)}
    audioUnlocked=!!djContext&&djContext.state==='running';
  }catch{audioUnlocked=false}
  return audioUnlocked
}
document.addEventListener('pointerdown',unlockAudio,{capture:true});
document.addEventListener('touchstart',unlockAudio,{capture:true});
function bestEnglishVoice(){
  if(!('speechSynthesis'in window))return null;
  const voices=speechSynthesis.getVoices(),preferred=['Samantha','Daniel','Karen','Moira','Tessa','Alex'];
  for(const name of preferred){const v=voices.find(x=>x.name===name&&x.lang?.toLowerCase().startsWith('en'));if(v)return v}
  return voices.find(x=>x.lang?.toLowerCase()==='en-us')||voices.find(x=>x.lang?.toLowerCase()==='en-gb')||voices.find(x=>x.lang?.toLowerCase().startsWith('en'))||null
}
async function speakDevice(text,jingle=false){
  if(!('speechSynthesis'in window))return false;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=jingle?1.03:.97;u.pitch=jingle?1:.94;u.volume=1;
    const v=bestEnglishVoice();if(v)u.voice=v;
    if(info)info.textContent=`iPhone fallback — ${v?.name||u.lang}`;
    return await new Promise(resolve=>{let done=false;const finish=ok=>{if(done)return;done=true;resolve(ok)};u.onend=()=>finish(true);u.onerror=()=>finish(false);speechSynthesis.speak(u);setTimeout(()=>finish(false),30000)})
  }catch{return false}
}
async function playBlob(blob,label='Fish Audio'){
  if(!blob?.size)return false;
  try{
    if(djContext){
      if(djContext.state==='suspended')await djContext.resume();
      const arr=await blob.arrayBuffer(),buffer=await djContext.decodeAudioData(arr.slice(0)),source=djContext.createBufferSource();
      source.buffer=buffer;source.connect(djGain);if(info)info.textContent=`${label} playing ✓`;
      await new Promise((resolve,reject)=>{source.onended=resolve;try{source.start(0)}catch(e){reject(e)}});return true
    }
    const url=URL.createObjectURL(blob),audio=new Audio(url);await audio.play();await new Promise(resolve=>{audio.onended=resolve});URL.revokeObjectURL(url);return true
  }catch(e){lastError=String(e?.message||e).slice(0,220);return false}
}
async function fishAudio(text,jingle=false){
  try{
    if(info)info.textContent='Fish Audio is generating the DJ voice…';
    const r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(text||'').slice(0,1200),jingle:!!jingle})});
    if(!r.ok){
      let detail=`HTTP ${r.status}`;try{const d=await r.json();detail=d.detail||d.error||detail}catch{}
      throw new Error(detail)
    }
    const blob=await r.blob();if(!blob.size)throw new Error('Fish Audio returned empty audio');
    const ok=await playBlob(blob,'Fish Audio');if(!ok)throw new Error(lastError||'Audio playback failed');
    if(info)info.textContent='Fish Audio — Josh FM DJ ✓';return true
  }catch(e){lastError=String(e?.message||e).slice(0,240);if(info)info.textContent=`Fish Audio failed: ${lastError}. Using iPhone fallback.`;return false}
}
window.prepareSpeech=async()=>{await unlockAudio();return true};
window.speakText=async function(text,jingle=false){
  await unlockAudio();text=jingle?localizeKnownJingle(text):String(text||'');
  const mode=voiceSelect?.value||selectedMode;
  if(mode==='fish'&&await fishAudio(text,jingle))return true;
  return speakDevice(text,jingle)
};
window.JFMDJAudio={context:djContext,unlock:unlockAudio,getErrors:()=>lastError?[lastError]:[],version:FISH_VERSION,get language(){return'en'},get host(){return currentHost()}};
const testButton=document.getElementById('testVoice');
if(testButton)testButton.onclick=async()=>{
  testButton.disabled=true;const old=testButton.textContent;testButton.textContent='Stem laden…';await unlockAudio();
  const text='This is Josh FM. Your personal AI radio station is on air, with more music coming up next.';
  let ok=false;
  try{
    if((voiceSelect?.value||selectedMode)==='fish'){
      ok=await fishAudio(text,false);
      if(!ok)ok=await speakDevice(text,false)
    }else ok=await speakDevice(text,false);
  }finally{testButton.disabled=false;testButton.textContent=old}
  return ok
};