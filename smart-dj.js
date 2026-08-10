// Josh FM Smart DJ — fully local text brain, no paid text API required.
(()=>{
  const recentKey='jfm_dj_recent';
  const recent=()=>{try{return JSON.parse(localStorage.getItem(recentKey)||'[]')}catch{return[]}};
  const remember=s=>{const r=recent();r.unshift(s);localStorage.setItem(recentKey,JSON.stringify(r.slice(0,14)))};
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  const artists=t=>(t?.artists||[]).join(' en ');
  const title=t=>t?.name||'';
  const year=t=>Number(String(t?.release||'').slice(0,4))||null;
  const req=t=>typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(t);
  function queueNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  function current(){return playback?.item?trackObj(playback.item):null}
  function notRecent(options){const r=recent().join(' ').toLowerCase();const filtered=options.filter(x=>!r.includes(x.toLowerCase().slice(0,28)));return pick(filtered.length?filtered:options)}
  function clean(s){return s.replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim()}

  function localBreak(previous,fact,weather,manual){
    const now=current(), next=queueNext(), bits=[];
    const mode=settings?.mode||'normal';

    if(manual){
      if(now)bits.push(notRecent([
        `Je zit op Josh FM met ${title(now)} van ${artists(now)}.`,
        `Op dit moment hoor je ${title(now)} van ${artists(now)}.`,
        `${title(now)} van ${artists(now)} staat nu aan op Josh FM.`
      ]));
    }else if(req(now)){
      bits.push(notRecent([
        `Er kwam een verzoekje binnen, dus we gooien ${title(now)} van ${artists(now)} erin.`,
        `Deze kwam op verzoek binnen: ${title(now)} van ${artists(now)}.`,
        `Tijd voor een verzoekplaat: ${title(now)} van ${artists(now)}.`
      ]));
    }else if(previous&&now){
      const sameArtist=(previous.artists||[]).some(a=>(now.artists||[]).includes(a));
      const py=year(previous),ny=year(now);
      if(sameArtist){
        bits.push(`We blijven nog even bij ${artists(now)}: van ${title(previous)} door naar ${title(now)}.`);
      }else if(py&&ny&&Math.abs(py-ny)>=15){
        bits.push(notRecent([
          `Van ${py} naar ${ny} in één stap: na ${title(previous)} gaan we door met ${title(now)} van ${artists(now)}.`,
          `We maken even een flinke sprong in de tijd. ${title(previous)} achter ons, nu ${title(now)} van ${artists(now)}.`
        ]));
      }else{
        bits.push(notRecent([
          `${title(previous)} ligt achter ons. We gaan door met ${title(now)} van ${artists(now)}.`,
          `Dat was ${title(previous)} van ${artists(previous)}. Nu ${title(now)} van ${artists(now)}.`,
          `We schuiven door: ${title(now)} van ${artists(now)} is aan de beurt.`,
          `Volgende plaat in de set: ${title(now)} van ${artists(now)}.`
        ]));
      }
    }else if(now){
      bits.push(`${title(now)} van ${artists(now)} op Josh FM.`);
    }else{
      bits.push('Je luistert naar Josh FM.');
    }

    if(fact?.text&&Math.random()<0.58){
      bits.push(notRecent([
        `Klein detail erbij: ${fact.text}`,
        `Nog een feitje voor onderweg: ${fact.text}`,
        `${fact.text}`
      ]));
    }

    if(next&&Math.random()<0.42){
      if(req(next)) bits.push(`En straks staat er nog een verzoek klaar: ${title(next)} van ${artists(next)}.`);
      else bits.push(notRecent([
        `Hierna hoor je ${title(next)} van ${artists(next)}.`,
        `Straks door met ${title(next)} van ${artists(next)}.`,
        `En verderop in deze set: ${title(next)} van ${artists(next)}.`
      ]));
    }

    if(document.getElementById('timeMention')?.checked&&Math.random()<0.22){
      bits.push(`Het is ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}.`);
    }
    if(weather&&Math.random()<0.16)bits.push(`Buiten is het ongeveer ${weather}.`);

    const tails={
      normal:['We gaan door.','Nog genoeg muziek voor je.','Josh FM blijft rollen.'],
      morning:['We houden de ochtend in beweging.','Rustig wakker worden, muziek aan.'],
      chill:['We houden deze lijn nog even vast.','Geen haast, gewoon door.'],
      party:['We houden de vaart erin.','Niet stilvallen, door.'],
      throwback:['Nog even terug in de tijd.','De tijdmachine blijft aan.'],
      late:['We blijven nog even wakker.','Nog eentje voor dit uur.']
    };
    if(Math.random()<0.48)bits.push(notRecent(tails[mode]||tails.normal));
    const out=clean(bits.join(' '));remember(out);return out;
  }

  window.makeDJScript=makeDJScript=async function(track,fact,weather,manual){
    return localBreak(track,fact,weatherText?weatherText(weather):'',manual);
  };
})();