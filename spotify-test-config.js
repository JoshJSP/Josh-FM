// Josh FM — editable Spotify Client ID + shared Spotify API/auth guard.
(()=>{
  const TEST_KEY='jfm_test_spotify_client_id',CLIENT_KEY='jfm_client_id',DEVICE_KEY='jfm_spotify_device_id',DEFAULT_CLIENT_ID='d505870719c6439d9ea3c53108330fe1',ASSET=String(window.JFM_ASSET_VERSION||'48');
  const asset=src=>`${src}${src.includes('?')?'&':'?'}v=${encodeURIComponent(ASSET)}`;

  // Web Playback device IDs belong to one browser/SDK runtime. A persisted ID from
  // an older PWA session is only stale state and must never become playback authority.
  try{localStorage.removeItem(DEVICE_KEY)}catch{}

  // Harden the existing app.js refresh flow without touching UI or click handling.
  // Only Spotify's definitive invalid_grant may destroy the refresh credential.
  let authRefreshError='',authRefreshStatus=0,authReauthRequired=false,authRefreshFailures=0,lastAuthRefreshAt=0;
  function installHardenedAuth(){
    try{
      if(typeof ensure!=='function'||typeof timedFetch!=='function'||typeof saveToken!=='function')return false;
      const hardenedEnsure=async function(){
        if(token&&Date.now()<expiresAt)return token;
        if(!refreshToken)return null;
        if(tokenRefreshPromise)return tokenRefreshPromise;
        const id=spotifyClientId||localStorage.getItem(CLIENT_KEY);if(!id)return null;
        tokenRefreshCount++;lastAuthRefreshAt=Date.now();authRefreshError='';authRefreshStatus=0;authReauthRequired=false;
        tokenRefreshPromise=(async()=>{
          const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:refreshToken,client_id:id});
          let r;
          try{r=await timedFetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})}
          catch(e){authRefreshFailures++;authRefreshError=String(e?.message||e||'Netwerkfout').slice(0,240);const err=new Error('Spotify-token vernieuwen is tijdelijk niet gelukt. MAIR probeert het later opnieuw.');err.code='AUTH_REFRESH_RECOVERABLE';throw err}
          if(!r.ok){
            let detail={};try{detail=await r.json()}catch{}
            const code=String(detail?.error||''),description=String(detail?.error_description||'');authRefreshStatus=r.status;authRefreshError=(description||code||`HTTP ${r.status}`).slice(0,240);authRefreshFailures++;
            if(code==='invalid_grant'){
              authReauthRequired=true;clearSpotifySession();
              const err=new Error('Spotify-sessie is verlopen. Koppel Spotify opnieuw.');err.code='AUTH_REAUTH_REQUIRED';throw err
            }
            const err=new Error(`Spotify-token vernieuwen is tijdelijk niet gelukt (${r.status}). MAIR probeert het later opnieuw.`);err.code='AUTH_REFRESH_RECOVERABLE';err.status=r.status;throw err
          }
          const data=await r.json();saveToken(data);authRefreshError='';authRefreshStatus=r.status;authRefreshFailures=0;authReauthRequired=false;return token
        })().finally(()=>{tokenRefreshPromise=null});
        return tokenRefreshPromise
      };
      ensure=hardenedEnsure;window.ensure=hardenedEnsure;
      if(window.JFMAuth){window.JFMAuth.ensure=hardenedEnsure;window.JFMAuth.version='auth-v3-preserve-refresh'}
      window.MAIRSpotifySessionReliability={
        version:'spotify-session-v2-pkce-durable',
        ensure:hardenedEnsure,
        get state(){return{refreshError:authRefreshError,refreshStatus:authRefreshStatus,reauthRequired:authReauthRequired,refreshFailures:authRefreshFailures,lastRefreshAt:lastAuthRefreshAt,hasRefreshToken:!!refreshToken,hasAccessToken:!!token}}
      };
      return true
    }catch(e){console.warn('MAIR auth hardening kon niet laden',e);return false}
  }
  installHardenedAuth();

  // Quiet device recovery only. No overlays, observers, capture listeners or DOM state
  // rewrites are installed here; normal MAIR controls keep their existing ownership.
  let deviceRepairPromise=null,lastDeviceRepairAt=0,lastDeviceRepairError='';
  async function refreshDeviceHint(reason='automatic'){
    const auth=window.JFMAuth?.state||{};
    if(!(auth.hasRefreshToken||auth.hasAccessToken))return false;
    if(deviceRepairPromise)return deviceRepairPromise;
    if(Date.now()-lastDeviceRepairAt<2500)return false;
    lastDeviceRepairAt=Date.now();lastDeviceRepairError='';
    deviceRepairPromise=(async()=>{
      const sdk=window.JFMSpotifySDK;if(!sdk)return false;
      const live=String(sdk.deviceId||'').trim();if(live){try{localStorage.setItem(DEVICE_KEY,live)}catch{};return true}
      try{localStorage.removeItem(DEVICE_KEY)}catch{}
      let id='';
      try{id=String(await sdk.ensureDevice?.()||'').trim()}catch(e){lastDeviceRepairError=String(e?.message||e||'device unavailable').slice(0,240)}
      if(!id){try{id=String(await sdk.reconnect?.()||'').trim()}catch(e){lastDeviceRepairError=String(e?.message||e||'device reconnect failed').slice(0,240)}}
      if(id){try{localStorage.setItem(DEVICE_KEY,id)}catch{};lastDeviceRepairError='';try{window.dispatchEvent(new CustomEvent('mair:spotify-device-recovered',{detail:{reason,deviceId:id,at:Date.now()}}))}catch{};return true}
      return false
    })().finally(()=>{deviceRepairPromise=null});
    return deviceRepairPromise
  }
  function scheduleDeviceRefresh(reason,delay=900){setTimeout(()=>refreshDeviceHint(reason).catch(()=>false),delay)}

  const input=document.getElementById('clientId');if(!input)return;const label=input.closest('label');
  function selected(){return String(input.value||localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID).trim()}
  function persist(value){const id=String(value||'').trim();if(!id)return'';if(localStorage.getItem(TEST_KEY)!==id)localStorage.setItem(TEST_KEY,id);if(localStorage.getItem(CLIENT_KEY)!==id)localStorage.setItem(CLIENT_KEY,id);try{if(spotifyClientId!==id)spotifyClientId=id}catch{}return id}
  function expose(){if(label?.classList.contains('hidden'))label.classList.remove('hidden');const saved=localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID;if(input.value!==saved)input.value=saved;if(input.placeholder!=='Eigen Spotify Client ID voor deze test')input.placeholder='Eigen Spotify Client ID voor deze test';if(input.autocomplete!=='off')input.autocomplete='off';if(input.readOnly)input.readOnly=false}
  function sync(){expose();persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID)}
  function restorePkceRoundTrip(){
    try{
      const verifier=localStorage.getItem('jfm_pkce_verifier_v2')||localStorage.getItem('jfm_pkce_verifier')||'';
      const state=localStorage.getItem('jfm_pkce_state_v2')||localStorage.getItem('jfm_pkce_state')||'';
      if(verifier&&!sessionStorage.getItem('jfm_verifier'))sessionStorage.setItem('jfm_verifier',verifier);
      if(state&&!sessionStorage.getItem('jfm_state'))sessionStorage.setItem('jfm_state',state);
    }catch{}
  }
  function clearPkceRoundTrip(){try{['jfm_pkce_verifier_v2','jfm_pkce_state_v2','jfm_pkce_verifier','jfm_pkce_state'].forEach(k=>localStorage.removeItem(k))}catch{}}
  restorePkceRoundTrip();
  input.addEventListener('input',()=>{const id=String(input.value||'').trim();if(id)persist(id)});input.addEventListener('change',()=>{const id=String(input.value||'').trim();if(id)persist(id)});
  try{if(typeof callback==='function'){const originalCallback=callback;callback=async function(...args){persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID);restorePkceRoundTrip();const out=await originalCallback.apply(this,args);if(new URLSearchParams(location.search).get('code'))clearPkceRoundTrip();return out}}}catch{}
  try{connect=async function(){const id=persist(selected());if(!id)return alert('Vul eerst je Spotify Client ID in.');const verifier=rand(),state=rand(20);sessionStorage.setItem('jfm_verifier',verifier);sessionStorage.setItem('jfm_state',state);try{localStorage.setItem('jfm_pkce_verifier_v2',verifier);localStorage.setItem('jfm_pkce_state_v2',state)}catch{}const challenge=b64url(await sha256(verifier));const p=new URLSearchParams({response_type:'code',client_id:id,scope:SCOPES,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge});location.href='https://accounts.spotify.com/authorize?'+p}}catch{}
  try{
    if(typeof api==='function'){
      const rawApi=api,searchCache=new Map();let searchChain=Promise.resolve(),lastSearchAt=0,cooldownUntil=0,lastRateLimitAt=0;
      const sleep=ms=>new Promise(r=>setTimeout(r,ms)),isTrackUri=v=>/^spotify:track:[A-Za-z0-9]{22}$/.test(String(v||'')),isDevice=v=>/^[A-Za-z0-9_-]{8,128}$/.test(String(v||''));
      function sanitizeBody(opt={}){if(!opt?.body||typeof opt.body==='string')return opt;const body={...opt.body};if(Array.isArray(body.uris)){const before=body.uris.length;body.uris=[...new Set(body.uris.filter(isTrackUri))].slice(0,100);if(before&&!body.uris.length)throw new Error('Spotify track-URI was ongeldig; afspelen is veilig gestopt.')}if(Array.isArray(body.device_ids)){body.device_ids=body.device_ids.map(String).filter(isDevice);if(!body.device_ids.length)throw new Error('Spotify device-ID was ongeldig; de opdracht is niet verstuurd.')}return{...opt,body}}
      function validatePath(path){if(!path.startsWith('/'))throw new Error('Ongeldige Spotify API-route.');let u;try{u=new URL(path,'https://api.spotify.com')}catch{throw new Error('Ongeldige Spotify API-route.')}if(u.pathname==='/me/player/queue'){const uri=u.searchParams.get('uri');if(uri&&!isTrackUri(uri))throw new Error('Spotify request bevatte een ongeldige track-URI en is niet verstuurd.')}if(u.pathname.startsWith('/tracks/')){const id=decodeURIComponent(u.pathname.slice('/tracks/'.length));if(!/^[A-Za-z0-9]{22}$/.test(id))throw new Error('Ongeldig Spotify track-ID.')}const device=u.searchParams.get('device_id');if(device&&!isDevice(device))throw new Error('Spotify request bevatte een ongeldig device-ID en is niet verstuurd.');return path}
      function rateLimitError(e){return/rustiger|rate limit|429|wacht .*sec|too many requests/i.test(String(e?.message||e))}
      function enterCooldown(ms=60000){lastRateLimitAt=Date.now();cooldownUntil=Math.max(cooldownUntil,Date.now()+Math.max(30000,ms))}
      async function guarded(path,opt={}){path=validatePath(String(path||''));const now=Date.now(),isSearch=path.startsWith('/search?');if(now<cooldownUntil&&isSearch)throw new Error(`Spotify discovery wacht nog ${Math.max(1,Math.ceil((cooldownUntil-now)/1000))} sec.`);const cleanOpt=sanitizeBody(opt),key=isSearch?path:'';if(isSearch){const cached=searchCache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.data;const run=async()=>{const wait=Math.max(0,1500-(Date.now()-lastSearchAt));if(wait)await sleep(wait);lastSearchAt=Date.now();try{const out=await rawApi(path,cleanOpt);searchCache.set(key,{at:Date.now(),data:out});if(searchCache.size>60){const oldest=[...searchCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,15);oldest.forEach(([k])=>searchCache.delete(k))}return out}catch(e){if(rateLimitError(e)){enterCooldown();throw new Error('Spotify rate limit actief. Discovery wacht 60 seconden; gewone playback blijft beschikbaar.')}throw e}};const p=searchChain.then(run,run);searchChain=p.catch(()=>{});return p}try{return await rawApi(path,cleanOpt)}catch(e){if(rateLimitError(e))enterCooldown();throw e}}
      api=window.api=guarded;window.JFMSpotifyGuard={version:'spotify-guard-v4-budget-safe',get state(){return{cooldownUntil,lastRateLimitAt,searchCache:searchCache.size,lastSearchAt}},isTrackUri,isDevice,validatePath};
    }
  }catch(e){console.warn('Spotify guard kon niet laden',e)}
  function loadScriptOnce(selector,src,datasetKey,onerror){if(document.querySelector(selector))return;const s=document.createElement('script');s.src=asset(src);s.async=false;s.dataset[datasetKey]='1';s.onerror=onerror;document.body.appendChild(s)}
  function loadApiBudget(){if(window.JFMSpotifyApiBudget)return;loadScriptOnce('script[data-jfm-api-budget]','./spotify-api-budget.js','jfmApiBudget',()=>console.warn('Josh FM: Spotify API budget kon niet laden'))}
  sync();loadApiBudget();setTimeout(sync,250);setTimeout(sync,1200);scheduleDeviceRefresh('boot',1400);
  window.addEventListener('pageshow',()=>{restorePkceRoundTrip();sync();loadApiBudget();scheduleDeviceRefresh('pageshow',700)});
  window.addEventListener('online',()=>scheduleDeviceRefresh('online',700));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){restorePkceRoundTrip();sync();loadApiBudget();scheduleDeviceRefresh('visible',700)}});
  window.JFMSpotifyTestConfig={version:'spotify-test-v15-pkce-durable',assetVersion:ASSET,defaultClientId:DEFAULT_CLIENT_ID,selected:()=>localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID,clear:()=>localStorage.removeItem(TEST_KEY),refreshDeviceHint,get deviceState(){return{repairing:!!deviceRepairPromise,lastRepairAt:lastDeviceRepairAt,lastRepairError:lastDeviceRepairError}}};
})();