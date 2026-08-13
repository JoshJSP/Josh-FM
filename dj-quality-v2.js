// Josh FM Product Beta Build 2 — radio presenter quality layer.
(()=>{
  const RECENT='jfm_dj_quality_recent_v1',FORMATS='jfm_dj_quality_formats_v1';
  const $=id=>document.getElementById(id),pick=a=>a[Math.floor(Math.random()*a.length)],clean=s=>String(s||'').replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
  const load=(k,d=[])=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return Array.isArray(x)?x:d}catch{return d}};
  const save=(k,x)=>{try{localStorage.setItem(k,JSON.stringify(x))}catch{}};
  const artist=t=>Array.isArray(t?.artists)?t.artists.join(' and '):'',title=t=>String(t?.name||''),year=t=>Number(String(t?.release||'').slice(0,4))||0;
  const current=()=>{try{return playback?.item?trackObj(playback.item):null}catch{return null}};
  const next=()=>{try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}};
  const recent=()=>load(RECENT),formats=()=>load(FORMATS);
  function remember(text,format){const r=recent();r.unshift({text,at:Date.now(),start:text.split(/\s+/).slice(0,5).join(' ').toLowerCase(),format});save(RECENT,r.slice(0,24));const f=formats();f.unshift({format,at:Date.now()});save(FORMATS,f.slice(0,20))}
  function fresh(options){const r=recent(),starts=new Set(r.slice(0,10).map(x=>x.start));const scored=options.filter(Boolean).map(text=>({text,score:starts.has(text.split(/\s+/).slice(0,5).join(' ').toLowerCase())?1:0})).sort((a,b)=>a.score-b.score);const best=scored.filter(x=>x.score===scored[0]?.score);return pick(best)?.text||''}
  function daypart(){const h=new Date().getHours();return h<6?'overnight':h<10?'morning':h<12?'late-morning':h<17?'afternoon':h<20?'drive':h<23?'evening':'late-night'}
  function show(){return({overnight:'After Hours',morning:'Morning', 'late-morning':'Daytime',afternoon:'Daytime',drive:'Drive',evening:'Evening','late-night':'Late Night'})[daypart()]}
  function timeLine(){return `It’s ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}.`}
  function identity(){return fresh(['Josh FM.','This is Josh FM.','You’re with Josh FM.','Josh FM, keeping the music moving.','Josh FM. Your music, your radio show.'])}
  function mood(){const d=daypart(),m={overnight:['Still awake? I’ve got you.','After hours, and we’re keeping it easy.'],morning:['Good morning. Let’s get moving.','Morning. Music first, everything else can wait.'],'late-morning':['Late morning and we’re settling into it.','The day’s properly underway now.'],afternoon:['Afternoon soundtrack sorted.','Keeping the afternoon moving.'],drive:['The day’s winding down. The music isn’t.','Drive time, so let’s keep this moving.'],evening:['Evening mode is on.','The evening’s underway, and we’re staying with the music.'],'late-night':['Late night. One more track is never really one more.','It’s getting late, but we’re not done yet.']};return fresh(m[d]||m.afternoon)}
  function back(t){if(!t)return'';return fresh([`${artist(t)} with ${title(t)}.`,`That was ${title(t)} from ${artist(t)}.`,`${title(t)} by ${artist(t)} — still sounds good.`,`You just heard ${artist(t)}, ${title(t)}.`])}
  function front(t){if(!t)return'';return fresh([`Here’s ${title(t)} by ${artist(t)}.`,`Now, ${artist(t)} with ${title(t)}.`,`Let’s keep going with ${title(t)} from ${artist(t)}.`,`Up next, ${artist(t)} and ${title(t)}.`])}
  function tease(t){if(!t)return'';return fresh([`Stay with me — ${artist(t)} is on the way.`,`Still to come: ${title(t)} by ${artist(t)}.`,`In a bit, ${artist(t)} with ${title(t)}.`])}
  function factLine(t,f){const x=String(f?.text||'').replace(/\[[^\]]*\]/g,'').replace(/\b(Wikipedia|MusicBrainz|Spotify|metadata|source|database)\b/gi,'').trim().replace(/\.$/,'');if(!x)return'';const safe=x.length>170?x.slice(0,167).replace(/\s+\S*$/,'')+'…':x;return fresh([`${safe}. And that’s ${title(t)} by ${artist(t)}.`,`${safe}. A little context for ${title(t)} from ${artist(t)}.`])}
  function transition(prev,now){if(!now)return prev?back(prev):identity();if(!prev)return front(now);const py=year(prev),ny=year(now);if(py&&ny&&Math.abs(py-ny)>=15)return clean(`${back(prev)} From ${py} to ${ny} in one jump — ${front(now)}`);if(artist(prev)&&artist(prev)===artist(now))return clean(`${artist(now)} back to back. ${title(prev)} just there, and now ${title(now)}.`);return clean(`${back(prev)} ${front(now)}`)}
  function recentFormat(name,n=4){return formats().slice(0,n).some(x=>x.format===name)}
  function choose({manual,fact,weather,now,nxt}){
    if(manual)return fact?.text?'manual-fact':'manual';
    const minute=new Date().getMinutes();
    if(minute<=2&&!recentFormat('hour',8))return'hour';
    if((minute>=28&&minute<=32)&&!recentFormat('half-hour',6))return'half-hour';
    const pool=['micro','bridge','bridge','music-sweep'];
    if(fact?.text&&!recentFormat('fact',5))pool.push('fact');
    if(nxt&&!recentFormat('tease',4))pool.push('tease');
    if($('timeMention')?.checked&&!recentFormat('time',6))pool.push('time');
    if(weather&&$('weatherMention')?.checked&&!recentFormat('weather',8))pool.push('weather');
    if(!recentFormat('companion',4))pool.push('companion');
    return pick(pool)
  }
  function weatherLine(w){if(!w)return'';const loc=w.location?` in ${w.location}`:'';return `Outside${loc}, it’s ${Math.round(Number(w.temperature)||0)} degrees. In here, we’ll keep the music moving.`}
  function build(previous,fact,weather,manual){const now=current(),nxt=next(),format=choose({manual,fact,weather,now,nxt});let text='';
    switch(format){
      case'manual-fact':text=clean(`${factLine(previous||now,fact)} ${now&&now!==previous?front(now):''}`);break;
      case'manual':text=clean(`${previous?back(previous):identity()} ${now?front(now):''}`);break;
      case'hour':text=clean(`${identity()} ${show()}. ${mood()} ${now?front(now):''}`);break;
      case'half-hour':text=clean(`${timeLine()} ${mood()} ${now?front(now):''}`);break;
      case'fact':text=factLine(previous||now,fact);break;
      case'tease':text=clean(`${previous?back(previous):''} ${tease(nxt)}`);break;
      case'time':text=clean(`${timeLine()} ${now?front(now):''}`);break;
      case'weather':text=clean(`${weatherLine(weather)} ${now?front(now):''}`);break;
      case'companion':text=clean(`${mood()} ${Math.random()<.55&&now?front(now):''}`);break;
      case'music-sweep':text=Math.random()<.45&&now?clean(`${identity()} ${front(now)}`):identity();break;
      case'micro':text=now?front(now):(previous?back(previous):identity());break;
      default:text=transition(previous,now)
    }
    text=clean(text||transition(previous,now));
    const words=text.split(/\s+/);const max=manual?70:format==='hour'?62:48;if(words.length>max){text=words.slice(0,max).join(' ');const sentences=text.match(/[^.!?]+[.!?]/g);if(sentences?.length)text=clean(sentences.join(' '));else text+='.'}
    remember(text,format);return text
  }
  window.makeDJScript=async(track,fact,weather,manual)=>{const text=build(track,fact,weather,manual);window.jfmLastDJText=text;return text};
  window.JFMDJQuality={version:'build2-dj-quality-v1',build,recent,formats,daypart,show};
})();
