// Josh FM discovery layer — playback-first Spotify budget, cache-friendly and cooldown retry safe.
(()=>{
const slider=document.getElementById('discovery'),label=document.getElementById('discoveryValue');if(!slider||!label)return;
const stored=Number(localStorage.getItem('jfm_discovery'));slider.value=Number.isFinite(stored)?Math.max(0,Math.min(100,stored)):30;const paint=()=>label.textContent=`${slider.value}%`;paint();slider.addEventListener('input',()=>{paint();localStorage.setItem('jfm_discovery',slider.value)});slider.addEventListener('change',()=>{localStorage.setItem('jfm_discovery',slider.value);if(typeof queue!=='undefined')queue=[]});
const originalBuild=window.buildSet||buildSet,DIAG='jfm_discovery_diag_v5',MAX_SEARCHES=5,wait=ms=>new Promise(r=>setTimeout(r,ms));
function mem(){try{return JSON.parse(localStorage.getItem('jfm_director_memory')||'{"plays":{},"likes":{},"requests":{}}')}catch{return{plays:{},likes:{},requests:{}}}}
function skips(){try{return typeof skipMap==='function'?skipMap():JSON.parse(localStorage.getItem('jfm_skips')||'{}')}catch{return{}}}
function seedScore(t,m,sm){return(m.likes?.[t.id]||0)*5-(sm[t.id]||0)*4-(m.plays?.[t.id]||0)*.12+Math.random()*2}
function interleave(familiar,discoveries,max=50){const out=[],f=[...familiar],d=[...discoveries];let gap=2;while(out.length<max&&(f.length||d.length)){if(d.length&&gap>=2){out.push(d.shift());gap=0}else if(f.length){out.push(f.shift());gap++}else out.push(d.shift())}return out}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sig=t=>`${norm(t?.name)}|${norm((t?.artists||[]).map?.(a=>a?.name||a)?.join?.(',')||'')}`;
function diag(state){const v={...state,at:Date.now(),version:'playback-first-discovery-v5'};try{localStorage.setItem(DIAG,JSON.stringify(v))}catch{}window.JFMDiscoveryDiagnostic=v}
function acceptable(t,base,found,sm){if(!t?.id)return false;if((sm[t.id]||0)>=2)return false;const k=sig(t);return!base.some(b=>b.id===t.id||sig(b)===k)&&!found.some(f=>f.id===t.id||sig(f)===k)}
function rateLimited(e){return/rate limit|rustiger|429|wacht .*secon|cooldown/i.test(String(e?.message||e))}
function sharedCooldown(){try{return Math.max(0,Number(window.JFMSpotifyGuard?.state?.cooldownUntil||0)-Date.now())}catch{return 0}}
async function awaitCooldown(stats,info){let ms=sharedCooldown();if(ms<=0)return true;stats.waited=true;if(info)info.textContent=`Discovery wacht ${Math.ceil(ms/1000)} sec op Spotify; muziek blijft spelen…`;if(ms>65000)return false;await wait(ms+200);return sharedCooldown()<=0}
async function search(q,stats,limit=10,info=null){if(!q?.trim()||stats.searches>=MAX_SEARCHES||stats.rateLimited)return[];if(!(await awaitCooldown(stats,info))){stats.rateLimited=true;stats.lastError='Spotify cooldown';return[]}stats.searches++;try{const d=await api('/search?type=track&limit='+Math.max(1,Math.min(10,limit))+'&q='+encodeURIComponent(q));const items=d?.tracks?.items||[];stats.results+=items.length;return items}catch(e){stats.errors++;stats.lastError=String(e?.message||e);if(rateLimited(e)){if(await awaitCooldown(stats,info)){return search(q,stats,limit,info)}stats.rateLimited=true}return[]}}
function addCandidate(items,reason,base,found,sm){const t=(items||[]).find(x=>acceptable(x,base,found,sm));if(!t)return false;const x=trackObj(t);x._discovery=true;x._discoveryReason=reason||'Past bij je luisterprofiel.';found.push(x);return true}
window.buildSet=buildSet=async function(){
  const base=await originalBuild(),pct=Number(slider.value)||0,info=document.getElementById('queueInfo');if(!pct||!base?.length)return base;
  const wanted=Math.max(1,Math.min(8,Math.round(Math.min(50,base.length)*pct/100)));
  const m=mem(),sm=skips(),ranked=[...base].sort((a,b)=>seedScore(b,m,sm)-seedScore(a,m,sm)),seedRows=ranked.slice(0,12).map(t=>({name:t.name,artists:t.artists,release:t.release})),found=[];
  const stats={wanted,found:0,searches:0,results:0,errors:0,rateLimited:false,waited:false,lastError:'',aiIdeas:0};
  if(!(await awaitCooldown(stats,info))){stats.rateLimited=true;diag(stats);if(info)info.textContent=`${base.length} tracks klaar · discovery probeert automatisch opnieuw zodra Spotify vrij is.`;setTimeout(()=>buildSet().catch(()=>{}),Math.min(sharedCooldown()+500,70000));return base}
  if(info)info.textContent=`Josh FM zoekt maximaal ${wanted} passende ontdekkingen…`;
  let ideas=[];try{const r=await fetch('/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seeds:seedRows,count:Math.min(6,wanted+2),mode:settings?.mode||'normal'})});if(r.ok){const d=await r.json().catch(()=>({}));ideas=Array.isArray(d.tracks)?d.tracks.slice(0,4):[];stats.aiIdeas=ideas.length}}catch{}
  for(const idea of ideas){if(found.length>=wanted||stats.searches>=MAX_SEARCHES||stats.rateLimited)break;const title=String(idea?.title||'').trim(),artist=String(idea?.artist||'').trim();if(!title&&!artist)continue;const q=title&&artist?`track:${title} artist:${artist}`:[title,artist].filter(Boolean).join(' ');addCandidate(await search(q,stats,8,info),idea?.reason||'AI-match op basis van je luisterprofiel.',base,found,sm)}
  if(found.length<wanted&&!stats.rateLimited&&stats.searches<MAX_SEARCHES){const artists=[...new Set(ranked.slice(0,12).flatMap(t=>t.artists||[]).filter(Boolean))].slice(0,3);for(const name of artists){if(found.length>=wanted||stats.searches>=MAX_SEARCHES||stats.rateLimited)break;const items=await search(`artist:${name}`,stats,10,info);for(const t of items){if(found.length>=wanted)break;if(acceptable(t,base,found,sm)){const x=trackObj(t);x._discovery=true;x._discoveryReason='Nieuwe match uit een artiest die al bij je smaak past.';found.push(x)}}}}
  stats.found=found.length;diag(stats);if(found.length){queue=interleave(ranked.slice(0,Math.max(0,50-found.length)),found,50);if(info)info.textContent=`${queue.length} tracks klaar · ${found.length} ontdekking${found.length===1?'':'en'} toegevoegd · ${stats.searches} Spotify-zoekopdrachten.`;return queue}
  if(info)info.textContent=stats.rateLimited?`${base.length} tracks klaar · discovery probeert automatisch opnieuw.`:`${base.length} tracks klaar · geen passende nieuwe tracks gevonden na ${stats.searches} gerichte zoekopdrachten.`;return base
};
window.JFMDiscovery={version:'playback-first-discovery-v5',maxSearches:MAX_SEARCHES,diagnostic:()=>{try{return JSON.parse(localStorage.getItem(DIAG)||'null')}catch{return null}}};
})();
