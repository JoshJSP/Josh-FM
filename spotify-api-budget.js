// Josh FM Spotify API budget — SDK events first, slow Web API watchdog second.
(()=>{
  const POLL_MS=15000;
  let lastEventRefresh=0,eventTimer=null;
  function install(){
    if(window.__jfmApiBudgetInstalled||typeof window.startPolling!=='function'||typeof window.refresh!=='function')return false;
    window.__jfmApiBudgetInstalled=true;
    window.startPolling=startPolling=function(){
      try{clearInterval(poll)}catch{}
      poll=setInterval(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{})},POLL_MS)
    };
    const eventRefresh=()=>{
      const now=Date.now();if(now-lastEventRefresh<500)return;lastEventRefresh=now;
      clearTimeout(eventTimer);eventTimer=setTimeout(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{})},120)
    };
    window.addEventListener('jfm:trackchange',eventRefresh);
    window.addEventListener('online',()=>setTimeout(()=>refresh().catch(()=>{}),500));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>refresh().catch(()=>{}),300)});
    try{if(token)startPolling()}catch{}
    window.JFMSpotifyApiBudget={version:'api-budget-v1-event-driven',pollMs:POLL_MS,eventDriven:true};
    return true
  }
  if(!install()){let tries=0;const boot=()=>{if(install())return;if(++tries<80)setTimeout(boot,100)};boot()}
})();
