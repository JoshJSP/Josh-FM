// Josh FM Spotify-authoritative upcoming UI — never show predicted tracks as Straks/Later.
(()=>{
  const $=id=>document.getElementById(id);
  const WATCHDOG_MS=15000,FORCE_DEDUPE_MS=1200;
  let syncing=false,lastCurrent='',lastItems=[],lastOk=0,lastAttempt=0,cooldownUntil=0,lastError='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function map(t){if(!t?.id)return null;return{id:t.id,uri:t.uri||'',name:t.name||'',artists:(t.artists||[]).map(a=>a?.name||a).filter(Boolean),image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||''}}
  function paint(items=[],loading=false){
    const box=$('directorQueue'),next=$('nextUp');
    if(!box)return;
    if(loading&&!items.length){box.innerHTML='<p class="muted">Spotify-wachtrij synchroniseren…</p>';if(next)next.textContent='…';return}
    if(!items.length){box.innerHTML='<p class="muted">Spotify geeft momenteel geen volgende nummers door.</p>';if(next)next.textContent='—';return}
    box.innerHTML=items.slice(0,6).map((t,i)=>`<div class="director-track"><span class="director-num">${i+1}</span>${t.image?`<img src="${esc(t.image)}" alt="">`:''}<div class="director-meta"><b>${esc(t.name)}</b><span>${esc((t.artists||[]).join(', '))}</span></div><em>${i===0?'Straks':'Later'}</em></div>`).join('');
    if(next){const t=items[0];next.textContent=t?`${t.name} · ${(t.artists||[]).join(', ')}`:'—'}
  }
  function noteCooldown(error){const text=String(error?.message||error||'');lastError=text;const m=text.match(/over\s+(\d+)\s*sec/i);if(m){const seconds=Math.max(2,Number(m[1])||2);cooldownUntil=Math.max(cooldownUntil,Date.now()+seconds*1000+500)}}
  async function sync(force=false){
    const now=Date.now();
    if(syncing||!navigator.onLine||now<cooldownUntil)return false;
    if(now-lastAttempt<(force?FORCE_DEDUPE_MS:WATCHDOG_MS-500))return false;
    syncing=true;lastAttempt=now;
    try{
      if(force||!lastItems.length)paint(lastItems,true);
      const d=await api('/me/player/queue');
      const current=d?.currently_playing?.id||'';
      const seen=new Set(current?[current]:[]),items=[];
      for(const raw of d?.queue||[]){const t=map(raw);if(!t?.id||seen.has(t.id))continue;seen.add(t.id);items.push(t);if(items.length>=6)break}
      lastCurrent=current;lastItems=items;lastOk=Date.now();lastError='';paint(items,false);
      try{window.__jfmSpotifyUpcomingTruth={current,items:[...items],at:lastOk}}catch{}
      return true;
    }catch(e){
      noteCooldown(e);
      // Never substitute MAIR's predicted queue. Keep the last Spotify-confirmed queue briefly.
      if(lastItems.length&&Date.now()-lastOk<30000)paint(lastItems,false);else paint([],true);
      return false;
    }finally{syncing=false}
  }
  function invalidate(){lastItems=[];lastCurrent='';paint([],true);setTimeout(()=>sync(true),250)}
  const boot=()=>{paint([],true);sync(true)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('jfm:trackchange',invalidate);
  window.addEventListener('jfm:natural-next-ready',()=>setTimeout(()=>sync(true),1400));
  window.addEventListener('jfm:requests-change',()=>setTimeout(()=>sync(true),250));
  window.addEventListener('pageshow',()=>setTimeout(()=>sync(true),250));
  setInterval(()=>sync(false),WATCHDOG_MS);
  const upcoming=()=>[...lastItems];window.jfmUpcoming=upcoming;
  window.JFMSpotifyUpcomingTruth={version:'v2-single-authoritative-owner-rate-limit-aware',sync,upcoming,get items(){return[...lastItems]},get current(){return lastCurrent},get lastOk(){return lastOk},get syncing(){return syncing},get health(){return{watchdogMs:WATCHDOG_MS,cooldownMs:Math.max(0,cooldownUntil-Date.now()),lastAttempt,lastError}}};
})();