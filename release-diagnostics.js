// MAIR release/update diagnostics — diagnostics only; station playback has one owner.
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  let repairing=false,lastRepair='';

  function removeLegacyUpdateBanner(){
    const banner=$('jfmUpdateBanner');
    if(banner&&/Sluit MAIR volledig/i.test(banner.textContent||''))banner.remove();
  }

  function ensureUi(){
    removeLegacyUpdateBanner();
    if(!$('jfmDiagnostics')){
      const pane=$('tab-settings');if(!pane)return;
      const a=document.createElement('article');a.id='jfmDiagnostics';a.className='card';
      a.innerHTML='<div class="kicker">ALGEMENE MAIR STATUS</div><h3>App-status</h3><p class="muted">Controleert versie, cache, Spotify-device, playback en herstelstatus.</p><div id="diagRows" class="muted">Diagnose wordt geladen…</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="diagRefresh" class="secondary" type="button">Vernieuw status</button><button id="diagRepair" class="secondary" type="button">Herstel MAIR</button></div><p id="diagRepairInfo" class="muted" style="margin-top:9px">Herstel synchroniseert cache, Spotify-device, playerstate en wachtrij zonder je voorkeuren te wissen.</p>';
      const version=document.querySelector('.versionbox');pane.insertBefore(a,version||null);
      $('diagRefresh')?.addEventListener('click',refresh);$('diagRepair')?.addEventListener('click',repair);
    }
  }

  function playbackText(){try{const s=window.JFMPlayback?.state||window.JFMPlaybackState?.get?.();if(!s)return'Onbekend';return s.isPlaying||s.is_playing?'Speelt':'Gepauzeerd'}catch{return'Onbekend'}}
  function rows(){
    const r=window.JFM_RELEASE||{},device=localStorage.getItem('jfm_spotify_device_id')||'geen',health=window.JFMPlayback?.health||{};
    return [
      ['Versie','v'+(r.version||'?')],['Server build',r.build||'onbekend'],['Assetversie',String(r.asset||window.JFM_ASSET_VERSION||'?')],
      ['App-cache',r.localCache||'geen actieve cache'],['Server-cache',r.serverCache||'onbekend'],['Update',r.updateAvailable?'Beschikbaar':'Actueel'],
      ['Spotify-device',device?device.slice(0,12)+(device.length>12?'…':''):'geen'],['Playback',playbackText()],
      ['Playback-fouten',String(health.failures??0)],['Herstelacties',String(health.recoveries??0)],['Laatste herstel',lastRepair||'nog niet']
    ];
  }
  function render(){
    ensureUi();
    const diag=$('jfmDiagnostics');if(diag){diag.style.display='';diag.removeAttribute('aria-hidden')}
    const host=$('diagRows');if(host)host.innerHTML=rows().map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #222831"><span>${k}</span><b style="color:#d7dde6;text-align:right;overflow-wrap:anywhere">${v}</b></div>`).join('');
    window.MAIRDiagnosticsHub?.sync?.();
  }
  async function refresh(){
    try{window.dispatchEvent(new Event('jfm:diagnostics-refresh'));navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_VERSION'});await navigator.serviceWorker?.getRegistration?.().then(r=>r?.update?.()).catch(()=>{});await wait(220)}catch{}
    render();
  }
  async function repair(){
    if(repairing)return;repairing=true;const b=$('diagRepair'),info=$('diagRepairInfo');
    if(b){b.disabled=true;b.textContent='Herstellen…'}if(info)info.textContent='MAIR synchroniseert de app veilig…';const results=[];
    try{
      try{await navigator.serviceWorker?.getRegistration?.().then(r=>r?.update?.());results.push('cache')}catch{}
      try{window.dispatchEvent(new Event('jfm:diagnostics-refresh'));navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_VERSION'})}catch{}
      try{if(window.JFMPlayback?.ensureDevice){await window.JFMPlayback.ensureDevice();results.push('device')}}catch{results.push('device-fout')}
      try{if(window.JFMPlayback?.recover){await window.JFMPlayback.recover('manual-diagnostics');results.push('playback')}}catch{results.push('playback-fout')}
      try{await window.JFMStationQueue?.maintain?.('manual-diagnostics');results.push('wachtrij')}catch{}
      try{window.JFMIntegrationGuards?.sanity?.();window.JFMStationHealth?.applySafeMode?.()}catch{}
      lastRepair=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});await wait(250);render();
      if(info)info.textContent=results.includes('playback-fout')||results.includes('device-fout')?'Herstel deels uitgevoerd. Controleer de regels hierboven of koppel Spotify opnieuw.':'Herstel voltooid zonder je persoonlijke voorkeuren te wissen.';
    }finally{repairing=false;if(b){b.disabled=false;b.textContent='Herstel MAIR'}}
  }

  ensureUi();render();
  window.addEventListener('jfm:release-status',render);window.addEventListener('jfm:trackchange',render);window.addEventListener('pageshow',()=>setTimeout(render,250));
  window.JFMReleaseDiagnostics={version:'diagnostics-v4-single-station-owner',refresh,repair,render,get lastRepair(){return lastRepair}};
})();
