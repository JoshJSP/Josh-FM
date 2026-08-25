// Josh FM Spotify API budget — SDK events first, conservative Web API watchdog second.
(()=>{
  const POLL_MS=30000,EVENT_DEDUPE_MS=1800;
  let lastEventRefresh=0,eventTimer=null,cooldownUntil=0,lastError='';
  function noteCooldown(error){const text=String(error?.message||error||'');lastError=text;const m=text.match(/over\s+(\d+)\s*sec/i);if(m){const seconds=Math.max(2,Number(m[1])||2);cooldownUntil=Math.max(cooldownUntil,Date.now()+seconds*1000+500)}}
  async function safeRefresh(){if(document.visibilityState!=='visible'||Date.now()<cooldownUntil)return false;try{await refresh();lastError='';return true}catch(e){noteCooldown(e);return false}}
  function install(){
    if(window.__jfmApiBudgetInstalled||typeof window.startPolling!=='function'||typeof window.refresh!=='function')return false;
    window.__jfmApiBudgetInstalled=true;
    window.startPolling=startPolling=function(){
      try{clearInterval(poll)}catch{}
      poll=setInterval(()=>{safeRefresh()},POLL_MS)
    };
    const eventRefresh=()=>{
      const now=Date.now();if(now-lastEventRefresh<EVENT_DEDUPE_MS)return;lastEventRefresh=now;
      clearTimeout(eventTimer);eventTimer=setTimeout(()=>safeRefresh(),350)
    };
    window.addEventListener('jfm:trackchange',eventRefresh);
    window.addEventListener('online',()=>setTimeout(()=>safeRefresh(),900));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>safeRefresh(),900)});
    try{if(token)startPolling()}catch{}
    window.JFMSpotifyApiBudget={version:'api-budget-v2-rate-limit-aware',pollMs:POLL_MS,eventDriven:true,get cooldownMs(){return Math.max(0,cooldownUntil-Date.now())},get lastError(){return lastError}};
    return true
  }
  if(!install()){let tries=0;const boot=()=>{if(install())return;if(++tries<80)setTimeout(boot,100)};boot()}
})();