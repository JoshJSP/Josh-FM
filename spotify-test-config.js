// Josh FM — editable Spotify Client ID + shared Spotify API guard.
(()=>{
  const TEST_KEY='jfm_test_spotify_client_id';
  const CLIENT_KEY='jfm_client_id';
  const DEFAULT_CLIENT_ID='d505870719c6439d9ea3c53108330fe1';
  const input=document.getElementById('clientId');
  if(!input)return;
  const label=input.closest('label');

  function selected(){return String(input.value||localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID).trim()}
  function persist(value){
    const id=String(value||'').trim();
    if(!id)return'';
    if(localStorage.getItem(TEST_KEY)!==id)localStorage.setItem(TEST_KEY,id);
    if(localStorage.getItem(CLIENT_KEY)!==id)localStorage.setItem(CLIENT_KEY,id);
    try{if(spotifyClientId!==id)spotifyClientId=id}catch{}
    return id
  }
  function expose(){
    if(label?.classList.contains('hidden'))label.classList.remove('hidden');
    const saved=localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID;
    if(input.value!==saved)input.value=saved;
    if(input.placeholder!=='Eigen Spotify Client ID voor deze test')input.placeholder='Eigen Spotify Client ID voor deze test';
    if(input.autocomplete!=='off')input.autocomplete='off';
    if(input.readOnly)input.readOnly=false;
  }
  function sync(){expose();persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID)}

  input.addEventListener('input',()=>{const id=String(input.value||'').trim();if(id)persist(id)});
  input.addEventListener('change',()=>{const id=String(input.value||'').trim();if(id)persist(id)});

  try{
    if(typeof callback==='function'){
      const originalCallback=callback;
      callback=async function(...args){persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID);return originalCallback.apply(this,args)}
    }
  }catch{}

  try{
    connect=async function(){
      const id=persist(selected());
      if(!id)return alert('Vul eerst je Spotify Client ID in.');
      const verifier=rand(),state=rand(20);
      sessionStorage.setItem('jfm_verifier',verifier);
      sessionStorage.setItem('jfm_state',state);
      try{localStorage.setItem('jfm_pkce_verifier_v2',verifier);localStorage.setItem('jfm_pkce_state_v2',state)}catch{}
      const challenge=b64url(await sha256(verifier));
      const p=new URLSearchParams({response_type:'code',client_id:id,scope:SCOPES,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge});
      location.href='https://accounts.spotify.com/authorize?'+p
    }
  }catch{}

  // Shared Spotify guard: stop discovery/search from hammering Spotify and only send valid track URIs.
  try{
    if(typeof api==='function'){
      const rawApi=api;
      const searchCache=new Map();
      let searchChain=Promise.resolve(),lastSearchAt=0,cooldownUntil=0,lastRateLimitAt=0;
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const isTrackUri=v=>/^spotify:track:[A-Za-z0-9]{22}$/.test(String(v||''));
      function sanitize(opt={}){
        if(!opt?.body||typeof opt.body==='string')return opt;
        const body={...opt.body};
        if(Array.isArray(body.uris)){
          const before=body.uris.length;
          body.uris=[...new Set(body.uris.filter(isTrackUri))].slice(0,100);
          if(before&&!body.uris.length)throw new Error('Spotify track-URI was ongeldig; afspelen is veilig gestopt.');
        }
        return{...opt,body}
      }
      async function guarded(path,opt={}){
        path=String(path||'');
        if(!path.startsWith('/'))throw new Error('Ongeldige Spotify API-route.');
        const now=Date.now();
        if(now<cooldownUntil)throw new Error(`Spotify rate limit actief. Probeer over ${Math.max(1,Math.ceil((cooldownUntil-now)/1000))} sec opnieuw.`);
        const isSearch=path.startsWith('/search?');
        const key=isSearch?path:'';
        if(isSearch){
          const cached=searchCache.get(key);
          if(cached&&Date.now()-cached.at<60000)return cached.data;
          const run=async()=>{
            const wait=Math.max(0,700-(Date.now()-lastSearchAt));if(wait)await sleep(wait);lastSearchAt=Date.now();
            try{const out=await rawApi(path,sanitize(opt));searchCache.set(key,{at:Date.now(),data:out});return out}
            catch(e){
              const msg=String(e?.message||e);
              if(/rustiger|rate limit|429/i.test(msg)){lastRateLimitAt=Date.now();cooldownUntil=Date.now()+30000;throw new Error('Spotify rate limit actief. Josh FM wacht 30 seconden voordat er opnieuw gezocht wordt.')}
              throw e
            }
          };
          const p=searchChain.then(run,run);searchChain=p.catch(()=>{});return p
        }
        try{return await rawApi(path,sanitize(opt))}
        catch(e){
          const msg=String(e?.message||e);
          if(/rustiger|rate limit|429/i.test(msg)){lastRateLimitAt=Date.now();cooldownUntil=Date.now()+30000}
          throw e
        }
      }
      api=window.api=guarded;
      window.JFMSpotifyGuard={version:'spotify-guard-v1',get state(){return{cooldownUntil,lastRateLimitAt,searchCache:searchCache.size,lastSearchAt}},isTrackUri};
    }
  }catch(e){console.warn('Spotify guard kon niet laden',e)}

  sync();
  setTimeout(sync,250);
  setTimeout(sync,1200);
  window.addEventListener('pageshow',sync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});

  window.JFMSpotifyTestConfig={version:'spotify-test-v5-api-guard',defaultClientId:DEFAULT_CLIENT_ID,selected:()=>localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID,clear:()=>localStorage.removeItem(TEST_KEY)};
})();
