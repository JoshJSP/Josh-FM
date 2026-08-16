// Josh FM v2.2.4 runtime hotfix — Spotify Feb-2026 search limits, robust iOS start, paged channels.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const DEVICE_KEY='jfm_spotify_device_id', SEARCH_LIMIT=10;
  const status=(text,bad=false)=>{const q=document.getElementById('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const truth=()=>window.JFMPlaybackState||null;
  const sdk=()=>window.JFMSpotifySDK||null;
  const player=()=>window.jfmSpotifyPlayer||sdk()?.player||null;

  // Spotify reduced Search limit for Development Mode in Feb 2026. Clamp every legacy search call.
  try{
    const legacyApi=api;
    api=async function(path,opt={}){
      if(typeof path==='string'&&path.startsWith('/search?')){
        const [base,qs='']=path.split('?'),p=new URLSearchParams(qs),n=Number(p.get('limit')||SEARCH_LIMIT);
        p.set('limit',String(Math.max(1,Math.min(SEARCH_LIMIT,Number.isFinite(n)?n:SEARCH_LIMIT))));
        path=base+'?'+p.toString();
      }
      return legacyApi(path,opt);
    };
    window.JFMSpotifySearchCompat={version:'search-limit-10-v1',limit:SEARCH_LIMIT};
  }catch{}

  const remote=async()=>{try{return await api('/me/player')}catch{return null}};
  async function liveDevice(){
    try{player()?.activateElement?.()}catch{}
    for(let i=0;i<30;i++){
      const id=String(sdk()?.deviceId||localStorage.getItem(DEVICE_KEY)||'').trim();
      if(id&&player()){localStorage.setItem(DEVICE_KEY,id);return id}
      if(i===0)try{await sdk()?.init?.()}catch{}
      await wait(120);
    }
    try{const id=String(await sdk()?.ensureDevice?.()||'').trim();if(id){localStorage.setItem(DEVICE_KEY,id);return id}}catch{}
    throw Error('Spotify-device is niet klaar.');
  }
  async function transfer(id,play=false){
    let last='';
    for(let i=0;i<4;i++){
      try{await api('/me/player',{method:'PUT',body:{device_ids:[id],play:!!play}});await wait(220+i*180);return true}catch(e){last=String(e?.message||e);if(!/device|not found/i.test(last))throw e;await wait(350+i*250)}
    }
    throw Error(last||'Device not found');
  }
  async function verifyPlaying(id,uri='',tries=12){for(let i=0;i<tries;i++){await wait(140+i*45);const s=await remote();if(s?.device?.id===id&&s?.is_playing&&s?.item?.id&&(!uri||s.item.uri===uri))return s}return null}
  async function playUris(uris,{firstUri='',source='v224'}={}){
    uris=[...new Set((uris||[]).filter(x=>/^spotify:track:[A-Za-z0-9]{22}$/.test(String(x))))].slice(0,30);
    if(!uris.length)throw Error('Geen afspeelbare nummers beschikbaar.');
    let id=await liveDevice(),last='';
    try{const s=await remote();if(s?.device?.id!==id)await transfer(id,false)}catch(e){last=String(e?.message||e)}
    for(let attempt=0;attempt<4;attempt++){
      try{
        await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris,position_ms:0}});
        const s=await verifyPlaying(id,firstUri||uris[0],12);if(s){try{playback=s;renderPlayback(s)}catch{};try{truth()?.ingest?.(s,source);truth()?.setExpectedLive?.(true,'radio-live')}catch{};return s}
        last='Spotify bevestigde het starten niet.';
      }catch(e){last=String(e?.message||e)}
      if(!/device|not found|confirm|bevestigde/i.test(last))break;
      await wait(450+attempt*350);
      try{if(attempt===1){id=String(await sdk()?.reconnect?.()||id);localStorage.setItem(DEVICE_KEY,id)}else await transfer(id,false)}catch{}
    }
    // Last fallback through the SDK helper, which can register a newly-created browser device.
    try{await sdk()?.playUris?.(uris);const fresh=String(sdk()?.deviceId||id);const s=await verifyPlaying(fresh,firstUri||uris[0],10);if(s){try{playback=s;renderPlayback(s)}catch{};try{truth()?.ingest?.(s,source);truth()?.setExpectedLive?.(true,'radio-live')}catch{};return s}}catch(e){last=String(e?.message||e)}
    throw Error(last||'Spotify kon geen actieve track starten.');
  }
  async function robustStart(){
    try{
      if(!Array.isArray(queue)||!queue.length){status('Radioset wordt gemaakt…');await buildSet()}
      const uris=(queue||[]).map(x=>x?.uri).filter(Boolean).slice(0,30);if(!uris.length)throw Error('De radioset bevat geen afspeelbare tracks.');
      status('Muziek wordt gestart…');const s=await playUris(uris,{firstUri:uris[0],source:'v224-start'});
      try{session=[];lastTrackId=s?.item?.id||null;renderHistory();scheduleTalk();startPolling()}catch{}
      status(`Josh FM is live · ${queue.length} tracks klaar.`);return true;
    }catch(e){try{truth()?.setExpectedLive?.(false,'v224-start-failed')}catch{};status('Starten lukte niet: '+String(e?.message||e),true);return false}
  }
  async function robustPlayUri(uri){try{const list=Array.isArray(queue)?queue:[],idx=list.findIndex(x=>x?.uri===uri),uris=(idx>=0?list.slice(idx):list).map(x=>x?.uri).filter(Boolean).slice(0,30);await playUris(uris.length?uris:[uri],{firstUri:uri,source:'v224-uri'});return true}catch(e){status('Track starten mislukt: '+String(e?.message||e),true);return false}}
  function ownStart(){const old=document.getElementById('start');if(!old||old.dataset.jfmOwner==='v224')return;const b=old.cloneNode(true);old.replaceWith(b);b.disabled=false;b.dataset.jfmOwner='v224';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();try{player()?.activateElement?.()}catch{};robustStart().catch(()=>{})},true)}
  function exposePlayback(){if(!window.JFMPlayback)return false;window.JFMPlayback.start=robustStart;window.JFMPlayback.playUri=robustPlayUri;window.JFMPlayback.playQueue=playUris;window.JFMPlayback.hotfix='v224-start-device-race';return true}

  const CHANNEL_QUERY=id=>{const now=new Date().getFullYear();return{hits:`year:${Math.max(2022,now-3)}-${now}`,top40:`year:${Math.max(2025,now-1)}-${now}`,new:`year:${now}`,throwback:'year:1980-2016','00s':'year:2000-2009','10s':'year:2010-2019',nl:'genre:dutch',party:'genre:dance',chill:'genre:chill',summer:`genre:pop year:${Math.max(2020,now-6)}-${now}`}[id]||''};
  const toTrack=t=>({id:t.id,uri:t.uri,name:t.name,artists:(t.artists||[]).map(a=>a.name),album:t.album?.name||'',release:t.album?.release_date||'',image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||'',url:t.external_urls?.spotify||'',duration:t.duration_ms||0,popularity:Number(t.popularity||0)});
  const dedupe=list=>{const s=new Set();return(list||[]).filter(t=>t?.id&&t?.uri&&!s.has(t.id)&&(s.add(t.id),true))};
  async function pagedSearch(q,max=40){const out=[];for(let offset=0;offset<max;offset+=SEARCH_LIMIT){const d=await api('/search?type=track&limit=10&offset='+offset+'&q='+encodeURIComponent(q));const items=d?.tracks?.items||[];out.push(...items);if(items.length<SEARCH_LIMIT)break;await wait(80)}return dedupe(out.map(toTrack))}
  async function choosePaged(id){
    const choice=window.JFMMusicChoice,c=choice?.channels?.[id];if(!choice||!c)return false;
    if(id==='mix'){try{return await choice._legacyChoose?.(id)}catch{return robustStart()}}
    try{
      status(`Josh FM ${c.label} wordt gemaakt…`);const found=await pagedSearch(CHANNEL_QUERY(id),id==='top40'?40:30);if(found.length<5)throw Error(`${c.label}: te weinig Spotify-resultaten.`);
      queue=found.slice(0,id==='top40'?40:50);localStorage.setItem('jfm_music_channel_v1',id);try{window.__jfmStationQueueSig=''}catch{};window.jfmRenderNext?.();window.JFMProgramDirector?.render?.();choice.renderBattle?.();
      document.querySelectorAll('[data-jfm-channel]').forEach(b=>b.classList.toggle('active',b.dataset.jfmChannel===id));document.body.dataset.musicChannel=id;window.JFMMusicChannelContext={id,...c};
      await playUris(queue.map(x=>x.uri),{firstUri:queue[0].uri,source:'v224-channel'});status(`${queue.length} tracks klaar · ${c.label} speelt.`);return true;
    }catch(e){status('Kanaal wisselen mislukt: '+String(e?.message||e),true);return false}
  }
  function patchChoice(){const c=window.JFMMusicChoice;if(!c||c.hotfix==='v224-search-pagination')return !!c;if(!c._legacyChoose)c._legacyChoose=c.chooseChannel.bind(c);c.chooseChannel=choosePaged;c.rebuild=choosePaged;c.hotfix='v224-search-pagination';return true}

  function boot(){ownStart();exposePlayback();patchChoice()}
  boot();setTimeout(boot,250);setTimeout(boot,1000);window.addEventListener('pageshow',()=>setTimeout(boot,150));window.addEventListener('online',()=>setTimeout(boot,250));
  setInterval(()=>{exposePlayback();patchChoice();ownStart()},5000);
  window.JFMReleaseHotfix={version:'v224',searchLimit:SEARCH_LIMIT,playUris,robustStart,pagedSearch,choosePaged};
})();
