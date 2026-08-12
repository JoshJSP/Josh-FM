// Josh FM release/update diagnostics v1
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  function ensureUi(){
    if(!$('jfmUpdateBanner')){const b=document.createElement('div');b.id='jfmUpdateBanner';b.style.cssText='display:none;margin:0 0 14px;padding:12px 14px;border:1px solid #6b4d17;background:#2a2110;border-radius:14px;color:#ffd27b;font-size:12px;font-weight:700';b.innerHTML='<b>Update beschikbaar</b><div style="margin-top:4px;font-weight:500">Sluit Josh FM volledig en open de app opnieuw om de nieuwste versie te laden.</div>';document.querySelector('.shell')?.insertBefore(b,document.querySelector('.tabs')?.nextSibling||null)}
    if(!$('jfmDiagnostics')){const pane=$('tab-settings');if(!pane)return;const a=document.createElement('article');a.id='jfmDiagnostics';a.className='card';a.innerHTML='<div class="kicker">DIAGNOSE</div><h3>App-status</h3><div id="diagRows" class="muted">Diagnose wordt geladen…</div><button id="diagRefresh" class="secondary" type="button">Vernieuw diagnose</button>';const version=document.querySelector('.versionbox');pane.insertBefore(a,version||null);$('diagRefresh')?.addEventListener('click',refresh)}
  }
  function playbackText(){try{const s=window.JFMPlayback?.state||window.JFMPlaybackState?.get?.();if(!s)return'Onbekend';return s.isPlaying||s.is_playing?'Speelt':'Gepauzeerd'}catch{return'Onbekend'}}
  function rows(){const r=window.JFM_RELEASE||{},device=localStorage.getItem('jfm_spotify_device_id')||'geen',health=window.JFMPlayback?.health||{};return [
    ['Versie','v'+(r.version||'?')],['Server build',r.build||'onbekend'],['App-cache',r.localCache||'geen actieve cache'],['Server-cache',r.serverCache||'onbekend'],['Update',r.updateAvailable?'Beschikbaar':'Actueel'],['Spotify-device',device?device.slice(0,12)+(device.length>12?'…':''):'geen'],['Playback',playbackText()],['Playback-fouten',String(health.failures??0)],['Herstelacties',String(health.recoveries??0)]
  ]}
  function render(){ensureUi();const r=window.JFM_RELEASE||{},banner=$('jfmUpdateBanner');if(banner)banner.style.display=r.updateAvailable?'block':'none';const host=$('diagRows');if(host)host.innerHTML=rows().map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #222831"><span>${k}</span><b style="color:#d7dde6;text-align:right;overflow-wrap:anywhere">${v}</b></div>`).join('')}
  async function refresh(){try{window.dispatchEvent(new Event('jfm:diagnostics-refresh'));await wait(150)}catch{}render()}
  ensureUi();render();window.addEventListener('jfm:release-status',render);window.addEventListener('jfm:trackchange',render);window.addEventListener('pageshow',()=>setTimeout(render,250));setInterval(render,15000);
  window.JFMReleaseDiagnostics={version:'diagnostics-v1',refresh,render};
})();
