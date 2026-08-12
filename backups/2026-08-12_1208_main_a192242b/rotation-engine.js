// Josh FM Rotation Engine — categories, cooldowns, artist separation and explainable programming.
(()=>{
  const RECENT_WINDOW=24,ARTIST_WINDOW=7,TRACK_COOLDOWN_PLAYS=18;
  const nowYear=()=>new Date().getFullYear();
  const norm=s=>String(s||'').toLowerCase().trim();
  function memory(){try{return window.jfmDirectorMemory?.()||JSON.parse(localStorage.getItem('jfm_director_memory')||'{}')}catch{return{}}}
  function skips(){try{return typeof skipMap==='function'?skipMap():JSON.parse(localStorage.getItem('jfm_skips')||'{}')}catch{return{}}}
  function history(){try{return window.JFMRadioSuite?.state?.()||{lastIds:[],lastArtists:[]}}catch{return{lastIds:[],lastArtists:[]}}}
  function year(t){return Number(String(t?.release||'').slice(0,4))||0}
  function artist(t){return norm(t?.artists?.[0]||'')}
  function requested(t){try{return !!window.JFMRequests?.isRequest?.(t)||!!window.jfmIsRequest?.(t)}catch{return false}}
  function category(t){
    if(requested(t))return'Request';
    if(t?._discovery)return'Discovery';
    const m=memory(),likes=Number(m.likes?.[t?.id]||0),plays=Number(m.plays?.[t?.id]||0),y=year(t),age=y?nowYear()-y:0;
    if(likes>=2||plays>=5)return'Power';
    if(y&&age<=2)return'Current';
    if(y&&age>=10)return'Throwback';
    return'Familiar'
  }
  function cooldownPenalty(t){
    const h=history(),ids=(h.lastIds||[]).slice(0,RECENT_WINDOW),artists=(h.lastArtists||[]).slice(0,ARTIST_WINDOW).map(norm);
    const idIndex=ids.indexOf(t?.id),a=artist(t),artistIndex=a?artists.indexOf(a):-1;let p=0;
    if(idIndex>=0)p-=idIndex<TRACK_COOLDOWN_PLAYS?-40+(idIndex*1.4):-8;
    if(artistIndex===0)p-=28;else if(artistIndex===1)p-=18;else if(artistIndex===2)p-=12;else if(artistIndex>=3)p-=Math.max(3,9-artistIndex);
    return p
  }
  function preferenceScore(t){
    const m=memory(),s=skips(),id=t?.id||'';
    return Number(m.likes?.[id]||0)*3.8-Number(s[id]||0)*4.4+Number(m.discoveryWins?.[id]||0)*2.8-Number(m.discoveryLosses?.[id]||0)*4.4
  }
  function transitionPenalty(t,out=[]){
    const a=artist(t),recent=(out||[]).slice(-7),cat=category(t);let p=0;
    for(let back=1;back<=recent.length;back++)if(a&&a===artist(recent[recent.length-back]))p-=[0,32,22,15,10,7,5,3][back]||3;
    if(cat==='Discovery'&&recent.slice(-2).some(x=>category(x)==='Discovery'))p-=14;
    if(cat==='Throwback'&&recent.slice(-3).filter(x=>category(x)==='Throwback').length>=2)p-=6;
    if(cat==='Request'&&recent.slice(-3).some(requested))p-=12;
    return p
  }
  function score(t,out=[]){return cooldownPenalty(t)+preferenceScore(t)+transitionPenalty(t,out)}
  function reason(t){
    if(requested(t))return'Jouw verzoek staat gepland in de uitzending.';
    if(t?._discovery)return t._discoveryReason||'Nieuwe muziek die past bij je luisterprofiel.';
    const m=memory(),s=skips(),id=t?.id||'',c=category(t);
    if(Number(m.likes?.[id]||0)>0)return'Je hebt eerder positief op deze track gereageerd.';
    if(Number(s[id]||0)>0)return`${c} rotation, maar met lagere prioriteit door eerdere skips.`;
    if(c==='Power')return'Een sterke persoonlijke favoriet in de Power rotation.';
    if(c==='Current')return'Relatief nieuwe muziek die bij je profiel past.';
    if(c==='Throwback')return'Een bekende oudere track voor spreiding in de mix.';
    return'Vertrouwde muziek die past bij je luisterprofiel.'
  }
  function annotate(t){if(!t)return t;t._rotationCategory=category(t);t._why=reason(t);return t}
  function annotateAll(list=[]){return(list||[]).map(annotate)}
  function isHardBlocked(t){
    if(requested(t))return false;
    const ids=(history().lastIds||[]).slice(0,TRACK_COOLDOWN_PLAYS);
    return !!t?.id&&ids.includes(t.id)
  }
  window.JFMRotation={version:'rotation-v1-explainable',category,score,reason,annotate,annotateAll,isHardBlocked,cooldownPenalty,preferenceScore};
})();
