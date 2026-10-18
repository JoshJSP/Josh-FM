// MAIR Car Mode ritstart: start je een route, dan kondigt de DJ de rit aan voordat het eerste nummer begint.
// "We zijn onderweg naar X, de rit duurt ongeveer Y en we beginnen met Z van A." Het lopende nummer stopt
// daarvoor (keuze van Josh, 17-10-2026), daarna start Z vanaf het begin. Nieuwe bestemming tijdens de rit:
// alleen bestemming en duur, en het lopende nummer gaat daarna verder. DJ uit of al iemand aan het woord: niks.
(()=>{
'use strict';
if(window.MAIRCarRideDJ)return;
const PLACES='mair_car_places_v1',REPLAN_WAIT_MS=10000;
let busy=false,lastDest=null,lastText='',lastError='',lastAt=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const truth=()=>window.JFMPlaybackState?.get?.()||null;
const hav=(a,b)=>{const R=6371000,r=x=>x*Math.PI/180,dl=r(b.latitude-a.latitude),dn=r(b.longitude-a.longitude),h=Math.sin(dl/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const near=(a,b)=>!!a&&!!b&&Number.isFinite(+a.latitude)&&Number.isFinite(+b.latitude)&&hav(a,b)<30;
const quiet=()=>{try{return !!window.MAIRStationPolicy?.quiet?.(localStorage.getItem('jfm_music_channel_v1')||'mix')}catch{return false}};
const djOn=()=>window.MAIR_DJ_ENABLED===true&&!quiet();
// Opgeslagen plekken (Thuis, School...) bewaart Car Mode in mair_car_places_v1 als {saved:[{name,latitude,longitude}]}.
function savedName(d){try{const saved=JSON.parse(localStorage.getItem(PLACES)||'{}').saved||[];return saved.find(p=>near(p,d))?.name||''}catch{return''}}
// Mapbox geeft "Oudegracht 12, 3511 AB Utrecht, Nederland". Uitgesproken: "Oudegracht in Utrecht".
function spokenPlace(d={}){
  const own=savedName(d);if(own)return own;
  const parts=String(d.address||'').split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^(nederland|netherlands)$/i.test(x));
  const street=String(parts[0]||d.name||'').replace(/\s+\d+[\w-]*(\s+[a-z])?$/i,'').trim();
  const city=(parts.slice(1).find(x=>/[a-z]/i.test(x))||'').replace(/^\d{4}\s*[a-z]{2}\s*/i,'').replace(/^\d{4}\s*/,'').trim();
  const name=String(d.name||'').trim(),poi=name&&parts[0]&&!parts[0].toLowerCase().startsWith(name.toLowerCase())&&!/\d/.test(name);
  if(poi)return city&&!name.toLowerCase().includes(city.toLowerCase())?`${name} in ${city}`:name;
  if(street&&city&&street.toLowerCase()!==city.toLowerCase())return`${street} in ${city}`;
  return street||city||'je bestemming';
}
function spokenDuration(sec){
  const m=Math.max(1,Math.round(Number(sec||0)/60));
  if(m<=60)return m===1?'1 minuut':`${m} minuten`;
  const h=Math.floor(m/60),r=m%60,hs=`${h} uur`;
  return r?`${hs} en ${r} ${r===1?'minuut':'minuten'}`:hs;
}
const artists=t=>(t?.artists||[]).map(a=>a?.name||a).filter(Boolean).slice(0,2).join(' en ');
function line({destination,duration,track,change}){
  const where=spokenPlace(destination),dur=spokenDuration(duration);
  if(change)return`Nieuwe bestemming: we gaan naar ${where}, nog ongeveer ${dur}.`;
  const song=track?.name?` en we beginnen met ${track.name}${artists(track)?` van ${artists(track)}`:''}`:'';
  return`We zijn onderweg naar ${where}, de rit duurt ongeveer ${dur}${song}.`;
}
// Uurnieuws dat klaarstaat houdt de ritstart niet tegen (keuze van Josh, 17-10-2026): het wacht op de lock
// en komt pas na het eerste ritnummer, want het nieuws airt alleen bij een natuurlijk einde.
function someoneTalking(mine=null){const d=window.MAIRDJ?.diagnostics?.()||{},lock=window.MAIRAudioTransitionLock;return!!(window.MAIRDJ?.busy||['HANDOFF','SPEAKING','RESTORING'].includes(d.phase)||window.MAIRNewsBulletin?.airing||lock?.breakId&&lock!==mine)}
// Het eerste nummer van de rit: wat na het lopende nummer in de wachtrij staat nadat de journey-director herplande.
function waitReplan(){return new Promise(res=>{const done=()=>{clearTimeout(t);removeEventListener('mair:director-replanned',on);res()},on=e=>{if(/journey/.test(String(e.detail?.reason||'')))done()},t=setTimeout(done,REPLAN_WAIT_MS);addEventListener('mair:director-replanned',on)})}
function firstRideTrack(){const q=window.JFMQueue?.current?.()||[],id=String(truth()?.trackId||''),i=q.findIndex(t=>t?.id===id);return q[i+1]||null}
async function announce(detail={}){
  const change=!!detail.change,dest=detail.destination;
  if(busy||!dest||!djOn()||document.visibilityState==='hidden')return false;
  if(change&&near(dest,lastDest))return false;
  if(someoneTalking())return false;
  // De lock gaat er meteen bij de routestart op: zo stuurt de herplanning geen play naar Spotify terwijl wij gaan pauzeren.
  // Die play kwam op de iPhone soms pas aan als de DJ al praatte: de Spotify-app nam de audio over en de stem brak af.
  // Wat de director daardoor niet naar Spotify stuurde (held), sturen we na afloop alsnog.
  busy=true;let op=0,paused=false,uri='',error='',track=null,started=false,heldAt=0,nextAt=0;const lock={breakId:'car-ride',acquiredAt:Date.now()};
  window.MAIRAudioTransitionLock=lock;const onReplan=e=>{if(e.detail?.held)heldAt=Date.now()};addEventListener('mair:director-replanned',onReplan);
  try{
    if(!change)await waitReplan();
    // Pas na het herplannen kijken: in die seconden kan de DJ of het nieuws net begonnen zijn.
    if(someoneTalking(lock)||!djOn()||document.visibilityState==='hidden')return false;
    const t=truth();uri=String(t?.uri||'');const playing=!!(uri&&t?.isPlaying);
    track=!change&&playing?firstRideTrack():null;const text=line({destination:dest,duration:detail.duration,track,change});
    if(typeof window.prepareSpeech!=='function'||typeof window.speakText!=='function')throw Error('MAIR Voice Engine is niet klaar');
    if(!await window.prepareSpeech(text,false))throw Error(window.JFMDJAudio?.status?.error||'Rit-aankondiging kon niet worden voorbereid');
    if(someoneTalking(lock))return false;
    const p=window.JFMPlayback;
    if(playing){op=window.JFMPlaybackState?.begin?.('dj-handoff',{expectedUri:uri,timeoutMs:60000})||0;if(!await p?.djPause?.(uri))throw Error(p?.health?.lastError||'Muziek pauzeren voor de rit-aankondiging mislukt');paused=true}
    if(!await window.speakText(text,false))throw Error(window.JFMDJAudio?.status?.error||'Rit-aankondiging werd niet hoorbaar afgespeeld');
    lastText=text;lastAt=Date.now();lastDest={latitude:+dest.latitude,longitude:+dest.longitude};lastError='';
    try{window.dispatchEvent(new CustomEvent('mair:car-ride-intro',{detail:{text,change,trackId:track?.id||''}}))}catch{/* alleen een melding */}
    return true
  }catch(e){error=String(e?.message||e).slice(0,240);lastError=error;window.MAIRRuntime?.caught?.('mair-car-ride-dj.announce',e);return false}
  finally{
    // Muziek gaat altijd weer aan: na de aankondiging het eerste ritnummer vanaf het begin, met één play-opdracht en de
    // nieuwe ritvolgorde erachter. Anders (of als dat mislukt) het oude nummer.
    if(paused){const p=window.JFMPlayback;try{nextAt=Date.now();started=!error&&!!track?.uri&&await p?.djNext?.('dj-ride-intro',track.uri)}catch(e){window.MAIRRuntime?.caught?.('mair-car-ride-dj.next',e)}if(!started)try{await p?.djResume?.(uri)}catch(e){window.MAIRRuntime?.caught?.('mair-car-ride-dj.resume',e)}}
    try{if(op)window.JFMPlaybackState?.end?.(op,{error})}catch(e){window.MAIRRuntime?.caught?.('mair-car-ride-dj.end',e)}
    removeEventListener('mair:director-replanned',onReplan);
    if(window.MAIRAudioTransitionLock===lock)window.MAIRAudioTransitionLock=null;busy=false;
    if(heldAt&&(!started||heldAt>=nextAt))window.JFMProgramDirector?.replan?.('journey',true)?.catch?.(()=>{})
  }
}
addEventListener('mair:car-route-start',e=>{announce(e.detail||{}).catch(()=>{})});
window.MAIRCarRideDJ={version:'car-ride-dj-v2',announce,line,spokenPlace,spokenDuration,status:()=>({busy,lastText,lastError,lastAt})};
})();
