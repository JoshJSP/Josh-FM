// Reliable Spotify PKCE for iPhone/PWA. This file intentionally owns only authentication.
(()=>{
  const $=id=>document.getElementById(id),VER='jfm_pkce_verifier',ST='jfm_pkce_state';
  function syncSession(){try{const v=localStorage.getItem(VER),s=localStorage.getItem(ST);if(v)sessionStorage.setItem('jfm_verifier',v);if(s)sessionStorage.setItem('jfm_state',s)}catch{}}
  syncSession();
  async function stableConnect(){const id=spotifyClientId||$('clientId')?.value.trim();if(!id)throw Error('Spotify Client ID ontbreekt.');spotifyClientId=id;localStorage.setItem('jfm_client_id',id);const verifier=rand(),state=rand(20);sessionStorage.setItem('jfm_verifier',verifier);sessionStorage.setItem('jfm_state',state);localStorage.setItem(VER,verifier);localStorage.setItem(ST,state);const challenge=b64url(await sha256(verifier));const p=new URLSearchParams({response_type:'code',client_id:id,scope:SCOPES,redirect_uri:redirectUri(),state,code_challenge_method:'S256',code_challenge:challenge});location.assign('https://accounts.spotify.com/authorize?'+p)}
  window.connect=connect=stableConnect;
  const old=$('connect');if(old){const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',e=>{e.preventDefault();stableConnect().catch(x=>alert(x.message||String(x)))})}
  async function reconcile(){syncSession();try{const t=await ensure();if(t){try{setConnected(true)}catch{};localStorage.removeItem(VER);localStorage.removeItem(ST);const q=$('queueInfo');if(q&&!/live|tracks klaar/i.test(q.textContent||''))q.textContent='Spotify gekoppeld. Josh FM is klaar om te starten.';return true}}catch{}return false}
  setTimeout(reconcile,250);setTimeout(reconcile,1200);window.addEventListener('pageshow',()=>setTimeout(reconcile,250));window.JFMAuth={reconcile,connect:stableConnect};
})();