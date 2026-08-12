// Josh FM Live surface — one UI layer over playback, requests, station clock and DJ state.
(()=>{
  const $=id=>document.getElementById(id);
  let installed=false,lastSig='';
  const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const trackLabel=t=>t?`${t.name||'Onbekende track'} · ${(t.artists||[]).join(', ')}`:'—';
  function current(){try{return playback?.item?trackObj(playback.item):null}catch{return null}}
  function upcoming(){try{return window.jfmUpcoming?.()||[]}catch{return[]}}
  function djStatus(){
    try{
      if(window.JFMDJTransition?.busy)return{code:'DJ LIVE',detail:'DJ-break is on air'};
      const p=window.JFMDJTransition?.prefetched;if(p?.ready)return{code:'DJ READY',detail:'Volgende DJ-break is voorbereid'};
      const g=window.JFMDJAudioGuard?.state;if(g&&!g.available)return{code:'DJ SAFE',detail:'Fish tijdelijk in backoff · muziek blijft leidend'};
      if(window.JFMDJAudio?.status?.cacheSize>0)return{code:'DJ READY',detail:'Fish-audio staat klaar'};
    }catch{}
    return{code:'LIVE',detail:'Josh FM is actief'}
  }
  function stationStatus(){
    const t=current();
    try{if(window.JFMRequests?.isRequest?.(t))return'REQUEST'}catch{}
    if(t?._discovery)return'DISCOVERY';
    if(document.getElementById('talk')?.value==='0')return'NON-STOP';
    return'LIVE'
  }
  function ensure(){
    if(installed)return;const now=document.querySelector('.now.card');if(!now)return;
    const hist=$('history')?.closest('.card');if(hist)hist.remove();
    const live=document.createElement('div');live.id='jfmLiveMeta';live.className='jfm-live-meta';live.innerHTML='<div class="jfm-showline"><span id="jfmStationState" class="jfm-pill">LIVE</span><b id="jfmShowName">Josh FM</b><span id="jfmDJState" class="jfm-pill subtle">DJ</span></div><p id="jfmDJDetail" class="muted">Josh FM is klaar.</p>';
    const art=now.querySelector('.art');art?.insertAdjacentElement('beforebegin',live);
    const rail=document.createElement('section');rail.id='jfmNowNextLater';rail.className='jfm-nnl';rail.innerHTML='<div class="jfm-nnl-item now"><span>NU</span><b id="jfmNNLNow">—</b><small id="jfmNNLNowWhy"></small></div><div class="jfm-nnl-item"><span>STRAKS</span><b id="jfmNNLNext">—</b><small id="jfmNNLNextWhy"></small></div><div class="jfm-nnl-item"><span>LATER</span><b id="jfmNNLLater">—</b><small id="jfmNNLLaterWhy"></small></div>';
    const times=now.querySelector('.times');times?.insertAdjacentElement('afterend',rail);
    installed=true;render()
  }
  function why(t){try{return window.JFMRotation?.explain?.(t)||window.JFMProgramDirector?.kind?.(t)||''}catch{return''}}
  function render(){
    if(window.JFMRuntimeModes&&!window.JFMRuntimeModes.shouldRunNonCritical?.())return;
    ensure();if(!installed)return;
    const t=current(),up=upcoming(),n=up[0]||null,l=up[1]||up[2]||null;
    const clock=window.JFMStationClock?.current?.(),dj=djStatus(),state=stationStatus();
    const sig=[t?.id,n?.id,l?.id,clock?.show?.id,clock?.phase,dj.code,state].join('|');
    if(sig===lastSig)return;lastSig=sig;
    if($('jfmStationState'))$('jfmStationState').textContent=state;
    if($('jfmShowName'))$('jfmShowName').textContent=clock?.show?.name||window.JFMRadioClock?.showName?.()||'Josh FM';
    if($('jfmDJState'))$('jfmDJState').textContent=dj.code;
    if($('jfmDJDetail'))$('jfmDJDetail').textContent=dj.detail;
    const set=(id,track,whyId)=>{const e=$(id),w=$(whyId);if(e)e.textContent=trackLabel(track);if(w)w.textContent=track?why(track):''};
    set('jfmNNLNow',t,'jfmNNLNowWhy');set('jfmNNLNext',n,'jfmNNLNextWhy');set('jfmNNLLater',l,'jfmNNLLaterWhy');
  }
  ['jfm:playback-state','jfm:trackchange','jfm:requests-change','jfm:clock-tick','jfm:show-change','jfm:dj-audio-health','jfm:runtime-mode'].forEach(name=>window.addEventListener(name,render));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
  setInterval(()=>{const ms=window.JFMRuntimeModes?.batteryBudget?.().uiIntervalMs||2500;if(Date.now()-(window.__jfmLiveUiAt||0)<ms)return;window.__jfmLiveUiAt=Date.now();render()},2500);
  window.JFMLiveUI={version:'live-ui-v2-runtime-aware',render};
})();
