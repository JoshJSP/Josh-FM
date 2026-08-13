// Josh FM Product Beta Build 3 — central queue intelligence, category purity and anti-repeat.
(()=>{
  if(window.JFMMusicIntelligence)return;
  const HISTORY='jfm_music_recent_v3',norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}},save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const year=t=>Number(String(t?.release||'').slice(0,4))||0,artist=t=>norm(t?.artists?.[0]||''),sig=t=>norm(t?.name)+'|'+artist(t),channel=()=>localStorage.getItem('jfm_music_channel_v1')||'mix';
  const nlArtists=['roxy dekker','yves berendse','suzan freek','flemming','snelle','maan','antoon','s10','goldband','claude','bankzitters','bizzey','ronnie flex','frenna','broederliefde','donnie','gers pardoel','guus meeuwis','andre hazes','tino martin','mart hoogkamer','wesly bronkhorst','jan smit','nick simon','blof','acda en de munnik','de jeugd van tegenwoordig','kris kross amsterdam','nielson','diggy dex','jaap reesema','meau','hannah mae'];
  function pure(t,id=channel()){
    const y=year(t),a=artist(t);if(!t?.id||!t?.uri)return false;
    if(id==='new')return y===new Date().getFullYear();
    if(id==='throwback')return y>0&&y<=2016;
    if(id==='00s')return y>=2000&&y<=2009;
    if(id==='10s')return y>=2010&&y<=2019;
    if(id==='nl')return nlArtists.some(n=>a.includes(n));
    return true;
  }
  function history(){return load(HISTORY,[])}
  function remember(t){if(!t?.id)return;const h=history().filter(x=>x.id!==t.id);h.unshift({id:t.id,artist:artist(t),at:Date.now()});save(HISTORY,h.slice(0,80))}
  function recentPenalty(t){const h=history(),a=artist(t);let p=0;h.slice(0,18).forEach((x,i)=>{if(x.id===t.id)p+=80-Math.min(60,i*4);if(a&&x.artist===a)p+=24-Math.min(18,i)});return p}
  function baseScore(t){const pop=Number(t?.popularity||0),fresh=year(t)>=new Date().getFullYear()-1?4:0,taste=Number(window.JFMTasteModel?.score?.(t)||0);return pop*.12+fresh+taste-recentPenalty(t)}
  function optimize(input,id=channel()){
    const seenId=new Set(),seenSig=new Set(),valid=[];
    for(const t of Array.isArray(input)?input:[]){const s=sig(t);if(!pure(t,id)||seenId.has(t?.id)||seenSig.has(s))continue;seenId.add(t.id);seenSig.add(s);valid.push(t)}
    const currentId=String(window.JFMPlaybackState?.get?.()?.trackId||window.playback?.item?.id||'');let head=null,rest=valid;
    if(currentId){const i=valid.findIndex(t=>t.id===currentId);if(i>=0){head=valid[i];rest=valid.filter((_,n)=>n!==i)}}
    rest=[...rest].sort((a,b)=>baseScore(b)-baseScore(a)+((Math.random()-.5)*1.2));
    const spread=[],artistWindow=[];for(const t of rest){const a=artist(t);if(a&&artistWindow.slice(-3).includes(a))continue;spread.push(t);artistWindow.push(a);if(spread.length>=49)break}
    const out=head?[head,...spread]:spread;if(id==='top40')return out.slice(0,40);return out.slice(0,50)
  }
  let lastSig='',applying=false;
  function reconcile(){if(applying||!Array.isArray(window.queue)||window.queue.length<2)return;const id=channel(),s=id+'|'+window.queue.map(t=>t?.id).join(',');if(s===lastSig)return;lastSig=s;const next=optimize(window.queue,id);if(next.length<Math.min(5,window.queue.length))return;const changed=next.map(t=>t.id).join(',')!==window.queue.map(t=>t?.id).join(',');if(!changed)return;applying=true;window.queue=next;try{window.__jfmStationQueueSig='';window.jfmRenderNext?.();window.JFMProgramDirector?.invalidateUpcoming?.('music-intelligence-v3');window.JFMProgramDirector?.render?.()}finally{applying=false}}
  function rerank(){lastSig='';reconcile()}
  window.addEventListener('jfm:trackchange',e=>{const id=e?.detail?.trackId;const t=(window.queue||[]).find(x=>x?.id===id);if(t)remember(t);setTimeout(reconcile,100)});
  setInterval(reconcile,900);setTimeout(reconcile,800);
  window.JFMMusicIntelligence={version:'music-intelligence-v3',optimize,pure,score:baseScore,recent:history,reconcile,rerank};
})();