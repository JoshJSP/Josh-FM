// Josh FM Smart DJ — free broadcast-clock engine inspired by professional radio workflow.
// No paid LLM is required for normal operation. Break intent is chosen first, copy second.
(()=>{
const RECENT_KEY='jfm_dj_recent_v4';
const recent=()=>{try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')}catch{return[]}};
const remember=s=>{if(!s)return;const r=recent();r.unshift(s);localStorage.setItem(RECENT_KEY,JSON.stringify(r.slice(0,40)))};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const chance=n=>Math.random()<n;
const artists=t=>(t?.artists||[]).join(' en ');
const title=t=>t?.name||'';
const year=t=>Number(String(t?.release||'').slice(0,4))||null;
const req=t=>typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(t);
const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
function current(){try{return playback?.item?trackObj(playback.item):null}catch{return null}}
function nextTrack(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
function notRecent(options){const used=recent().join(' ').toLowerCase();const fresh=options.filter(x=>x&&!used.includes(x.toLowerCase().slice(0,42)));return pick(fresh.length?fresh:options.filter(Boolean))||''}
function stationId(){return notRecent(['Dit is Josh FM.','Je luistert naar Josh FM.','Josh FM, muziek aan.','Dit blijft Josh FM.'])}
function daypart(){const h=new Date().getHours();if(h<6)return'nacht';if(h<10)return'ochtend';if(h<12)return'late ochtend';if(h<17)return'middag';if(h<20)return'vooravond';if(h<23)return'avond';return'late avond'}
function moodLine(){const d=daypart();const by={nacht:['Rustig aan vannacht.','Nog even wakker? Dan houden we de muziek aan.'],ochtend:['Goedemorgen. We houden het tempo lekker op gang.','Rustig wakker worden mag, de muziek doet de rest.'],'late ochtend':['De ochtend loopt lekker door.','We zijn inmiddels goed onderweg met de ochtend.'],middag:['Middag op Josh FM. Gewoon goeie muziek achter elkaar.','We houden de middag in beweging.'],vooravond:['De dag zit er bijna op. De muziek nog niet.','Vooravond. Tijd om de dag een beetje los te laten.'],avond:['Avond op Josh FM. We doen het niet te moeilijk.','De avond is begonnen. De muziek blijft aan.'],'late avond':['Laat op de avond. Precies goed voor nog een paar platen.','We gaan nog even door vanavond.']};return notRecent(by[d]||by.middag)}
function softenFact(text=''){let x=String(text).replace(/\[[^\]]*\]/g,'').replace(/\([^)]*bron[^)]*\)/gi,'').replace(/\b(Wikipedia|MusicBrainz|Spotify|metadata|bron|databank)\b/gi,'').replace(/^het nummer\s+/i,'').replace(/^de single\s+/i,'').replace(/^het lied\s+/i,'').trim().replace(/\.$/,'');if(x.length>190)x=x.slice(0,187).replace(/\s+\S*$/,'')+'…';return x}
function factBreak(t,f){if(!t||!f?.text)return'';const x=softenFact(f.text);if(!x)return'';return notRecent([`${x}. Dat hoorde dus bij ${title(t)} van ${artists(t)}.`,`${x}. Met dat in je achterhoofd klinkt ${title(t)} van ${artists(t)} toch net even anders.`,`${x}. Dat was het verhaal achter ${artists(t)} met ${title(t)}.`])}
function backsell(t){if(!t)return'';return notRecent([`Dat was ${artists(t)} met ${title(t)}.`,`Je hoorde ${title(t)} van ${artists(t)}.`,`${artists(t)}, ${title(t)}. Die mocht er wel even zijn.`,`${title(t)} van ${artists(t)}. Prima plek voor die plaat.`])}
function frontsell(t){if(!t)return'';if(req(t))return notRecent([`Deze stond op het verlanglijstje: ${artists(t)} met ${title(t)}.`,`Verzoekje voor je: ${title(t)} van ${artists(t)}.`,`Deze kwam op verzoek binnen. ${artists(t)}, ${title(t)}.`]);return notRecent([`Nu ${artists(t)} met ${title(t)}.`,`Deze is voor ${artists(t)}: ${title(t)}.`,`En door met ${title(t)} van ${artists(t)}.`])}
function tease(t){if(!t)return'';return notRecent([`En blijf nog even hangen, want ${artists(t)} staat hierna klaar.`,`Zo meteen nog ${title(t)} van ${artists(t)}.`,`Hierna: ${artists(t)} met ${title(t)}.`,`Straks pakken we ${title(t)} van ${artists(t)} erbij.`])}
function bridge(prev,now){if(!now)return stationId();if(req(now))return frontsell(now);if(!prev)return frontsell(now);const py=year(prev),ny=year(now);const same=(prev.artists||[]).some(a=>(now.artists||[]).includes(a));if(same)return notRecent([`${artists(now)} nog een keer. Net ${title(prev)}, nu ${title(now)}.`,`We blijven nog even bij ${artists(now)}. Dit is ${title(now)}.`]);if(py&&ny&&Math.abs(py-ny)>=15&&chance(.55))return notRecent([`Van ${py} naar ${ny} in één stap. Nu ${artists(now)} met ${title(now)}.`,`Kleine tijdsprong: van ${py} naar ${ny}. ${title(now)} van ${artists(now)}.`]);return notRecent([`${backsell(prev)} En nu ${artists(now)} met ${title(now)}.`,`${backsell(prev)} Door naar ${title(now)} van ${artists(now)}.`,`Van ${artists(prev)} naar ${artists(now)}. Dit is ${title(now)}.`])}
function weatherLine(w){if(!w)return'';return notRecent([`Buiten ${w}. Hier blijft de muziek gewoon aan.`,`Voor als je zo naar buiten moet: ${w}.`,`Even praktisch tussendoor: ${w}.`])}
function timeLine(){return`Het is ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}.`}
function chooseIntent({manual,previous,now,next,fact,weather}){
 if(manual)return fact?.text?'manual-fact':'manual-react';
 if(window.jfmHourMarker){window.jfmHourMarker=false;return'hour-opener'}
 if(req(now))return'request';
 const pool=[];
 // A real radio clock: most breaks are music-led; service/content elements are occasional.
 pool.push('bridge','bridge','backsell-frontsell','backsell-frontsell','micro','micro');
 if(fact?.text)pool.push('fact','fact');
 if(next)pool.push('tease');
 if(weather&&document.getElementById('weatherMention')?.checked)pool.push('weather');
 if(document.getElementById('timeMention')?.checked)pool.push('time');
 pool.push('companion','station-id');
 return pick(pool);
}
function localBreak(previous,fact,weather,manual){
 const now=current(),next=nextTrack(),intent=chooseIntent({manual,previous,now,next,fact,weather});
 let out='';
 switch(intent){
  case'manual-fact': out=factBreak(previous||now,fact);break;
  case'manual-react': out=previous?notRecent([`${backsell(previous)} Die zat precies goed.`,`${backsell(previous)} Meer hoeft daar eigenlijk niet bij.`,`${backsell(previous)} Ja, die houden we erin.`]):stationId();break;
  case'hour-opener': out=clean(`${stationId()} ${moodLine()}${now?' '+frontsell(now):''}`);break;
  case'request': out=frontsell(now);break;
  case'fact': out=factBreak(previous||now,fact);break;
  case'tease': out=clean(`${previous?backsell(previous):''} ${tease(next)}`);break;
  case'weather': out=clean(`${weatherLine(weather)}${now?' '+frontsell(now):''}`);break;
  case'time': out=clean(`${timeLine()}${now?' '+frontsell(now):''}`);break;
  case'companion': out=clean(`${moodLine()}${now&&chance(.65)?' '+frontsell(now):''}`);break;
  case'station-id': out=clean(`${stationId()}${now?' '+frontsell(now):''}`);break;
  case'backsell-frontsell': out=bridge(previous,now);break;
  default: out=now?frontsell(now):(previous?backsell(previous):stationId());
 }
 // Keep normal radio breaks short. Only manual breaks may run slightly longer.
 const max=manual?330:250;
 if(out.length>max){const sentences=out.match(/[^.!?]+[.!?]/g)||[];out=clean(sentences.slice(0,2).join(' '));}
 return clean(out);
}
async function reversePlace(lat,lon){try{const k=`jfm_place_${lat.toFixed(2)}_${lon.toFixed(2)}`,c=JSON.parse(localStorage.getItem(k)||'null');if(c&&Date.now()-c.at<86400000)return c.name;const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=nl`);if(!r.ok)return'';const d=await r.json(),name=d.city||d.locality||d.principalSubdivision||d.countryName||'';if(name)localStorage.setItem(k,JSON.stringify({at:Date.now(),name}));return name}catch{return''}}
window.getWeather=getWeather=async function(){if(!document.getElementById('weatherMention')?.checked)return null;if(weatherCache&&Date.now()-weatherCache.at<1200000)return weatherCache.data;return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(async p=>{try{const{latitude,longitude}=p.coords;const[r,location]=await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`),reversePlace(latitude,longitude)]);const d=await r.json(),temp=Math.round(d.current?.temperature_2m),data=Number.isFinite(temp)?{temperature:temp,code:d.current?.weather_code,location}:null;weatherCache={at:Date.now(),data};resolve(data)}catch{resolve(null)}},()=>resolve(null),{timeout:6000,maximumAge:900000})})};
window.weatherText=weatherText=w=>{if(!w)return'';const c=w.code;let x='';if(c===0)x='helder';else if(c<=3)x='bewolkt';else if(c<=48)x='mistig';else if(c<=67)x='regenachtig';else if(c<=77)x='winters';else if(c<=82)x='met buien';else if(c>=95)x='onweersachtig';return`${w.location?'in '+w.location+' ':''}${w.temperature} graden${x?' en '+x:''}`};
// Paid text generation is deliberately opt-in. Normal Josh FM scripting remains fully free.
async function optionalAiBreak(previous,fact,weather,manual){if(localStorage.getItem('jfm_allow_paid_ai')!=='1')return'';const now=current(),next=nextTrack();try{const r=await fetch('/api/dj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({previousTrack:previous||null,currentTrack:now,nextTrack:next,fact:fact?.text||'',time:document.getElementById('timeMention')?.checked?new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'',weather:weatherText(weather),mode:MODES?.[settings?.mode||'normal']||settings?.mode,manual,session:(session||[]).slice(0,10),recentDJ:recent()})});if(r.ok){const d=await r.json();return clean(d?.text||'')}}catch{}return''}
window.makeDJScript=makeDJScript=async function(track,fact,weather,manual){let out=await optionalAiBreak(track,fact,weather,manual);if(!out)out=localBreak(track,fact,weatherText?weatherText(weather):'',manual);if(!out)out='Josh FM.';remember(out);window.jfmLastDJText=out;return out};
window.JFMRadioClock={version:'free-radio-clock-v1',localBreak,recent};
})();