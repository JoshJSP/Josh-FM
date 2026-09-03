// Josh FM DJ context — local personality learning + privacy-conscious coarse location context.
(()=>{
  const LOC_KEY='jfm_location_context_v1',PREF_KEY='jfm_location_enabled',MENTION_KEY='jfm_location_last_mention';
  const $=id=>document.getElementById(id),now=()=>Date.now();
  let refreshing=false,lastError='',weatherMemo={at:0,data:null};

  function loadLocation(){try{const x=JSON.parse(localStorage.getItem(LOC_KEY)||'null');if(!x||!x.name)return null;return x}catch{return null}}
  function saveLocation(x){if(!x?.name)return;try{localStorage.setItem(LOC_KEY,JSON.stringify({name:x.name,region:x.region||'',country:x.country||'',at:now()}))}catch{}}
  function enabled(){return localStorage.getItem(PREF_KEY)==='1'}
  function setEnabled(on){try{localStorage.setItem(PREF_KEY,on?'1':'0')}catch{};render();if(on)refresh().catch(()=>{})}

  async function reversePlace(lat,lon){
    const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,{cache:'no-store'});
    if(!r.ok)throw new Error(`Location lookup HTTP ${r.status}`);
    const d=await r.json(),name=d.city||d.locality||d.principalSubdivision||d.countryName||'';
    if(!name)throw new Error('No coarse place name returned');
    return{name,region:d.principalSubdivision||'',country:d.countryName||''}
  }
  async function getPosition(){
    if(!navigator.geolocation)throw new Error('Location is not supported by this browser');
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:7000,maximumAge:30*60*1000}))
  }
  async function refresh(){
    if(refreshing||!enabled())return loadLocation();refreshing=true;lastError='';render();
    try{const pos=await getPosition(),place=await reversePlace(pos.coords.latitude,pos.coords.longitude);saveLocation(place);render();return loadLocation()}
    catch(e){lastError=String(e?.message||e).slice(0,220);render();return null}
    finally{refreshing=false;render()}
  }
  function maybeRefresh(){const x=loadLocation();if(enabled()&&(!x||now()-Number(x.at||0)>60*60*1000))refresh().catch(()=>{})}
  function locationLine(){
    if(!enabled())return'';const x=loadLocation();if(!x?.name)return'';
    const last=Number(localStorage.getItem(MENTION_KEY)||0);if(now()-last<75*60*1000||Math.random()>.22)return'';
    try{localStorage.setItem(MENTION_KEY,String(now()))}catch{}
    const h=new Date().getHours();if(h<11)return`Good morning from ${x.name}.`;if(h>=23||h<5)return`Late night in ${x.name}, and Josh FM is still on.`;return`Right here in ${x.name}, this is Josh FM.`
  }

  function feedbackProfile(){
    let f={up:0,down:0,liked:[],disliked:[]};try{f={...f,...JSON.parse(localStorage.getItem('jfm_dj_feedback')||'{}')}}catch{}
    const up=Number(f.up||0),down=Number(f.down||0),total=up+down,confidence=Math.min(1,total/12);
    return{up,down,total,confidence,positive:total?up/total:.5,avoid:(f.avoid||f.disliked||[]).slice(0,10)}
  }
  function normalized(s=''){return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
  function repetitionRisk(text=''){
    const n=normalized(text);if(!n)return 0;let recent=[];try{recent=window.JFMRadioClock?.recent?.()||[]}catch{}
    const head=n.split(' ').slice(0,7).join(' ');return recent.slice(0,12).some(x=>normalized(x).includes(head))?1:0
  }
  function dislikedRisk(text=''){
    const n=normalized(text),avoid=feedbackProfile().avoid.map(normalized).filter(Boolean);if(!n||!avoid.length)return 0;
    return avoid.some(x=>{const head=x.split(' ').slice(0,7).join(' ');return head&&n.includes(head)})?1:0
  }
  function personality(){
    const p=feedbackProfile(),talk=Number(document.getElementById('talk')?.value||1);
    return{verbosity:talk<=0?'minimal':talk>=3?'high':'normal',positiveFeedback:p.positive,learned:p.confidence>=.35,avoid:p.avoid,location:enabled()?loadLocation():null}
  }
  function adaptText(text=''){
    let out=String(text||'').trim(),p=feedbackProfile();if(!out)return out;
    // Repeated negative feedback makes normal breaks tighter, without changing important request/hour IDs.
    if(p.confidence>=.35&&p.positive<.42&&out.length>145){const first=(out.match(/[^.!?]+[.!?]/)||[])[0];if(first&&first.length>30)out=first.trim()}
    if(dislikedRisk(out)||repetitionRisk(out)){
      const alternatives=['Josh FM. More music next.','This is Josh FM. Let’s keep it moving.','Josh FM, on air.'];
      out=alternatives[Math.floor(Math.random()*alternatives.length)]
    }
    return out
  }

  // Replace the older weather/location lookup with one that never stores coordinate-derived cache keys.
  window.getWeather=getWeather=async function(){
    if(!document.getElementById('weatherMention')?.checked)return null;
    if(weatherMemo.data&&now()-weatherMemo.at<20*60*1000)return weatherMemo.data;
    try{
      const pos=await getPosition(),lat=pos.coords.latitude,lon=pos.coords.longitude;
      const [wr,place]=await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code&timezone=auto`,{cache:'no-store'}),
        enabled()?(loadLocation()||reversePlace(lat,lon)):null
      ]);
      const d=await wr.json(),temp=Math.round(d.current?.temperature_2m);
      const coarse=place?.name||loadLocation()?.name||'';
      if(enabled()&&place?.name&&!loadLocation())saveLocation(place);
      const data=Number.isFinite(temp)?{temperature:temp,code:d.current?.weather_code,location:coarse}:null;weatherMemo={at:now(),data};return data
    }catch{return null}
  };

  function installCard(){
    if($('jfmLocationCard'))return;const pane=$('tab-settings');if(!pane)return;
    const card=document.createElement('article');card.className='card';card.id='jfmLocationCard';
    card.innerHTML='<div class="kicker">DJ CONTEXT</div><h3>Locatie voor de DJ</h3><label class="switch"><input id="jfmLocationToggle" type="checkbox"><span></span><b>Gebruik mijn plaats/regio</b></label><p id="jfmLocationStatus" class="muted">Locatie staat uit.</p><button id="jfmLocationRefresh" class="secondary" type="button">Ververs locatie</button><p class="muted">MAIR bewaart alleen een grove plaats/regio, geen exacte GPS-coördinaten. De DJ noemt je locatie maar af en toe.</p>';
    const djCard=$('talk')?.closest('.card');if(djCard?.nextSibling)pane.insertBefore(card,djCard.nextSibling);else pane.appendChild(card);
    $('jfmLocationToggle').checked=enabled();$('jfmLocationToggle').addEventListener('change',e=>setEnabled(e.target.checked));$('jfmLocationRefresh').addEventListener('click',()=>refresh().catch(()=>{}));render()
  }
  function render(){
    const t=$('jfmLocationToggle'),s=$('jfmLocationStatus'),b=$('jfmLocationRefresh');if(t)t.checked=enabled();if(b)b.disabled=!enabled()||refreshing;if(!s)return;const x=loadLocation();
    if(!enabled())s.textContent='Locatie staat uit.';else if(refreshing)s.textContent='Locatie wordt bijgewerkt…';else if(x?.name)s.textContent=`DJ-context: ${x.name}${x.region&&x.region!==x.name?`, ${x.region}`:''}${x.country?` · ${x.country}`:''}`;else s.textContent=lastError?`Locatie niet beschikbaar: ${lastError}`:'Locatie is nog niet opgehaald.'
  }

  const oldMake=window.makeDJScript;
  if(typeof oldMake==='function')window.makeDJScript=makeDJScript=async function(...args){
    let text=adaptText(await oldMake(...args)),loc=locationLine();if(loc&&text.length<190&&!repetitionRisk(loc))text=`${loc} ${text}`.trim();window.jfmLastDJText=text;return text
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCard);else installCard();
  setInterval(maybeRefresh,15*60*1000);setTimeout(maybeRefresh,2500);
  window.JFMDJContext={version:'context-v2-location-personality',enabled,setEnabled,refresh,location:loadLocation,personality,feedbackProfile,repetitionRisk,dislikedRisk,adaptText,get lastError(){return lastError}};
})();
