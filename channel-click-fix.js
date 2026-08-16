// MAIR station controller — single authoritative station owner with resilient quality fallback.
(()=>{
  'use strict';
  let switching=false,lastTap=0,buildProtected=false,policyLoading=false;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const POOL_CACHE='mair_station_pool_cache_v5_nl_editorial_strict',CACHE_TTL=12*60*60*1000,NL_EDITORIAL_SOURCE='spotify-editorial-je-moerstaal';
  const choice=()=>window.JFMMusicChoice,status=(text,bad=false)=>{const q=document.getElementById('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const policy=()=>window.MAIRStationPolicy;
  const stationIdFromButton=b=>String(b?.dataset?.jfmChannel||b?.dataset?.mairStation||'');
  function stationLabel(id){return choice()?.channels?.[id]?.label||policy()?.label?.(id)||({hits:'MAIR HITS',top40:'MAIR TOP 40',new:'MAIR DISCOVERY',nl:'MAIR NEDERLANDSTALIG',party:'MAIR PARTY',chill:'MAIR CHILL',summer:'MAIR SUMMER',throwback:'MAIR THROWBACK','00s':'MAIR 00s','10s':'MAIR 10s',mix:'MY MAIR'}[id]||String(id||'MAIR').toUpperCase())}
  function showActiveStation(id,label=stationLabel(id)){let badge=document.getElementById('mairActiveStation');if(!badge){badge=document.createElement('div');badge.id='mairActiveStation';badge.className='mair-active-station';const art=document.querySelector('#tab-radio .art');art?.parentNode?.insertBefore(badge,art)}if(badge){badge.textContent=label;badge.dataset.station=id}const mode=document.getElementById('mairRadioMode');if(mode)mode.textContent=label;try{localStorage.setItem('mair_active_station_label_v1',label)}catch{}}
  function ensurePolicy(){if(policy())return true;if(policyLoading||document.getElementById('mairStationPolicyJs'))return false;policyLoading=true;const s=document.createElement('script');s.id='mairStationPolicyJs';s.src='./mair-station-policy.js?v=4';s.dataset.mairStationPolicy='1';s.onload=()=>{policyLoading=false;own()};s.onerror=()=>{policyLoading=false;status('Stations konden niet worden geladen.',true)};document.head.appendChild(s);return false}
  const toTrack=t=>({id:t.id,uri:t.uri,name:t.name,artists:(t.artists||[]).map(a=>a.name),album:t.album?.name||'',release:t.album?.release_date||'',image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||'',url:t.external_urls?.spotify||'',duration:t.duration_ms||0});
  const chartTrack=t=>({id:String(t?.id||''),uri:String(t?.uri||''),name:String(t?.name||''),artists:Array.isArray(t?.artists)?t.artists.map(String):[],album:String(t?.album||''),release:String(t?.release||''),image:String(t?.image||''),url:String(t?.url||''),duration:Number(t?.duration||0),rank:Number(t?.rank||0),chartScore:Number(t?.chartScore||0),chartSources:Array.isArray(t?.chartSources)?t.chartSources:[]});
  const queries=id=>policy()?.queries?.(id)||[];
  const dedupe=list=>{const s=new Set();return(list||[]).filter(t=>t?.id&&t?.uri&&!s.has(t.id)&&(s.add(t.id),true))};
  function readPools(){try{return JSON.parse(localStorage.getItem(POOL_CACHE)||'{}')}catch{return{}}}
  function cachedPool(id){const x=readPools()?.[id];if(id==='nl'&&x?.source!==NL_EDITORIAL_SOURCE)return[];return x?.at&&Date.now()-Number(x.at)<CACHE_TTL&&Array.isArray(x.items)?dedupe(x.items):[]}
  function savePool(id,items,source='station-pool'){if(!id||!items?.length)return;if(id==='nl'&&source!==NL_EDITORIAL_SOURCE)return;try{const all=readPools();all[id]={at:Date.now(),source,items:dedupe(items).slice(0,50)};localStorage.setItem(POOL_CACHE,JSON.stringify(all))}catch{}}
  async function search(q){const d=await api('/search?type=track&limit=10&q='+encodeURIComponent(q));return(d?.tracks?.items||[]).filter(t=>t?.id&&t?.uri).map(toTrack)}
  async function dutchChartPool(id){
    if(!['hits','top40','nl'].includes(id))return null;
    const r=await fetch('/api/nl-charts?station='+encodeURIComponent(id),{cache:'no-store'}),d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(String(d?.detail||d?.error||`Nederlandse playlist HTTP ${r.status}`));
    const tracks=dedupe((Array.isArray(d?.items)?d.items:[]).map(chartTrack));
    if(tracks.length<(policy()?.minTracks?.(id)||5))throw Error('Nederlandse playlist leverde tijdelijk te weinig Spotify-tracks.');
    return{tracks,verified:true,fallback:false,source:String(d?.source||'Nederlandse Spotify-playlist')};
  }
  async function semanticQualityFilter(id,list){if(!policy()?.needsSemantic?.(id))return{list,verified:true};const min=policy()?.confidence?.(id)||.90;try{const r=await fetch('/api/category-filter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:id,minConfidence:min,tracks:list.slice(0,40)})});if(!r.ok)return{list,verified:false};const d=await r.json(),accepted=new Set((Array.isArray(d?.accepted)?d.accepted:[]).filter(x=>Number(x?.confidence)>=min).map(x=>String(x.id))),filtered=list.filter(t=>accepted.has(String(t.id))),minimum=policy()?.minTracks?.(id)||5;return filtered.length>=minimum?{list:filtered,verified:true}:{list,verified:false}}catch{return{list,verified:false}}}
  function hardFilter(id,list){return policy()?.hardFilter?.(id,list)||(list||[])}
  function relaxedFilter(id,list){const now=new Date().getFullYear(),yr=t=>Number(String(t?.release||'').slice(0,4))||0;if(id==='hits')return list.filter(t=>yr(t)>=now-4);if(id==='top40')return list.filter(t=>yr(t)>=now-3);if(id==='new')return list.filter(t=>yr(t)===now);if(id==='throwback')return list.filter(t=>yr(t)>0&&yr(t)<=2016);if(id==='00s')return list.filter(t=>yr(t)>=2000&&yr(t)<=2009);if(id==='10s')return list.filter(t=>yr(t)>=2010&&yr(t)<=2019);return list}
  function diversify(out){const pool=dedupe(out),artists=new Map(),clean=[];for(const t of pool){const a=String(t.artists?.[0]||'').toLowerCase(),n=artists.get(a)||0;if(a&&n>=3)continue;if(a)artists.set(a,n+1);clean.push(t)}return clean}
  async function buildPool(id){
    if(!ensurePolicy())throw Error('Stations worden nog geladen.');
    let raw=[],searchErrors=[];
    if(id==='nl'){
      try{
        const editorial=await dutchChartPool('nl');
        if(editorial?.tracks?.length){savePool('nl',editorial.tracks,NL_EDITORIAL_SOURCE);return editorial}
      }catch(e){
        const cached=cachedPool('nl');
        if(cached.length)return{tracks:cached,verified:false,fallback:true,source:'Spotify · Je Moerstaal (cache)'};
        throw Error('Je Moerstaal kon tijdelijk niet worden geladen. MAIR speelt geen andere Nederlandstalige selectie als vervanging.');
      }
      throw Error('Je Moerstaal leverde tijdelijk geen tracks.');
    }
    if(['hits','top40'].includes(id)){
      try{const chart=await dutchChartPool(id);if(chart?.tracks?.length){savePool(id,chart.tracks,'nl-chart');return chart}}catch(e){searchErrors.push('Nederlandse playlist: '+String(e?.message||e))}
    }
    for(const q of queries(id)){
      try{raw.push(...await search(q))}catch(e){const msg=String(e?.message||e);searchErrors.push(msg);if(/cooldown|rate limit|429|wacht/i.test(msg)){const ms=Math.max(0,Number(window.JFMSpotifyGuard?.state?.cooldownUntil||0)-Date.now());if(ms&&ms<65000){await wait(ms+180);try{raw.push(...await search(q))}catch(retryErr){searchErrors.push(String(retryErr?.message||retryErr))}}}}
      await wait(65);
    }
    raw=dedupe(raw);
    if(!raw.length){const cached=cachedPool(id);if(cached.length)return{tracks:cached,verified:false,fallback:true,source:'cache'};if(searchErrors.length)throw Error('Spotify stationzoekopdracht mislukte: '+searchErrors.at(-1));return{tracks:[],verified:false,fallback:true,source:'empty'}}
    const minimum=policy()?.minTracks?.(id)||5;
    let filtered=hardFilter(id,raw),fallback=['hits','top40'].includes(id);
    if(filtered.length<minimum){const relaxed=relaxedFilter(id,raw);if(relaxed.length>=minimum){filtered=relaxed;fallback=true}}
    if(filtered.length<minimum&&['hits','top40'].includes(id)&&raw.length>=minimum){filtered=raw;fallback=true}
    if(!filtered.length){const cached=cachedPool(id);if(cached.length)return{tracks:cached,verified:false,fallback:true,source:'cache'}}
    const quality=await semanticQualityFilter(id,filtered);
    let out=dedupe(quality.list);
    if(out.length<minimum&&filtered.length){out=filtered;fallback=true}
    if(!out.length){const cached=cachedPool(id);if(cached.length)return{tracks:cached,verified:false,fallback:true,source:'cache'}}
    out=diversify(out).slice(0,id==='top40'?40:50);
    if(out.length)savePool(id,out,'spotify-search-fallback');
    return{tracks:out,verified:quality.verified&&!fallback,fallback,source:'spotify-search-fallback'};
  }
  function paint(id,loading=false){const c=choice()?.channels?.[id],label=stationLabel(id);document.querySelectorAll('[data-jfm-channel],[data-mair-station]').forEach(b=>{const on=stationIdFromButton(b)===id;b.classList.toggle('active',on);b.classList.toggle('loading',on&&loading);b.setAttribute('aria-pressed',on?'true':'false');if(b.matches('[data-mair-station]'))b.setAttribute('aria-busy',on&&loading?'true':'false')});const d=document.getElementById('channelDescription');if(d&&c)d.textContent=loading?`${label} wordt geladen…`:c.desc;const m=document.getElementById('channelMini');if(m)m.textContent=label;document.body.dataset.musicChannel=id;if(c)window.JFMMusicChannelContext={id,...c};if(!loading)showActiveStation(id,label);try{window.dispatchEvent(new CustomEvent('mair:channelchange',{detail:{id,label,loading}}))}catch{}}
  async function choose(id){
    if(!ensurePolicy()){status('Stations worden nog geladen. Probeer het over een moment opnieuw.',true);return false}
    const c=choice()?.channels?.[id];if(!c||switching)return false;
    switching=true;const previousId=localStorage.getItem('jfm_music_channel_v1')||'mix',previousQueue=Array.isArray(queue)?[...queue]:[];
    window.MAIRCategorySearch?.clearActive?.();try{localStorage.removeItem('mair_active_category_v2');localStorage.setItem('mair_playback_source_v1',JSON.stringify({kind:'station',id,at:Date.now()}))}catch{};paint(id,true);
    try{
      status(['hits','top40','nl'].includes(id)?`${stationLabel(id)} laadt de Nederlandse Spotify-selectie…`:`${stationLabel(id)} zoekt muziek op Spotify…`);
      let list,verified=true,fallback=false,source='';
      if(id==='mix'){const r=await buildSet();list=Array.isArray(r)&&r.length?r:(Array.isArray(queue)?queue:[])}
      else{const built=await buildPool(id);list=built.tracks;verified=built.verified;fallback=built.fallback;source=built.source||''}
      if(!list?.length)throw Error(`${stationLabel(id)} kreeg tijdelijk geen bruikbare tracks van Spotify.`);
      queue=dedupe(list).slice(0,id==='top40'?40:50);
      localStorage.setItem('jfm_music_channel_v1',id);
      try{window.__jfmStationQueueSig='';window.JFMProgramDirector?.invalidateUpcoming?.('station-switch');window.jfmRenderNext?.();window.JFMProgramDirector?.render?.()}catch{}
      paint(id,false);showActiveStation(id,stationLabel(id));
      let started=true;if(queue[0]?.uri&&window.JFMPlayback?.playUri){try{started=await window.JFMPlayback.playUri(queue[0].uri)}catch{started=false}}
      const qualityNote=source&&source!=='live'&&!fallback?` · ${source}`:verified?'':fallback?' · fallback gebruikt':' · kwaliteitsfilter tijdelijk overgeslagen';
      status(started===false?`${stationLabel(id)} is gekozen · ${queue.length} tracks klaar · tik Play als Spotify niet direct overschakelt.`:`${queue.length} tracks klaar · ${stationLabel(id)} speelt${qualityNote}.`,started===false);
      try{window.dispatchEvent(new CustomEvent('mair:station-selected',{detail:{id,label:stationLabel(id),count:queue.length,verified,started:started!==false,source}}))}catch{}
      setTimeout(()=>window.MAIRFoundation?.activate?.('radio'),80);return true;
    }catch(e){
      queue=previousQueue;try{localStorage.setItem('jfm_music_channel_v1',previousId);localStorage.setItem('mair_playback_source_v1',JSON.stringify({kind:'station',id:previousId,at:Date.now()}))}catch{};paint(previousId,false);
      status('Station wisselen mislukt: '+String(e?.message||e),true);try{window.dispatchEvent(new CustomEvent('mair:station-error',{detail:{id,error:String(e?.message||e)}}))}catch{}return false;
    }finally{switching=false}
  }
  function protectBuild(){if(buildProtected||typeof window.buildSet!=='function')return;const old=window.buildSet;window.buildSet=buildSet=async function(...args){const active=localStorage.getItem('jfm_music_channel_v1')||'mix';if(active!=='mix'&&Array.isArray(queue)&&queue.length)return queue;return old.apply(this,args)};buildProtected=true}
  function own(){if(!ensurePolicy())return false;const c=choice();if(!c)return false;c.chooseChannel=choose;c.rebuild=()=>choose(localStorage.getItem('jfm_music_channel_v1')||'mix');try{Object.defineProperty(c,'channel',{configurable:true,get:()=>localStorage.getItem('jfm_music_channel_v1')||'mix'})}catch{}c.hotfix='authoritative-stations-v17-nl-editorial-strict';paint(localStorage.getItem('jfm_music_channel_v1')||'mix');protectBuild();return true}
  document.addEventListener('click',async e=>{const b=e.target?.closest?.('[data-jfm-channel],[data-mair-station]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const n=Date.now();if(n-lastTap<250)return;lastTap=n;const id=stationIdFromButton(b);if(!id)return;await choose(id).catch(()=>false)},true);
  const boot=()=>own();boot();setTimeout(boot,300);setTimeout(boot,1200);window.addEventListener('pageshow',()=>setTimeout(boot,150));window.addEventListener('mair:runtime-ready',boot);window.addEventListener('mair:foundation-ready',()=>paint(localStorage.getItem('jfm_music_channel_v1')||'mix',false));
  window.MAIRStationController={version:'mair-station-controller-v4.1-nl-editorial-strict',select:choose,harden:own,buildPool,get switching(){return switching},get channel(){return localStorage.getItem('jfm_music_channel_v1')||'mix'}};window.JFMChannelTapGuard=window.MAIRStationController;
})();