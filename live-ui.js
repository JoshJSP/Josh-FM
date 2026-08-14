// MAIR live surface — now/next/later over playback, requests, station clock and DJ state.
(()=>{
  const $=id=>document.getElementById(id);
  let installed=false,lastSig='';
  const trackLabel=t=>t?`${t.name||'Onbekende track'} · ${(t.artists||[]).join(', ')}`:'—';
  function current(){try{return playback?.item?trackObj(playback.item):null}catch{return null}}
  function upcoming(){try{return window.jfmUpcoming?.()||[]}catch{return[]}}
  function ensure(){
    if(installed)return;const now=document.querySelector('.now.card');if(!now)return;
    // MAIR has its own live header. Never add the legacy jfmLiveMeta block again.
    document.querySelectorAll('#jfmLiveMeta').forEach(x=>x.remove());
    const hist=$('history')?.closest('.card');if(hist)hist.remove();
    let rail=$('jfmNowNextLater');
    if(!rail){
      rail=document.createElement('section');rail.id='jfmNowNextLater';rail.className='jfm-nnl';
      rail.innerHTML='<div class="jfm-nnl-item now"><span>NU</span><b id="jfmNNLNow">—</b><small id="jfmNNLNowWhy"></small></div><div class="jfm-nnl-item"><span>STRAKS</span><b id="jfmNNLNext">—</b><small id="jfmNNLNextWhy"></small></div><div class="jfm-nnl-item"><span>LATER</span><b id="jfmNNLLater">—</b><small id="jfmNNLLaterWhy"></small></div>';
      const times=now.querySelector('.times');times?.insertAdjacentElement('afterend',rail);
    }
    installed=true;render()
  }
  function why(t){try{return window.JFMRotation?.explain?.(t)||window.JFMProgramDirector?.kind?.(t)||''}catch{return''}}
  function render(){
    if(window.JFMRuntimeModes&&!window.JFMRuntimeModes.shouldRunNonCritical?.())return;
    ensure();if(!installed)return;
    document.querySelectorAll('#jfmLiveMeta').forEach(x=>x.remove());
    const t=current(),up=upcoming(),n=up[0]||null,l=up[1]||up[2]||null;
    const clock=window.JFMStationClock?.current?.();
    const sig=[t?.id,n?.id,l?.id,clock?.show?.id,clock?.phase].join('|');
    if(sig===lastSig)return;lastSig=sig;
    const set=(id,track,whyId)=>{const e=$(id),w=$(whyId);if(e)e.textContent=trackLabel(track);if(w)w.textContent=track?why(track):''};
    set('jfmNNLNow',t,'jfmNNLNowWhy');set('jfmNNLNext',n,'jfmNNLNextWhy');set('jfmNNLLater',l,'jfmNNLLaterWhy');
  }
  ['jfm:playback-state','jfm:trackchange','jfm:requests-change','jfm:clock-tick','jfm:show-change','jfm:runtime-mode'].forEach(name=>window.addEventListener(name,render));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
  setInterval(()=>{const ms=window.JFMRuntimeModes?.batteryBudget?.().uiIntervalMs||2500;if(Date.now()-(window.__jfmLiveUiAt||0)<ms)return;window.__jfmLiveUiAt=Date.now();render()},2500);
  window.JFMLiveUI={version:'mair-live-ui-v3-no-duplicate-meta',render};
})();
