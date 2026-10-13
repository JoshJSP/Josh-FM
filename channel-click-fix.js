// MAIR station controller — single authoritative station owner with resilient quality fallback.
(()=>{
  'use strict';
  let switching=false,lastTap=0,buildProtected=false,policyLoading=false;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function boundedFetch(url,opt={},ms=10000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
  const POOL_CACHE='mair_station_pool_cache_v5_nl_editorial_strict',CACHE_TTL=12*60*60*1000,NL_EDITORIAL_SOURCE='spotify-editorial-je-moerstaal';
  const AI_SOURCE='mair-ai-picks',AI_TTL=24*60*60*1000,AI_KEEP=7*24*60*60*1000,AI_MIN=20,AI_START_DELAY=4000;
  const choice=()=>window.JFMMusicChoice,status=(text,bad=false)=>{const q=document.getElementById('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const policy=()=>window.MAIRStationPolicy;
  const stationIdFromButton=b=>String(b?.dataset?.jfmChannel||b?.dataset?.mairStation||'');
  function stationLabel(id){return choice()?.channels?.[id]?.label||policy()?.label?.(id)||({hits:'MAIR HITS',top40:'MAIR TOP 40',new:'MAIR DISCOVERY',nl:'MAIR NEDERLANDSTALIG',party:'MAIR PARTY',chill:'MAIR CHILL',summer:'MAIR SUMMER',throwback:'MAIR THROWBACK','00s':'MAIR 00s','10s':'MAIR 10s',mix:'MY MAIR'}[id]||String(id||'MAIR').toUpperCase())}
  function showActiveStation(id,label=stationLabel(id)){let badge=document.getElementById('mairActiveStation');if(!badge){badge=document.createElement('div');badge.id='mairActiveStation';badge.className='mair-active-station';const art=document.querySelector('#tab-radio .art');art?.parentNode?.insertBefore(badge,art)}if(badge){badge.textContent=label;badge.dataset.station=id}const mode=document.getElementById('mairRadioMode');if(mode)mode.textContent=label;try{localStorage.setItem('mair_active_station_label_v1',label)}catch{/* opslag geblokkeerd: dan zonder opslag */}}
  function ensurePolicy(){if(policy())return true;if(policyLoading||document.getElementById('mairStationPolicyJs'))return false;policyLoading=true;const s=document.createElement('script');s.id='mairStationPolicyJs';s.src='./mair-station-policy.js?v=4';s.dataset.mairStationPolicy='1';s.onload=()=>{policyLoading=false;own()};s.onerror=()=>{policyLoading=false;status('Stations konden niet worden geladen.',true)};document.head.appendChild(s);return false}
  const toTrack=t=>({id:t.id,uri:t.uri,name:t.name,artists:(t.artists||[]).map(a=>a.name),album:t.album?.name||'',release:t.album?.release_date||'',image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||'',url:t.external_urls?.spotify||'',duration:t.duration_ms||0});
  const chartTrack=t=>({id:String(t?.id||''),uri:String(t?.uri||''),name:String(t?.name||''),artists:Array.isArray(t?.artists)?t.artists.map(String):[],album:String(t?.album||''),release:String(t?.release||''),image:String(t?.image||''),url:String(t?.url||''),duration:Number(t?.duration||0),rank:Number(t?.rank||0),chartScore:Number(t?.chartScore||0),chartSources:Array.isArray(t?.chartSources)?t.chartSources:[]});
  const queries=id=>policy()?.queries?.(id)||[];
  const dedupe=list=>{const s=new Set();return(list||[]).filter(t=>t?.id&&t?.uri&&!s.has(t.id)&&(s.add(t.id),true))};
  function readPools(){try{return JSON.parse(localStorage.getItem(POOL_CACHE)||'{}')}catch{return{}}}
  // Voor 'nl' telt alleen Je Moerstaal of de AI-selectie (die vraagt expliciet om Nederlandstalige zang); nooit generiek zoekwerk.
  const nlTrusted=source=>source===NL_EDITORIAL_SOURCE||source===AI_SOURCE;
  function cachedPool(id){const x=readPools()?.[id];if(id==='nl'&&!nlTrusted(x?.source))return[];return x?.at&&Date.now()-Number(x.at)<CACHE_TTL&&Array.isArray(x.items)?dedupe(x.items):[]}
  function savePool(id,items,source='station-pool'){if(!id||!items?.length)return;if(id==='nl'&&!nlTrusted(source))return;try{const all=readPools();all[id]={at:Date.now(),source,items:dedupe(items).slice(0,50)};localStorage.setItem(POOL_CACHE,JSON.stringify(all))}catch{/* opslag geblokkeerd: dan zonder opslag */}}
  async function search(q){const d=await api('/search?type=track&limit=10&q='+encodeURIComponent(q));return(d?.tracks?.items||[]).filter(t=>t?.id&&t?.uri).map(toTrack)}
  // Bij een Spotify-cooldown één keer wachten en opnieuw, zoals de stationzoekopdrachten altijd al deden.
  async function withCooldown(run,errors=[]){try{return await run()}catch(e){const msg=String(e?.message||e);errors.push(msg);if(/cooldown|rate limit|429|wacht/i.test(msg)){const ms=Math.max(0,Number(window.JFMSpotifyGuard?.state?.cooldownUntil||0)-Date.now());if(ms&&ms<65000){await wait(ms+180);try{return await run()}catch(retryErr){errors.push(String(retryErr?.message||retryErr))}}}return[]}}
  // --- AI-selectie: de AI kiest nummers op genre, Spotify bevestigt dat ze echt bestaan. ---
  // JFMSpotifyGuard laat maar één zoekopdracht per 1,5 s door, dus 60 nummers opzoeken duurt ruim een minuut.
  // Daarom bouwt dit op de achtergrond en speelt een station de AI-pool pas als die klaar is.
  // Tot 24 uur oud is de pool vers; tot 7 dagen speelt hij nog terwijl er op de achtergrond een nieuwe komt.
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  const baseTitle=s=>norm(String(s||'').replace(/\s[-–]\s.*$/,'').replace(/\s*[([][^)\]]*[)\]]/g,''))||norm(s);
  const mainArtist=s=>norm(String(s||'').split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bmet\b)\s*/i)[0]);
  // Een treffer telt alleen als titel én artiest echt overeenkomen: 'Summer' van een willekeurige band is geen 'Summer' van Calvin Harris.
  function matchesPick(pick,t){const a=mainArtist(pick?.artist),full=norm(pick?.artist),artists=(t?.artists||[]).map(norm);return !!a&&baseTitle(t?.name)===baseTitle(pick?.title)&&(artists.includes(a)||artists.includes(full))}
  const clean=s=>String(s||'').replace(/["]/g,'').trim();
  async function lookupPick(id,pick,errors){const q=`track:"${clean(pick.title)}" artist:"${clean(pick.artist)}"`;const hits=(await withCooldown(async()=>{const d=await api('/search?type=track&limit=3&q='+encodeURIComponent(q));return(d?.tracks?.items||[]).filter(t=>t?.id&&t?.uri).map(toTrack)},errors)).filter(t=>matchesPick(pick,t));return hardFilter(id,hits)[0]||hits[0]||null}
  let taste=null;
  async function tasteProfile(){if(taste)return taste;const[a,t]=await Promise.all([api('/me/top/artists?limit=15&time_range=medium_term').catch(()=>null),api('/me/top/tracks?limit=15&time_range=short_term').catch(()=>null)]);taste={topArtists:(a?.items||[]).map(x=>String(x?.name||'')).filter(Boolean).slice(0,15),topTracks:(t?.items||[]).map(x=>({artist:String(x?.artists?.[0]?.name||''),title:String(x?.name||'')})).filter(x=>x.artist&&x.title).slice(0,15)};return taste}
  const aiEntry=id=>{const x=readPools()?.[id];return x?.source===AI_SOURCE&&Date.now()-Number(x.at||0)<AI_KEEP&&Array.isArray(x.items)?x:null};
  const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const aiBuilding=new Map();
  function buildAiPool(id){
    if(!policy()?.picks?.(id))return Promise.resolve(null);
    if(aiBuilding.has(id))return aiBuilding.get(id);
    const job=(async()=>{
      const profile=await tasteProfile().catch(()=>({topArtists:[],topTracks:[]}));
      const r=await boundedFetch('/api/station-picks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({station:id,description:policy().picks(id),personalization:policy()?.personalization?.(id),...profile})},40000);
      if(!r.ok)return null;
      const d=await r.json().catch(()=>null),picks=(Array.isArray(d?.tracks)?d.tracks:[]).filter(p=>typeof p?.artist==='string'&&typeof p?.title==='string').slice(0,60);
      const found=[],errors=[];let next=0;
      // Twee tegelijk: de guard zet ze toch achter elkaar, en zo kan een verzoeknummer van Josh er steeds tussendoor.
      await Promise.all([0,1].map(async()=>{while(next<picks.length&&found.length<50){const t=await lookupPick(id,picks[next++],errors);if(t)found.push(t)}}));
      const out=diversify(hardFilter(id,dedupe(found)));
      if(out.length<AI_MIN)return null;
      savePool(id,out,AI_SOURCE);return out;
    })().catch(()=>null).finally(()=>aiBuilding.delete(id));
    aiBuilding.set(id,job);return job;
  }
  function aiPool(id){
    if(!policy()?.picks?.(id))return null;
    const x=aiEntry(id);
    if(!x||Date.now()-Number(x.at)>AI_TTL)setTimeout(()=>{buildAiPool(id)},AI_START_DELAY);
    const items=dedupe(x?.items||[]);
    return items.length>=AI_MIN?{tracks:shuffle(items),verified:true,fallback:false,source:'MAIR-selectie'}:null;
  }
  async function dutchChartPool(id){
    if(!['hits','top40','nl'].includes(id))return null;
    const r=await boundedFetch('/api/nl-charts?station='+encodeURIComponent(id),{cache:'no-store'}),d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(String(d?.detail||d?.error||`Nederlandse playlist HTTP ${r.status}`));
    const tracks=dedupe((Array.isArray(d?.items)?d.items:[]).map(chartTrack));
    if(tracks.length<(policy()?.minTracks?.(id)||5))throw Error('Nederlandse playlist leverde tijdelijk te weinig Spotify-tracks.');
    return{tracks,verified:true,fallback:false,source:String(d?.source||'Nederlandse Spotify-playlist')};
  }
  async function semanticQualityFilter(id,list){if(!policy()?.needsSemantic?.(id))return{list,verified:true};const min=policy()?.confidence?.(id)||.90;try{const r=await boundedFetch('/api/category-filter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:id,minConfidence:min,tracks:list.slice(0,40)})});if(!r.ok)return{list,verified:false};const d=await r.json(),accepted=new Set((Array.isArray(d?.accepted)?d.accepted:[]).filter(x=>Number(x?.confidence)>=min).map(x=>String(x.id))),filtered=list.filter(t=>accepted.has(String(t.id))),minimum=policy()?.minTracks?.(id)||5;return filtered.length>=minimum?{list:filtered,verified:true}:{list,verified:false}}catch{return{list,verified:false}}}
  function hardFilter(id,list){return policy()?.hardFilter?.(id,list)||(list||[])}
  function relaxedFilter(id,list){const now=new Date().getFullYear(),yr=t=>Number(String(t?.release||'').slice(0,4))||0;if(id==='hits')return list.filter(t=>yr(t)>=now-4);if(id==='top40')return list.filter(t=>yr(t)>=now-3);if(id==='new')return list.filter(t=>yr(t)===now);if(id==='throwback')return list.filter(t=>yr(t)>0&&yr(t)<=2016);if(id==='00s')return list.filter(t=>yr(t)>=2000&&yr(t)<=2009);if(id==='10s')return list.filter(t=>yr(t)>=2010&&yr(t)<=2019);return list}
  function diversify(out){const pool=dedupe(out),artists=new Map(),clean=[];for(const t of pool){const a=String(t.artists?.[0]||'').toLowerCase(),n=artists.get(a)||0;if(a&&n>=3)continue;if(a)artists.set(a,n+1);clean.push(t)}return clean}
  async function buildPool(id){
    if(!ensurePolicy())throw Error('Stations worden nog geladen.');
    let raw=[],searchErrors=[];
    // Eerst de AI-selectie. Is die er (nog) niet, dan de oude methode hieronder; die blijft het vangnet.
    const picked=aiPool(id);if(picked)return picked;
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
      raw.push(...await withCooldown(()=>search(q),searchErrors));
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
  function paint(id,loading=false){const c=choice()?.channels?.[id],label=stationLabel(id);document.querySelectorAll('[data-jfm-channel],[data-mair-station]').forEach(b=>{const on=stationIdFromButton(b)===id;b.classList.toggle('active',on);b.classList.toggle('loading',on&&loading);b.setAttribute('aria-pressed',on?'true':'false');if(b.matches('[data-mair-station]'))b.setAttribute('aria-busy',on&&loading?'true':'false')});const d=document.getElementById('channelDescription');if(d&&c)d.textContent=loading?`${label} wordt geladen…`:c.desc;const m=document.getElementById('channelMini');if(m)m.textContent=label;document.body.dataset.musicChannel=id;if(c)window.JFMMusicChannelContext={id,...c};if(!loading)showActiveStation(id,label);try{window.dispatchEvent(new CustomEvent('mair:channelchange',{detail:{id,label,loading}}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}}
  async function choose(id){
    if(!ensurePolicy()){status('Stations worden nog geladen. Probeer het over een moment opnieuw.',true);return false}
    const c=choice()?.channels?.[id];if(!c||switching)return false;
    switching=true;const previousId=localStorage.getItem('jfm_music_channel_v1')||'mix',previousQueue=Array.isArray(queue)?[...queue]:[];
    window.MAIRCategorySearch?.clearActive?.();try{localStorage.removeItem('mair_active_category_v2');localStorage.setItem('mair_playback_source_v1',JSON.stringify({kind:'station',id,at:Date.now()}))}catch{/* opslag geblokkeerd: dan zonder opslag */};paint(id,true);
    try{
      status(['hits','top40','nl'].includes(id)?`${stationLabel(id)} laadt de Nederlandse Spotify-selectie…`:`${stationLabel(id)} zoekt muziek op Spotify…`);
      let list,verified=true,fallback=false,source='';
      if(id==='mix'){const r=await buildSet();list=Array.isArray(r)&&r.length?r:(Array.isArray(queue)?queue:[])}
      else{const built=await buildPool(id);list=built.tracks;verified=built.verified;fallback=built.fallback;source=built.source||''}
      if(!list?.length)throw Error(`${stationLabel(id)} kreeg tijdelijk geen bruikbare tracks van Spotify.`);
      const prepared=dedupe(list).slice(0,id==='top40'?40:50);queue=window.JFMQueue?.commit?.(prepared,{source:id==='mix'?'personal':'station',station:id,reason:'station-switch'})||prepared;
      localStorage.setItem('jfm_music_channel_v1',id);
      try{window.__jfmStationQueueSig='';window.JFMProgramDirector?.invalidateUpcoming?.('station-switch');window.jfmRenderNext?.();window.JFMProgramDirector?.render?.()}catch{/* optionele UI/DOM-hook niet beschikbaar: onschuldig */}
      paint(id,false);showActiveStation(id,stationLabel(id));
      let started=true;if(queue[0]?.uri&&window.JFMPlayback?.playUri){try{started=await window.JFMPlayback.playUri(queue[0].uri)}catch{started=false}}
      const qualityNote=source&&source!=='live'&&!fallback?` · ${source}`:verified?'':fallback?' · fallback gebruikt':' · kwaliteitsfilter tijdelijk overgeslagen';
      status(started===false?`${stationLabel(id)} is gekozen · ${queue.length} tracks klaar · tik Play als Spotify niet direct overschakelt.`:`${queue.length} tracks klaar · ${stationLabel(id)} speelt${qualityNote}.`,started===false);
      try{window.dispatchEvent(new CustomEvent('mair:station-selected',{detail:{id,label:stationLabel(id),count:queue.length,verified,started:started!==false,source}}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}
      setTimeout(()=>window.MAIRFoundation?.activate?.('radio'),80);return true;
    }catch(e){
      queue=previousQueue;try{localStorage.setItem('jfm_music_channel_v1',previousId);localStorage.setItem('mair_playback_source_v1',JSON.stringify({kind:'station',id:previousId,at:Date.now()}))}catch{/* opslag geblokkeerd: dan zonder opslag */};paint(previousId,false);
      status('Station wisselen mislukt: '+String(e?.message||e),true);try{window.dispatchEvent(new CustomEvent('mair:station-error',{detail:{id,error:String(e?.message||e)}}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}return false;
    }finally{switching=false}
  }
  function protectBuild(){if(buildProtected||typeof window.buildSet!=='function')return;const old=window.buildSet;window.buildSet=buildSet=async function(...args){const active=localStorage.getItem('jfm_music_channel_v1')||'mix';if(active!=='mix'&&Array.isArray(queue)&&queue.length)return queue;return old.apply(this,args)};buildProtected=true}
  function own(){if(!ensurePolicy())return false;const c=choice();if(!c)return false;c.chooseChannel=choose;c.rebuild=()=>choose(localStorage.getItem('jfm_music_channel_v1')||'mix');try{Object.defineProperty(c,'channel',{configurable:true,get:()=>localStorage.getItem('jfm_music_channel_v1')||'mix'})}catch{/* opslag geblokkeerd: dan zonder opslag */}c.hotfix='authoritative-stations-v17-nl-editorial-strict';paint(localStorage.getItem('jfm_music_channel_v1')||'mix');protectBuild();return true}
  document.addEventListener('click',async e=>{const b=e.target?.closest?.('[data-jfm-channel],[data-mair-station]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const n=Date.now();if(n-lastTap<250)return;lastTap=n;const id=stationIdFromButton(b);if(!id)return;await choose(id).catch(()=>false)},true);
  const boot=()=>own();boot();setTimeout(boot,300);setTimeout(boot,1200);window.addEventListener('pageshow',()=>setTimeout(boot,150));window.addEventListener('mair:runtime-ready',boot);window.addEventListener('mair:foundation-ready',()=>paint(localStorage.getItem('jfm_music_channel_v1')||'mix',false));
  window.MAIRStationController={version:'mair-station-controller-v4.1-nl-editorial-strict',select:choose,harden:own,buildPool,buildAiPool,get switching(){return switching},get channel(){return localStorage.getItem('jfm_music_channel_v1')||'mix'}};window.JFMChannelTapGuard=window.MAIRStationController;
})();
