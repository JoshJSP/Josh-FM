// Josh FM — editable Spotify Client ID override for preview/test URLs.
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
    localStorage.setItem(TEST_KEY,id);
    localStorage.setItem(CLIENT_KEY,id);
    try{spotifyClientId=id}catch{}
    return id
  }
  function expose(){
    label?.classList.remove('hidden');
    const saved=localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID;
    if(!input.value||input.value!==saved)input.value=saved;
    input.placeholder='Eigen Spotify Client ID voor deze test';
    input.autocomplete='off';
    input.readOnly=false;
  }

  // app.js may fill/hide this field after /api/config resolves. Keep the manual test field visible.
  const observer=new MutationObserver(()=>{
    expose();
    const saved=localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID;
    persist(saved)
  });
  if(label)observer.observe(label,{attributes:true,subtree:true,childList:true});

  input.addEventListener('input',()=>{const id=String(input.value||'').trim();if(id)persist(id)});
  input.addEventListener('change',()=>{const id=String(input.value||'').trim();if(id)persist(id)});

  // The normal app boot starts before this file and can receive the Vercel Client ID from /api/config.
  // Before processing Spotify's callback, force the locally selected test ID back in place.
  try{
    if(typeof callback==='function'){
      const originalCallback=callback;
      callback=async function(...args){
        persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID);
        return originalCallback.apply(this,args)
      }
    }
  }catch{}

  // Always prefer what is visibly typed in the field when the user taps Koppel Spotify.
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

  expose();
  persist(localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID);
  setTimeout(expose,250);
  setTimeout(expose,1500);
  window.JFMSpotifyTestConfig={version:'spotify-test-v3-prefilled',defaultClientId:DEFAULT_CLIENT_ID,selected:()=>localStorage.getItem(TEST_KEY)||DEFAULT_CLIENT_ID,clear:()=>localStorage.removeItem(TEST_KEY)};
})();
