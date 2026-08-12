// Josh FM integration guards — contracts between legacy code and central controllers.
(()=>{
  const $=id=>document.getElementById(id),log=[];
  function trace(stage,detail={}){log.unshift({at:Date.now(),stage,...detail});if(log.length>60)log.length=60}

  function enforceFishUI(){
    const select=$('voiceMode');if(select){[...select.options].forEach(o=>{if(o.value!=='fish')o.remove()});select.value='fish';select.disabled=true}
    const info=$('voiceInfo');if(info)info.textContent='Fish Audio is de enige DJ-stem. Bij een storing slaat Josh FM de break over en blijft de muziek spelen.';
  }

  function aliasContracts(){
    if(window.JFMTop40&&!window.JFMPersonalTop40)window.JFMPersonalTop40=window.JFMTop40;
  }

  function installBuildSetGuard(){
    if(window.__jfmBuildSetGuardInstalled||typeof window.buildSet!=='function')return;
    const oldBuild=window.buildSet;window.__jfmBuildSetGuardInstalled=true;
    window.buildSet=buildSet=async function(...args){
      const slider=$('discovery'),runtime=window.JFMRuntimeModes?.state?.()||{},battery=!!runtime.battery,data=!!runtime.data;
      const qState=window.JFMStationQueue?.state?.();
      if(battery&&document.visibilityState!=='visible'&&qState?.remaining>6){trace('build-deferred',{reason:'battery-background',remaining:qState.remaining});return Array.isArray(queue)?queue:[]}
      let originalValue=null;
      if(data&&slider){originalValue=slider.value;const cap=window.JFMRuntimeModes?.dataBudget?.()?.maxDiscoveryPercent??30;slider.value=String(Math.min(Number(slider.value)||0,cap));trace('discovery-capped',{from:Number(originalValue)||0,to:Number(slider.value)||0})}
      try{return await oldBuild.apply(this,args)}finally{if(originalValue!==null&&slider)slider.value=originalValue}
    };
    trace('build-guard-installed')
  }

  const MEMORY_KEYS=[
    'jfm_skips','jfm_requests_v1','jfm_director_memory','jfm_long_radio_memory','jfm_dj_feedback','jfm_radio_suite',
    'jfm_discovery_diag_v3','jfm_discovery_diag_v4','jfm_imaging_history_v1','jfm_dj_recent_lang_v2','jfm_dj_intents_v2'
  ];
  const SESSION_KEYS=['jfm_station_queue_v4','jfm_playback_truth_v1'];
  function clearPersonalMemory(){
    for(const k of MEMORY_KEYS)try{localStorage.removeItem(k)}catch{}
    for(const k of SESSION_KEYS)try{sessionStorage.removeItem(k)}catch{}
    try{session=[];renderHistory()}catch{}
    try{window.JFMPlaybackState?.reset?.()}catch{}
    trace('personal-memory-cleared',{keys:MEMORY_KEYS.length});
  }
  function installClearMemoryOwner(){
    const old=$('clearHistory');if(!old||old.dataset.jfmDataOwner==='v35')return;
    const b=old.cloneNode(true);old.replaceWith(b);b.dataset.jfmDataOwner='v35';
    b.addEventListener('click',()=>{
      if(!confirm('Wis lokaal luistergedrag, skips, verzoeken en DJ-voorkeuren? Je Spotify-koppeling, instellingen en aparte Top 40 blijven behouden.'))return;
      clearPersonalMemory();b.textContent='Lokaal geheugen gewist';setTimeout(()=>location.reload(),450)
    })
  }
  async function disconnectSpotify(){
    try{window.jfmSpotifyPlayer?.disconnect?.()}catch{}
    for(const k of ['jfm_token','jfm_refresh','jfm_exp','jfm_spotify_device_id','jfm_streaming_ready_v2','jfm_auth_requested_streaming','jfm_pkce_verifier_v2','jfm_pkce_state_v2'])try{localStorage.removeItem(k)}catch{}
    for(const k of ['jfm_verifier','jfm_state'])try{sessionStorage.removeItem(k)}catch{}
    try{token=null;refreshToken=null;expiresAt=0;clearInterval(poll)}catch{}
    try{window.JFMPlaybackState?.reset?.()}catch{}
    try{setConnected(false)}catch{}
    trace('spotify-disconnected')
  }
  function installLogoutOwner(){
    const old=$('logout');if(!old||old.dataset.jfmLogoutOwner==='v35')return;
    const b=old.cloneNode(true);old.replaceWith(b);b.dataset.jfmLogoutOwner='v35';
    b.addEventListener('click',()=>disconnectSpotify().catch(()=>{}))
  }

  function sanity(){
    const checks={playback:!!window.JFMPlayback,truth:!!window.JFMPlaybackState,queue:!!window.JFMStationQueue,clock:!!window.JFMStationClock,rotation:!!window.JFMRotation,requests:!!window.JFMRequests,fish:!!window.JFMDJAudioGuard,pwa:!!window.JFMPWA,runtime:!!window.JFMRuntimeModes,top40:!!window.JFMTop40,health:!!window.JFMStationHealth,djHandoff:!!window.JFMDJHandoff};
    const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);if(missing.length)trace('missing-controllers',{missing});else trace('contracts-ok');return{checks,missing}
  }

  function install(){enforceFishUI();aliasContracts();installBuildSetGuard();installClearMemoryOwner();installLogoutOwner();setTimeout(()=>{aliasContracts();installBuildSetGuard();installClearMemoryOwner();installLogoutOwner();sanity()},1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.addEventListener('jfm:runtime-mode',()=>{enforceFishUI();aliasContracts()});
  window.addEventListener('pageshow',()=>{installClearMemoryOwner();installLogoutOwner()});
  window.JFMIntegrationGuards={version:'integration-v3-data-auth-safe',sanity,log:()=>[...log],enforceFishUI,clearPersonalMemory,disconnectSpotify};
})();
