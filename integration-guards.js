// Josh FM integration guards — lightweight contracts between legacy code and new controllers.
(()=>{
  const $=id=>document.getElementById(id),log=[];
  function trace(stage,detail={}){log.unshift({at:Date.now(),stage,...detail});if(log.length>60)log.length=60}

  function enforceFishUI(){
    const select=$('voiceMode');if(select){[...select.options].forEach(o=>{if(o.value!=='fish')o.remove()});select.value='fish';select.disabled=true}
    const info=$('voiceInfo');if(info)info.textContent='Fish Audio is de enige DJ-stem. Bij een storing slaat Josh FM de break over en blijft de muziek spelen.';
  }

  function aliasContracts(){
    // Backward compatibility for any code that still uses an older controller name.
    if(window.JFMTop40&&!window.JFMPersonalTop40)window.JFMPersonalTop40=window.JFMTop40;
    if(window.JFMPlayback&&!window.jfmSpotifyPlayer)window.jfmSpotifyPlayer=window.JFMPlayback;
  }

  function installBuildSetGuard(){
    if(window.__jfmBuildSetGuardInstalled||typeof window.buildSet!=='function')return;
    const oldBuild=window.buildSet;window.__jfmBuildSetGuardInstalled=true;
    window.buildSet=buildSet=async function(...args){
      const slider=$('discovery'),runtime=window.JFMRuntimeModes?.state?.()||{},battery=!!runtime.battery,data=!!runtime.data;
      const qState=window.JFMStationQueue?.state?.();
      // In Battery Friendly mode, avoid non-critical background regeneration while hidden if enough music remains.
      if(battery&&document.visibilityState!=='visible'&&qState?.remaining>6){trace('build-deferred',{reason:'battery-background',remaining:qState.remaining});return Array.isArray(queue)?queue:[]}
      let originalValue=null;
      if(data&&slider){originalValue=slider.value;const cap=window.JFMRuntimeModes?.dataBudget?.()?.maxDiscoveryPercent??30;slider.value=String(Math.min(Number(slider.value)||0,cap));trace('discovery-capped',{from:Number(originalValue)||0,to:Number(slider.value)||0})}
      try{return await oldBuild.apply(this,args)}finally{if(originalValue!==null&&slider)slider.value=originalValue}
    };
    trace('build-guard-installed')
  }

  function sanity(){
    const checks={playback:!!window.JFMPlayback,truth:!!window.JFMPlaybackState,queue:!!window.JFMStationQueue,clock:!!window.JFMStationClock,rotation:!!window.JFMRotation,requests:!!window.JFMRequests,fish:!!window.JFMDJAudioGuard,pwa:!!window.JFMPWA,runtime:!!window.JFMRuntimeModes,top40:!!window.JFMTop40,health:!!window.JFMStationHealth};
    const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);if(missing.length)trace('missing-controllers',{missing});else trace('contracts-ok');return{checks,missing}
  }

  function install(){enforceFishUI();aliasContracts();installBuildSetGuard();setTimeout(()=>{aliasContracts();installBuildSetGuard();sanity()},1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.addEventListener('jfm:runtime-mode',()=>{enforceFishUI();aliasContracts()});
  window.JFMIntegrationGuards={version:'integration-v1-contracts',sanity,log:()=>[...log],enforceFishUI};
})();
