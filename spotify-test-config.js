// Josh FM — test/preview Spotify Client ID override
(()=>{
  const input=document.getElementById('clientId');
  if(!input)return;
  const label=input.closest('label');
  const saved=localStorage.getItem('jfm_test_spotify_client_id')||'';
  const apply=value=>{
    const id=String(value||'').trim();
    if(!id)return;
    try{spotifyClientId=id}catch{}
    localStorage.setItem('jfm_client_id',id);
    localStorage.setItem('jfm_test_spotify_client_id',id);
  };
  const expose=()=>{
    label?.classList.remove('hidden');
    if(saved){input.value=saved;apply(saved)}
    input.placeholder='Eigen Spotify Client ID voor deze test';
    input.autocomplete='off';
  };
  expose();
  setTimeout(expose,1200);
  input.addEventListener('input',()=>apply(input.value));
  input.addEventListener('change',()=>apply(input.value));
})();
