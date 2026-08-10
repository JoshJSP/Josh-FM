// Josh FM Smart DJ — creative local radio brain + location-aware weather.
(()=>{
  const recentKey='jfm_dj_recent';
  const recent=()=>{try{return JSON.parse(localStorage.getItem(recentKey)||'[]')}catch{return[]}};
  const remember=s=>{const r=recent();r.unshift(s);localStorage.setItem(recentKey,JSON.stringify(r.slice(0,18)))};
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  const artists=t=>(t?.artists||[]).join(' en ');
  const title=t=>t?.name||'';
  const year=t=>Number(String(t?.release||'').slice(0,4))||null;
  const req=t=>typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(t);
  function queueNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  function current(){return playback?.item?trackObj(playback.item):null}
  function notRecent(options){const r=recent().join(' ').toLowerCase();const filtered=options.filter(x=>!r.includes(x.toLowerCase().slice(0,30)));return pick(filtered.length?filtered:options)}
  function clean(s){return s.replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim()}

  function softenFact(text=''){
    let x=String(text).replace(/\[[^\]]*\]/g,'').replace(/\([^)]*bron[^)]*\)/gi,'').trim();
    x=x.replace(/^het nummer\s+/i,'').replace(/^de single\s+/i,'').replace(/^het lied\s+/i,'');
    x=x.replace(/\.$/,'');
    if(x.length>150)x=x.slice(0,147).replace(/\s+\S*$/,'')+'…';
    return x;
  }

  function creativeFactLine(track,fact){
    if(!fact?.text)return'';
    const f=softenFact(fact.text);if(!f)return'';
    const who=artists(track),song=title(track);
    return notRecent([
      `Grappig detail bij ${song}: ${f}. Best lekker om te weten terwijl hij gewoon door je speakers komt.`,
      `Over ${song} gesproken: ${f}. Zo'n detail waardoor je de plaat toch net anders hoort.`,
      `Kleine side note voor de muziekliefhebber: ${f}. En nu vooral niet te veel analyseren, gewoon luisteren.`,
      `Dit is zo'n plaat waar nog een verhaal achter zit: ${f}. ${who} had dus meer in handen dan alleen een lekkere track.`,
      `Nog eentje voor je muzikale nutteloze-kennis-map: ${f}. Kun je straks weer ergens mee aankomen.`,
      `Wat ik wel leuk vind aan deze: ${f}. Goed, genoeg Wikipedia-energie — terug naar de muziek.`
    ]);
  }

  async function reversePlace(latitude,longitude){
    try{
      const key=`jfm_place_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
      const cached=JSON.parse(localStorage.getItem(key)||'null');
      if(cached&&Date.now()-cached.at<24*60*60*1000)return cached.name;
      const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=nl`);
      if(!r.ok)return'';
      const d=await r.json();
      const name=d.city||d.locality||d.principalSubdivision||d.countryName||'';
      if(name)localStorage.setItem(key,JSON.stringify({at:Date.now(),name}));
      return name;
    }catch{return''}
  }

  // Replace the original weather helper so every weather result can carry a locality.
  window.getWeather=getWeather=async function(){
    if(!document.getElementById('weatherMention')?.checked)return null;
    if(weatherCache&&Date.now()-weatherCache.at<20*60*1000)return weatherCache.data;
    return new Promise(resolve=>{
      if(!navigator.geolocation)return resolve(null);
      navigator.geolocation.getCurrentPosition(async p=>{
        try{
          const{latitude,longitude}=p.coords;
          const [r,location]=await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`),
            reversePlace(latitude,longitude)
          ]);
          const d=await r.json(),temp=Math.round(d.current?.temperature_2m);
          const data=Number.isFinite(temp)?{temperature:temp,code:d.current?.weather_code,location}:null;
          weatherCache={at:Date.now(),data};resolve(data)
        }catch{resolve(null)}
      },()=>resolve(null),{timeout:6000,maximumAge:900000})
    })
  };

  window.weatherText=weatherText=function(w){
    if(!w)return'';const c=w.code;let x='';
    if(c===0)x='helder';else if(c<=3)x='bewolkt';else if(c<=48)x='mistig';else if(c<=67)x='regenachtig';else if(c<=77)x='winters';else if(c<=82)x='met buien';else if(c>=95)x='onweersachtig';
    const where=w.location?`in ${w.location} `:'';
    return`${where}${w.temperature} graden${x?' en '+x:''}`
  };

  function localBreak(previous,fact,weather,manual){
    const now=current(),next=queueNext(),bits=[],mode=settings?.mode||'normal';
    if(manual){
      if(now)bits.push(notRecent([`Je zit op Josh FM met ${title(now)} van ${artists(now)}.`,`Deze staat nu lekker aan: ${title(now)} van ${artists(now)}.`,`Josh FM, en op dit moment ${title(now)} van ${artists(now)}.`]));
    }else if(req(now)){
      bits.push(notRecent([`Er kwam een verzoekje binnen, dus die krijgt gewoon voorrang: ${title(now)} van ${artists(now)}.`,`Iemand had hier duidelijk zin in. Verzoekplaat: ${title(now)} van ${artists(now)}.`,`Uit de verzoekhoek: ${title(now)} van ${artists(now)}. Goede keuze, deze mag erin.`]));
    }else if(previous&&now){
      const same=(previous.artists||[]).some(a=>(now.artists||[]).includes(a)),py=year(previous),ny=year(now);
      if(same)bits.push(`We blijven nog heel even hangen bij ${artists(now)}. ${title(previous)} eruit, ${title(now)} erin.`);
      else if(py&&ny&&Math.abs(py-ny)>=15)bits.push(notRecent([`We springen zonder schaamte van ${py} naar ${ny}. Dat kan hier gewoon: ${title(now)} van ${artists(now)}.`,`Tijdmachine aan. We laten ${py} achter en landen in ${ny} met ${title(now)} van ${artists(now)}.`]));
      else bits.push(notRecent([`Die parkeren we. Door naar ${title(now)} van ${artists(now)}.`,`Van ${title(previous)} rollen we zo door naar ${title(now)} van ${artists(now)}.`,`Nieuwe plaat, zelfde zender: ${title(now)} van ${artists(now)}.`,`We houden 'm in beweging. ${title(now)} van ${artists(now)} staat klaar.`]));
    }else if(now)bits.push(`${title(now)} van ${artists(now)} op Josh FM.`);else bits.push('Je luistert naar Josh FM.');

    if(fact?.text&&Math.random()<0.62){const line=creativeFactLine(now||previous,fact);if(line)bits.push(line)}
    if(next&&Math.random()<0.38){
      if(req(next))bits.push(`En ik zie verderop nog een verzoek klaarstaan: ${title(next)} van ${artists(next)}.`);
      else bits.push(notRecent([`Hierna schuift ${title(next)} van ${artists(next)} aan.`,`Straks nog ${title(next)} van ${artists(next)}.`,`Ik heb ${title(next)} van ${artists(next)} alvast voor je klaargezet.`]));
    }
    if(document.getElementById('timeMention')?.checked&&Math.random()<0.20)bits.push(`Het is ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}.`);
    if(weather&&Math.random()<0.24)bits.push(notRecent([`En voor wie naar buiten moet: ${weather}.`,`Kleine blik naar buiten: ${weather}.`,`Weercheck tussendoor: ${weather}.` ]));

    const tails={normal:['We gaan door.','Muziek weer aan.','Genoeg gepraat, door.'],morning:['Ochtend aan, muziek aan.','We houden de ochtend lekker in beweging.'],chill:['Geen haast. We rollen rustig verder.','Deze lijn houden we nog even vast.'],party:['Tempo erin, we gaan door.','Geen tijd om stil te vallen.'],throwback:['De tijdmachine blijft nog even aan.','Nog even lekker terug in de tijd.'],late:['We blijven nog even wakker.','Nog eentje voor dit uur.']};
    if(Math.random()<0.42)bits.push(notRecent(tails[mode]||tails.normal));
    const out=clean(bits.join(' '));remember(out);return out;
  }

  window.makeDJScript=makeDJScript=async function(track,fact,weather,manual){return localBreak(track,fact,weatherText?weatherText(weather):'',manual)};
})();