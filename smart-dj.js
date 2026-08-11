// Josh FM Smart DJ — structured English radio clock and context-aware break engine.
(()=>{
const RECENT_KEY='jfm_dj_recent_lang_v2',INTENT_KEY='jfm_dj_intents_v2';
const recent=()=>{try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')}catch{return[]}};
const intents=()=>{try{return JSON.parse(localStorage.getItem(INTENT_KEY)||'[]')}catch{return[]}};
const remember=s=>{if(!s)return;const r=recent();r.unshift(s);localStorage.setItem(RECENT_KEY,JSON.stringify(r.slice(0,50)))};
const rememberIntent=i=>{if(!i)return;const r=intents();r.unshift({i,at:Date.now()});localStorage.setItem(INTENT_KEY,JSON.stringify(r.slice(0,30)))};
const pick=a=>a[Math.floor(Math.random()*a.length)],chance=n=>Math.random()<n;
const joinArtists=t=>(t?.artists||[]).join(' and '),title=t=>t?.name||'',year=t=>Number(String(t?.release||'').slice(0,4))||null;
const req=t=>typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(t);
const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
const current=()=>{try{return playback?.item?trackObj(playback.item):null}catch{return null}},nextTrack=()=>{try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}};
function notRecent(options){const used=recent().join(' ').toLowerCase();const fresh=options.filter(x=>x&&!used.includes(x.toLowerCase().slice(0,42)));return pick(fresh.length?fresh:options.filter(Boolean))||''}
function stationId(){return notRecent(['This is Josh FM.','You are listening to Josh FM.','Josh FM. Your music, your station.','Stay right here. This is Josh FM.','Josh FM, on air.'])}
function daypart(){const h=new Date().getHours();if(h<6)return'night';if(h<10)return'morning';if(h<12)return'late-morning';if(h<17)return'afternoon';if(h<20)return'drive';if(h<23)return'evening';return'late-evening'}
function showName(){const d=daypart();return({night:'Josh FM After Hours',morning:'Josh FM Morning', 'late-morning':'Josh FM Daytime',afternoon:'Josh FM Daytime',drive:'Josh FM Drive',evening:'Josh FM Evening','late-evening':'Josh FM Late Night'})[d]||'Josh FM'}
function moodLine(){const d=daypart(),m={night:['Still awake? I’ve got the music covered.','After hours on Josh FM. Let’s keep it moving.'],morning:['Good morning. Let’s get this day moving.','Morning on Josh FM. Music first, everything else later.'],'late-morning':['The morning is moving along nicely.','Late morning, and the music keeps coming.'],afternoon:['Afternoon on Josh FM. Let’s keep the soundtrack going.','We’re keeping the afternoon moving.'],drive:['Josh FM Drive is on. Let’s keep things moving.','The day is winding down, but the music is not.'],evening:['Evening on Josh FM. Let the music do the work.','The evening is underway. We’re staying right here.'],'late-evening':['It’s getting late, but there’s still plenty of music left.','Late night on Josh FM. One more tune is never really one more.']};return notRecent(m[d]||m.afternoon)}
function clockPhase(){const m=new Date().getMinutes();if(m<=2)return'top';if(m>=13&&m<=17)return'q1';if(m>=28&&m<=32)return'half';if(m>=43&&m<=47)return'q3';if((m>=6&&m<=11)||(m>=20&&m<=26)||(m>=35&&m<=41)||(m>=50&&m<=57))return'sweep';return'open'}
function recentlyIntent(name,minutes=20){const cut=Date.now()-minutes*60000;return intents().some(x=>x.i===name&&x.at>cut)}
function softenFact(text=''){let x=String(text).replace(/\[[^\]]*\]/g,'').replace(/\([^)]*(source|bron)[^)]*\)/gi,'').replace(/\b(Wikipedia|MusicBrainz|Spotify|metadata|source|database|bron|databank)\b/gi,'').trim().replace(/\.$/,'');if(x.length>180)x=x.slice(0,177).replace(/\s+\S*$/,'')+'…';return x}
function factBreak(t,f){if(!t||!f?.text)return'';const x=softenFact(f.text);if(!x)return'';return notRecent([`${x}. That was the story behind ${title(t)} by ${joinArtists(t)}.`,`${x}. Keep that in mind next time you hear ${title(t)} by ${joinArtists(t)}.`])}
function backsell(t){if(!t)return'';return notRecent([`That was ${joinArtists(t)} with ${title(t)}.`,`You just heard ${title(t)} by ${joinArtists(t)}.`,`${joinArtists(t)}, ${title(t)}. That one still works.`])}
function frontsell(t){if(!t)return'';if(req(t))return notRecent([`This one came in as a request: ${joinArtists(t)} with ${title(t)}.`,`A request for you now. ${title(t)} by ${joinArtists(t)}.`]);return notRecent([`Now, ${joinArtists(t)} with ${title(t)}.`,`Here’s ${title(t)} by ${joinArtists(t)}.`,`Let’s keep moving with ${joinArtists(t)} and ${title(t)}.`])}
function tease(t){if(!t)return'';return notRecent([`Stay with me. ${joinArtists(t)} is coming up next.`,`Still to come: ${title(t)} by ${joinArtists(t)}.`,`Coming up next on Josh FM: ${joinArtists(t)}.`])}
function bridge(prev,now){if(!now)return stationId();if(req(now))return frontsell(now);if(!prev)return frontsell(now);const py=year(prev),ny=year(now),same=(prev.artists||[]).some(a=>(now.artists||[]).includes(a));if(same)return notRecent([`${joinArtists(now)} again. That was ${title(prev)}, and now here’s ${title(now)}.`]);if(py&&ny&&Math.abs(py-ny)>=15&&chance(.55))return`From ${py} to ${ny} in one jump. Here’s ${joinArtists(now)} with ${title(now)}.`;return clean(`${backsell(prev)} And now, ${joinArtists(now)} with ${title(now)}.`)}
function weatherLine(w){if(!w)return'';const loc=w.location?` in ${w.location}`:'';const c=w.code;let x='';if(c===0)x='clear';else if(c<=3)x='cloudy';else if(c<=48)x='misty';else if(c<=67)x='rainy';else if(c<=77)x='wintry';else if(c<=82)x='showery';else if(c>=95)x='stormy';return`Outside${loc}, it’s ${w.temperature} degrees${x?' and '+x:''}. In here, the music keeps going.`}
function timeLine(){return`It’s ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}.`}
function topHour(now){return clean(`${stationId()} ${showName()}. ${moodLine()}${now?' '+frontsell(now):''}`)}
function quarterBreak(previous,now,next){const options=[];if(previous)options.push(backsell(previous));if(next)options.push(tease(next));options.push(moodLine());if(now&&chance(.55))options.push(frontsell(now));return clean(notRecent(options))}
function musicSweep(now){if(now&&chance(.35))return clean(`${stationId()} ${frontsell(now)}`);return stationId()}
function chooseIntent({manual,now,next,fact,weather}){
  if(manual)return fact?.text?'manual-fact':'manual-react';
  if(window.jfmHourMarker){window.jfmHourMarker=false;return'hour-opener'}
  if(req(now))return'request';
  const phase=clockPhase();
  if(phase==='top'&&!recentlyIntent('hour-opener',45))return'hour-opener';
  if((phase==='q1'||phase==='half'||phase==='q3')&&!recentlyIntent('quarter',10))return'quarter';
  if(phase==='sweep'&&!recentlyIntent('station-id',8))return'station-id';
  const pool=['bridge','bridge','micro','micro','backsell-frontsell'];
  if(fact?.text&&!recentlyIntent('fact',25))pool.push('fact');
  if(next&&!recentlyIntent('tease',15))pool.push('tease');
  if(weather&&document.getElementById('weatherMention')?.checked&&!recentlyIntent('weather',45))pool.push('weather');
  if(document.getElementById('timeMention')?.checked&&!recentlyIntent('time',30))pool.push('time');
  if(!recentlyIntent('companion',20))pool.push('companion');
  return pick(pool)
}
function localBreak(previous,fact,weather,manual){const now=current(),next=nextTrack(),intent=chooseIntent({manual,now,next,fact,weather});let out='';switch(intent){case'manual-fact':out=factBreak(previous||now,fact);break;case'manual-react':out=previous?clean(`${backsell(previous)} That landed nicely.`):stationId();break;case'hour-opener':out=topHour(now);break;case'quarter':out=quarterBreak(previous,now,next);break;case'request':out=frontsell(now);break;case'fact':out=factBreak(previous||now,fact);break;case'tease':out=clean(`${previous?backsell(previous):''} ${tease(next)}`);break;case'weather':out=clean(`${weatherLine(weather)}${now?' '+frontsell(now):''}`);break;case'time':out=clean(`${timeLine()}${now?' '+frontsell(now):''}`);break;case'companion':out=clean(`${moodLine()}${now&&chance(.55)?' '+frontsell(now):''}`);break;case'station-id':out=musicSweep(now);break;case'backsell-frontsell':out=bridge(previous,now);break;default:out=now?frontsell(now):(previous?backsell(previous):stationId())}rememberIntent(intent);const max=manual?320:(intent==='hour-opener'?300:225);if(out.length>max){const sentences=out.match(/[^.!?]+[.!?]/g)||[];out=clean(sentences.slice(0,2).join(' '))}return clean(out)}
async function reversePlace(lat,lon){try{const k=`jfm_place_en_${lat.toFixed(2)}_${lon.toFixed(2)}`,c=JSON.parse(localStorage.getItem(k)||'null');if(c&&Date.now()-c.at<86400000)return c.name;const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`);if(!r.ok)return'';const d=await r.json(),name=d.city||d.locality||d.principalSubdivision||d.countryName||'';if(name)localStorage.setItem(k,JSON.stringify({at:Date.now(),name}));return name}catch{return''}}
window.getWeather=getWeather=async function(){if(!document.getElementById('weatherMention')?.checked)return null;if(weatherCache&&Date.now()-weatherCache.at<1200000)return weatherCache.data;return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(async p=>{try{const{latitude,longitude}=p.coords;const[r,location]=await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`),reversePlace(latitude,longitude)]);const d=await r.json(),temp=Math.round(d.current?.temperature_2m),data=Number.isFinite(temp)?{temperature:temp,code:d.current?.weather_code,location}:null;weatherCache={at:Date.now(),data};resolve(data)}catch{resolve(null)}},()=>resolve(null),{timeout:6000,maximumAge:900000})})};window.weatherText=weatherText=w=>w||null;
window.makeDJScript=makeDJScript=async function(track,fact,weather,manual){let out=localBreak(track,fact,weather,manual);if(!out)out=stationId();remember(out);window.jfmLastDJText=out;return out};
window.JFMRadioClock={version:'structured-radio-clock-v2',localBreak,recent,intents,clockPhase,daypart,showName,get language(){return'en'}};
})();