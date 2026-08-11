// Josh FM DJ context — local personality learning + privacy-conscious coarse location context.
(()=>{
  const LOC_KEY='jfm_location_context_v1',PREF_KEY='jfm_location_enabled',MENTION_KEY='jfm_location_last_mention';
  const $=id=>document.getElementById(id),now=()=>Date.now();
  let refreshing=false,lastError='';

  function loadLocation(){
    try{const x=JSON.parse(localStorage.getItem(LOC_KEY)||'null');if(!x||!x.name)return null;return x}catch{return null}
  }
  function saveLocation(x){
    if(!x?.name)return;
    // Store only coarse place context; never persist raw latitude/longitude.
    try{localStorage.setItem(LOC_KEY,JSON.stringify({name:x.name,region:x.region||'',country:x.country||'',at:now()}))}catch{}
  }
  function enabled(){return localStorage.getItem(PREF_KEY)==='1'}
  function setEnabled(on){try{localStorage.setItem(PREF_KEY,on?'1':'0')}catch{};render();if(on)refresh().catch(()=>{})}
  function safeText(s){return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}

  async function reversePlace(lat,lon){
    const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,{cache:'no-store'});
    if(!r.ok)throw new Error(`Location lookup HTTP ${r.status}`);
    const d=await r.json();
    const name=d.city||d.locality||d.principalSubdivision||d.countryName||'';
    if(!name)throw new Error('No coarse place name returned');
    return{name,region:d.principalSubdivision||'',country:d.countryName||''}
  }
  async function refresh(){
    if(refreshing||!enabled())return loadLocation();
    refreshing=true;lastError='';render();
    try{
      if(!navigator.geolocation)throw new Error('Location is not supported by this browser');
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:7000,maximumAge:30*60*1000}));
      const place=await reversePlace(pos.coords.latitude,pos.coords.longitude);saveLocation(place);render();return loadLocation()
    }catch(e){lastError=String(e?.message||e).slice(0,220);render();return null}
    finally{refreshing=false;render()}
  }
  function maybeRefresh(){const x=loadLocation();if(enabled()&&(!x||now()-Number(x.at||0)>60*60*1000))refresh().catch(()=>{})}
  function locationLine(){
    if(!enabled())return'';const x=loadLocation();if(!x?.name)return'';
    const last=Number(localStorage.getItem(MENTION_KEY)||0);if(now()-last<75*60*1000||Math.random()>.22)return'';
    try{localStorage.setItem(MENTION_KEY,String(now()))}catch{}
    const d=new Date().getHours();
    if(d<11)return`Good morning from ${x.name}.`;
    if(d>=23||d<5)return`Late night in ${x.name}, and Josh FM is still on.`;
    return`Right here in ${x.name}, this is Josh FM.`
  }

  function feedbackProfile(){
    let f={up:0,down:0,liked:[],disliked:[]};
    try{f={...f,...JSON.parse(localStorage.getItem('jfm_dj_feedback')||'{}')}}catch{}
    const up=Number(f.up||0),down=Number(f.down||0),total=up+down;
    const confidence=Math.min(1,total/12);
    return{up,down,total,confidence,positive:total?up/total:.5,avoid:(f.avoid||f.disliked||[]).slice(0,10)}
  }
  function repetitionRisk(text=''){
    const n=String(text).toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();if(!n)return 0;
    let recent=[];try{recent=window.JFMRadioClock?.recent?.()||[]}catch{}
    const head=n.split(' ').slice(0,7).join(' ');return recent.slice(0,12).some(x=>String(x).toLowerCase().includes(head))?1:0
  }
  function personality(){
    const p=feedbackProfile(),talk=Number(document.getElementById('talk')?.value||1);
    return{
      verbosity:talk<=0?'minimal':talk>=3?'high':'normal',
      positiveFeedback:p.positive,
      learned:p.confidence>=.35,
      avoid:p.avoid,
      location:enabled()?loadLocation():null
    }
  }

  function installCard(){
    if($('jfmLocationCard'))return;const pane=$('tab-settings');if(!pane)return;
    const card=document.createElement('article');card.className='card';card.id='jfmLocationCard';
    card.innerHTML='<div class="kicker">DJ CONTEXT</div><h3>Locatie voor de DJ</h3><label class="switch"><input id="jfmLocationToggle" type="checkbox"><span></span><b>Gebruik mijn plaats/regio</b></label><p id="jfmLocationStatus" class="muted">Locatie staat uit.</p><button id="jfmLocationRefresh" class="secondary" type="button">Ververs locatie</button><p class="muted">Josh FM bewaart alleen een grove plaats/regio, geen exacte GPS-coördinaten. De DJ noemt je locatie maar af en toe.</p>';
    const djCard=$('talk')?.closest('.card');if(djCard?.nextSibling)pane.insertBefore(card,djCard.nextSibling);else pane.appendChild(card);
    $('jfmLocationToggle').checked=enabled();$('jfmLocationToggle').addEventListener('change',e=>setEnabled(e.target.checked));$('jfmLocationRefresh').addEventListener('click',()=>refresh().catch(()=>{}));render()
  }
  function render(){
    const t=$('jfmLocationToggle'),s=$('jfmLocationStatus'),b=$('jfmLocationRefresh');if(t)t.checked=enabled();if(b)b.disabled=!enabled()||refreshing;
    if(!s)return;const x=loadLocation();
    if(!enabled())s.textContent='Locatie staat uit.';else if(refreshing)s.textContent='Locatie wordt bijgewerkt…';else if(x?.name)s.textContent=`DJ-context: ${x.name}${x.region&&x.region!==x.name?`, ${x.region}`:''}${x.country?` · ${x.country}`:''}`;else s.textContent=lastError?`Locatie niet beschikbaar: ${lastError}`:'Locatie is nog niet opgehaald.'
  }

  const oldMake=window.makeDJScript;
  if(typeof oldMake==='function')window.makeDJScript=makeDJScript=async function(...args){
    let text=await oldMake(...args);const loc=locationLine();
    // Avoid stacking a local line onto an already long or repetitive break.
    if(loc&&String(text).length<190&&!repetitionRisk(loc))text=`${loc} ${text}`.trim();
    window.jfmLastDJText=text;return text
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCard);else installCard();
  setInterval(maybeRefresh,15*60*1000);setTimeout(maybeRefresh,2500);
  window.JFMDJContext={version:'context-v1-location-personality',enabled,setEnabled,refresh,location:loadLocation,personality,feedbackProfile,repetitionRisk,get lastError(){return lastError}};
})();
