// MAIR music intelligence — central queue scoring, station purity and anti-repeat.
(()=>{
  if(window.JFMMusicIntelligence)return;
  const HISTORY='jfm_music_recent_v3',norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}},save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{/* opslag geblokkeerd: dan zonder opslag */}};
  const year=t=>Number(String(t?.release||'').slice(0,4))||0,artist=t=>norm(t?.artists?.[0]||''),sig=t=>norm(t?.name)+'|'+artist(t),channel=()=>localStorage.getItem('jfm_music_channel_v1')||'mix';
  function pure(t,id=channel()){
    if(!t?.id||!t?.uri)return false;
    const p=window.MAIRStationPolicy;
    if(p?.hardFilter&&id!=='mix')return p.hardFilter(id,[t]).length===1;
    const y=year(t);
    if(id==='new')return y>=new Date().getFullYear()-2;
    if(id==='throwback')return y>=1980&&y<=2004;
    if(id==='00s')return y>=2000&&y<=2009;
    if(id==='10s')return y>=2010&&y<=2019;
    if(id==='hits')return y>=new Date().getFullYear()-3;
    if(id==='top40')return y>=new Date().getFullYear()-2;
    return true;
  }
  function history(){return load(HISTORY,[])}
  function recentPenalty(t){const h=history(),a=artist(t);let p=0;h.slice(0,28).forEach((x,i)=>{if(x.id===t.id)p+=90-Math.min(68,i*3);if(a&&x.artist===a)p+=28-Math.min(21,i)});return p}
  function tasteWeight(id=channel()){const p=window.MAIRStationPolicy;return p?.personalization?Number(p.personalization(id)||0):id==='mix'?1:.2}
  function baseScore(t,id=channel()){const pop=Number(t?.popularity||0),fresh=year(t)>=new Date().getFullYear()-1?4:0,taste=Number(window.JFMTasteModel?.score?.(t)||0)*tasteWeight(id);return pop*.12+fresh+taste-recentPenalty(t)}
  function optimize(input,id=channel()){
    const seenId=new Set(),seenSig=new Set(),valid=[];
    for(const t of Array.isArray(input)?input:[]){const s=sig(t);if(!pure(t,id)||seenId.has(t?.id)||seenSig.has(s))continue;seenId.add(t.id);seenSig.add(s);valid.push(t)}
    const currentId=String(window.JFMPlaybackState?.get?.()?.trackId||window.playback?.item?.id||'');let head=null,rest=valid;
    if(currentId){const i=valid.findIndex(t=>t.id===currentId);if(i>=0){head=valid[i];rest=valid.filter((_,n)=>n!==i)}}
    rest=[...rest].sort((a,b)=>baseScore(b,id)-baseScore(a,id)+((Math.random()-.5)*1.2));
    const spread=[],artistWindow=[];for(const t of rest){const a=artist(t);if(a&&artistWindow.slice(-4).includes(a))continue;spread.push(t);artistWindow.push(a);if(spread.length>=49)break}
    const out=head?[head,...spread]:spread;if(id==='top40')return out.slice(0,40);return out.slice(0,50)
  }
  // 15-10-2026: bewust uit. Dit herschikte window.queue, maar dat bestaat niet (de wachtrij zit in JFMQueue) en de
  // programmadirector (window.JFMProgramDirector?.directWithContext) bepaalt de volgorde al. Het draaide wel elke 0,9 s voor niets.
  // Aanzetten verandert wat de zender speelt, dus dat is een eigen keuze. optimize/pure/score blijven bruikbaar.
  function reconcile(){return false}
  function rerank(){return false}
  window.JFMMusicIntelligence={version:'music-intelligence-v4-policy-driven',optimize,pure,score:baseScore,recent:history,reconcile,rerank,tasteWeight};
})();
