// Josh FM channel tap guard v3 — resilient iOS taps + Spotify Search API 2026 compatibility.
(()=>{
  let switching=false,lastTap=0,retryToken=0;
  const choice=()=>window.JFMMusicChoice;
  const status=(text,bad=false)=>{const q=document.getElementById('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  function installSearchCompat(){
    if(window.__jfmSpotifySearchCompat||typeof window.api!=='function')return false;
    const base=window.api;
    const wrapped=async function(path,opt={}){
      if(typeof path==='string'&&path.startsWith('/search?')){
        try{
          const i=path.indexOf('?'),params=new URLSearchParams(path.slice(i+1));
          const requested=Number(params.get('limit')||10);
          if(!Number.isFinite(requested)||requested>10)params.set('limit','10');
          path=path.slice(0,i)+'?'+params.toString();
        }catch{}
      }
      return base(path,opt);
    };
    try{window.api=wrapped;api=wrapped}catch{window.api=wrapped}
    window.__jfmSpotifySearchCompat=true;
    window.JFMSpotifySearchCompat={version:'search-limit-10-2026',maxLimit:10};
    return true;
  }
  installSearchCompat();
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  function buttons(){return [...document.querySelectorAll('[data-jfm-channel]')]}
  function paint(target,loading=false){buttons().forEach(b=>{const active=b.dataset.jfmChannel===target;b.classList.toggle('active',active);b.classList.toggle('loading',active&&loading);b.setAttribute('aria-pressed',active?'true':'false');b.disabled=!!loading&&!active});const d=document.getElementById('channelDescription'),c=choice()?.channels?.[target];if(d&&c)d.textContent=loading?`${c.label} wordt geladen…`:c.desc}
  async function retryPlayback(id,token){const apiChoice=choice(),c=apiChoice?.channels?.[id];if(!apiChoice||!c||token!==retryToken)return false;for(let i=0;i<3;i++){await wait(i?650:220);if(token!==retryToken||apiChoice.channel!==id)return false;try{const uri=Array.isArray(window.queue)?window.queue[0]?.uri:'';if(uri&&window.JFMPlayback?.playUri){const ok=await window.JFMPlayback.playUri(uri);if(ok!==false){status(`Josh FM ${c.label} speelt.`);return true}}}catch{}}try{if(token===retryToken&&apiChoice.channel===id&&window.JFMPlayback?.start){const ok=await window.JFMPlayback.start();if(ok!==false){status(`Josh FM ${c.label} speelt.`);return true}}}catch{}if(token===retryToken&&apiChoice.channel===id)status(`${c.label} is gekozen · Spotify kon nog niet starten. Tik Play om opnieuw te proberen.`,true);return false}
  async function select(id){installSearchCompat();const apiChoice=choice(),c=apiChoice?.channels?.[id];if(!apiChoice||!c||switching)return false;switching=true;const token=++retryToken;paint(id,true);status(`Josh FM ${c.label} wordt gemaakt…`);const playback=window.JFMPlayback,originalPlayUri=playback?.playUri;let deferredStart=false;
    try{
      if(playback&&typeof originalPlayUri==='function')playback.playUri=async(...args)=>{try{const ok=await originalPlayUri.apply(playback,args);if(ok===false)deferredStart=true;return true}catch{deferredStart=true;return true}};
      const ok=await apiChoice.chooseChannel(id);
      if(ok===false&&apiChoice.channel!==id)throw Error(`${c.label} kon niet worden geladen.`);
      paint(id,false);
      if(deferredStart||apiChoice.channel===id)retryPlayback(id,token).catch(()=>{});
      return true;
    }catch(e){paint(apiChoice.channel,false);status('Kanaal wisselen mislukt: '+String(e?.message||e),true);return false}
    finally{if(playback&&typeof originalPlayUri==='function')playback.playUri=originalPlayUri;switching=false;buttons().forEach(b=>b.disabled=false)}
  }
  function delegated(e){const b=e.target?.closest?.('[data-jfm-channel]');if(!b)return;e.preventDefault();e.stopPropagation();const now=Date.now();if(now-lastTap<250)return;lastTap=now;select(b.dataset.jfmChannel).catch(()=>{})}
  function harden(){installSearchCompat();buttons().forEach(b=>{b.type='button';b.style.touchAction='manipulation';b.setAttribute('role','button');b.setAttribute('aria-pressed',b.dataset.jfmChannel===choice()?.channel?'true':'false')});const pane=document.getElementById('tab-choose');if(pane&&!pane.dataset.jfmDelegated){pane.dataset.jfmDelegated='1';pane.addEventListener('click',delegated,true);pane.addEventListener('touchend',e=>{const b=e.target?.closest?.('[data-jfm-channel]');if(!b)return;e.preventDefault();delegated(e)}, {capture:true,passive:false})}}
  function ensureSpotifyUpcomingTruth(){if(window.JFMSpotifyUpcomingTruth||document.querySelector('script[data-jfm-upcoming-truth]'))return;const s=document.createElement('script');s.src='spotify-upcoming-truth.js';s.async=false;s.dataset.jfmUpcomingTruth='1';document.head.appendChild(s)}
  const boot=()=>{installSearchCompat();harden();ensureSpotifyUpcomingTruth();setTimeout(harden,250);setTimeout(harden,900)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('pageshow',boot);window.addEventListener('jfm:release-status',boot);setInterval(harden,4000);
  window.JFMChannelTapGuard={version:'v3-ios-search-limit-10',select,harden,get switching(){return switching}};
})();
