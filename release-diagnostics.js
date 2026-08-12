// Josh FM release diagnostics v3 — hidden diagnostics, strict category engine and iOS media-session sync.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const CHANNEL_KEY='jfm_music_channel_v1',STRICT_CACHE='jfm_strict_channel_cache_v1';
  let repairing=false,lastRepair='',strictInstalled=false,buildWrapped=false,selected=localStorage.getItem(CHANNEL_KEY)||'mix';
  const queries=id=>({
    hits:'year:2023-2026 genre:pop',
    top40:'year:2025-2026 genre:pop',
    new:'year:2026',
    throwback:'year:1980-2016',
    '00s':'year:2000-2009',
    '10s':'year:2010-2019',
    nl:'genre:dutch',
    party:'genre:dance',
    chill:'genre:chill',
    summer:'genre:"tropical house"'
  })[id]||'';
  const mapTrack=t=>({id:t.id,uri:t.uri,name:t.name,artists:(t.artists||[]).map(a=>a.name),album:t.album?.name||'',release:t.album?.release_date||'',image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||'',url:t.external_urls?.spotify||'',duration:Number(t.duration_ms||0),popularity:Number(t.popularity||0)});
  const currentId=()=>{try{return playback?.item?.id||''}catch{return''}};
  const currentItem=()=>{try{return playback?.item||null}catch{return null}};
  const qget=()=>{try{return Array.isArray(queue)?queue:[]}catch{return[]}};
  const qset=list=>{try{queue=list}catch{}};
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  function cacheRead(){try{return JSON.parse(localStorage.getItem(STRICT_CACHE)||'{}')}catch{return{}}}
  function cacheWrite(x){try{localStorage.setItem(STRICT_CACHE,JSON.stringify(x))}catch{}}
  function diversify(list){const seen=new Set(),artists=new Map(),out=[];for(const t of list){if(!t?.id||!t?.uri||seen.has(t.id))continue;const a=String(t.artists?.[0]||'').toLowerCase();const n=artists.get(a)||0;if(a&&n>=2)continue;seen.add(t.id);if(a)artists.set(a,n+1);out.push(t)}return out}
  function order(id,list){const now=new Date().getFullYear(),year=t=>Number(String(t.release||'').slice(0,4))||0;let x=[...list];if(id==='hits')x.sort((a,b)=>(b.popularity-a.popularity)+(year(b)-year(a))*.5);else if(id==='top40')x.sort((a,b)=>(b.popularity-a.popularity)+(year(b)===now?4:0)-(year(a)===now?4:0));else if(id==='new')x.sort((a,b)=>(year(b)-year(a))||b.popularity-a.popularity);else if(['throwback','00s','10s','nl','party','chill','summer'].includes(id))x.sort((a,b)=>b.popularity-a.popularity);return diversify(x)}
  async function strictTracks(id){
    const query=queries(id);if(!query)return qget();
    const cache=cacheRead(),hit=cache[id];
    if(hit?.at&&Date.now()-hit.at<45*60*1000&&Array.isArray(hit.items)&&hit.items.length>=5)return hit.items;
    const d=await api('/search?type=track&limit=50&q='+encodeURIComponent(query));
    let items=(d?.tracks?.items||[]).filter(t=>t?.id&&t?.uri).map(mapTrack);
    const now=new Date().getFullYear(),yr=t=>Number(String(t.release||'').slice(0,4))||0;
    if(id==='new')items=items.filter(t=>yr(t)===now);
    if(id==='throwback')items=items.filter(t=>yr(t)>0&&yr(t)<=2016);
    if(id==='00s')items=items.filter(t=>yr(t)>=2000&&yr(t)<=2009);
    if(id==='10s')items=items.filter(t=>yr(t)>=2010&&yr(t)<=2019);
    items=order(id,items);
    if(items.length<5)throw Error('Spotify gaf te weinig passende nummers voor dit kanaal.');
    cache[id]={at:Date.now(),items};cacheWrite(cache);return items;
  }
  function paint(id){
    const c=window.JFMMusicChoice?.channels?.[id];
    document.querySelectorAll('[data-jfm-channel]').forEach(b=>{const on=b.dataset.jfmChannel===id;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false')});
    const d=$('channelDescription');if(d&&c)d.textContent=c.desc;
    const mini=$('channelMini');if(mini&&c)mini.textContent=c.label;
    document.body.dataset.musicChannel=id;if(c)window.JFMMusicChannelContext={id,...c};
  }
  async function chooseStrict(id){
    const choice=window.JFMMusicChoice,c=choice?.channels?.[id];if(!c)return false;
    selected=id;try{localStorage.setItem(CHANNEL_KEY,id)}catch{};paint(id);
    if(id==='mix')return choice.__jfmOriginalChoose?choice.__jfmOriginalChoose(id):true;
    status(`Josh FM ${c.label} wordt gemaakt…`);
    try{
      let list=await strictTracks(id),playing=currentId();
      const idx=list.findIndex(t=>t.id&&t.id!==playing);if(idx>0)list=[list[idx],...list.slice(0,idx),...list.slice(idx+1)];
      qset(list.slice(0,id==='top40'?40:50));
      try{window.__jfmStationQueueSig='';window.JFMProgramDirector?.invalidateUpcoming?.('strict-category');window.jfmRenderNext?.();window.JFMProgramDirector?.render?.()}catch{}
      const first=qget()[0];
      if(first?.uri&&window.JFMPlayback?.playUri){const ok=await window.JFMPlayback.playUri(first.uri);if(ok===false)status(`${c.label} is gekozen · tik Play als Spotify niet direct overschakelt.`,true);else status(`${c.label} speelt.`)}
      else status(`${c.label} is gekozen.`);
      setTimeout(()=>window.JFMProgramDirector?.syncSpotifyUpcoming?.(true).catch(()=>{}),450);
      return true;
    }catch(e){status(`${c.label} blijft gekozen · ${String(e?.message||e)}`,true);return true}
  }
  function installStrictChannels(){
    const choice=window.JFMMusicChoice;if(!choice||strictInstalled)return false;strictInstalled=true;
    selected=localStorage.getItem(CHANNEL_KEY)||choice.channel||'mix';
    choice.__jfmOriginalChoose=choice.chooseChannel.bind(choice);
    try{Object.defineProperty(choice,'channel',{configurable:true,get:()=>selected})}catch{}
    choice.chooseChannel=chooseStrict;choice.rebuild=()=>chooseStrict(selected);paint(selected);
    if(!buildWrapped&&typeof window.buildSet==='function'){
      buildWrapped=true;const prior=window.buildSet;
      window.buildSet=async(...args)=>{const r=await prior(...args);if(selected!=='mix')try{qset((await strictTracks(selected)).slice(0,selected==='top40'?40:50))}catch{}paint(selected);try{window.JFMProgramDirector?.invalidateUpcoming?.('strict-build');window.jfmRenderNext?.()}catch{}return qget().length?qget():r};
    }
    return true;
  }
  function hideDiagnostics(){const x=$('jfmDiagnostics');if(x)x.remove()}
  function ensureBanner(){if($('jfmUpdateBanner'))return;const b=document.createElement('div');b.id='jfmUpdateBanner';b.style.cssText='display:none;margin:0 0 14px;padding:12px 14px;border:1px solid #6b4d17;background:#2a2110;border-radius:14px;color:#ffd27b;font-size:12px;font-weight:700';b.innerHTML='<b>Update beschikbaar</b><div style="margin-top:4px;font-weight:500">Sluit Josh FM volledig en open de app opnieuw om de nieuwste versie te laden.</div>';document.querySelector('.shell')?.insertBefore(b,document.querySelector('.tabs')?.nextSibling||null)}
  function render(){hideDiagnostics();ensureBanner();const r=window.JFM_RELEASE||{},b=$('jfmUpdateBanner');if(b)b.style.display=r.updateAvailable?'block':'none';installStrictChannels();syncMediaSession()}
  async function refresh(){try{window.dispatchEvent(new Event('jfm:diagnostics-refresh'));navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_VERSION'});await navigator.serviceWorker?.getRegistration?.().then(r=>r?.update?.()).catch(()=>{});await wait(180)}catch{}render()}
  async function repair(){if(repairing)return;repairing=true;try{await navigator.serviceWorker?.getRegistration?.().then(r=>r?.update?.()).catch(()=>{});try{await window.JFMPlayback?.ensureDevice?.()}catch{};try{await window.JFMPlayback?.recover?.('manual-hidden-diagnostics')}catch{};try{await window.JFMStationQueue?.maintain?.('manual-hidden-diagnostics')}catch{};lastRepair=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});return true}finally{repairing=false;render()}}
  function syncMediaSession(){
    if(!('mediaSession'in navigator)||typeof MediaMetadata==='undefined')return;
    const item=currentItem();if(!item?.id)return;
    const art=item.album?.images?.map?.(x=>({src:x.url,sizes:x.width&&x.height?`${x.width}x${x.height}`:undefined,type:'image/jpeg'})).filter(x=>x.src)||[];
    try{navigator.mediaSession.metadata=new MediaMetadata({title:item.name||'Josh FM',artist:(item.artists||[]).map(a=>a?.name||a).filter(Boolean).join(', '),album:item.album?.name||'Josh FM',artwork:art})}catch{}
    try{navigator.mediaSession.playbackState=item?'playing':'none'}catch{}
    try{const dur=Number(item.duration_ms||0)/1000,position=Number((()=>{try{return playback?.progress_ms||0}catch{return 0}})())/1000;if(dur>0&&position>=0&&position<dur)navigator.mediaSession.setPositionState({duration:dur,position,playbackRate:1})}catch{}
  }
  function actions(){if(!('mediaSession'in navigator))return;for(const [name,fn] of [['play',()=>window.JFMPlayback?.play?.()],['pause',()=>window.JFMPlayback?.pause?.()],['nexttrack',()=>window.JFMPlayback?.next?.()],['previoustrack',()=>window.JFMPlayback?.previous?.()]])try{navigator.mediaSession.setActionHandler(name,fn)}catch{}}
  const boot=()=>{render();actions();setTimeout(render,250);setTimeout(render,900)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('jfm:release-status',render);window.addEventListener('jfm:trackchange',()=>{render();setTimeout(syncMediaSession,250)});window.addEventListener('pageshow',boot);setInterval(()=>{hideDiagnostics();installStrictChannels();syncMediaSession()},2500);
  window.JFMReleaseDiagnostics={version:'diagnostics-v3-hidden-strict-channels',refresh,repair,render,get lastRepair(){return lastRepair}};
})();
