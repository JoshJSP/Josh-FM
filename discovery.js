// MAIR discovery layer — proportional MY MAIR discovery with resilient Spotify fallback.
(()=>{
'use strict';
const slider=document.getElementById('discovery'),label=document.getElementById('discoveryValue');if(!slider||!label)return;
const SET_SIZE=50,DIAG='jfm_discovery_diag_v6',wait=ms=>new Promise(r=>setTimeout(r,ms));
const stored=Number(localStorage.getItem('jfm_discovery'));
slider.value=Number.isFinite(stored)?Math.max(0,Math.min(100,stored)):30;
function targetCount(pct=Number(slider.value)||0){return Math.max(0,Math.min(SET_SIZE,Math.round(SET_SIZE*pct/100)))}
function paint(){const pct=Math.max(0,Math.min(100,Number(slider.value)||0)),wanted=targetCount(pct);label.textContent=`${pct}% · ±${wanted}/${SET_SIZE} nieuw`;label.title='Geldt voor MY MAIR: ongeveer dit deel van een nieuwe radioset bestaat uit ontdekkingen.'}
paint();
slider.addEventListener('input',()=>{paint();localStorage.setItem('jfm_discovery',slider.value)});
slider.addEventListener('change',()=>{localStorage.setItem('jfm_discovery',slider.value);if(typeof queue!=='undefined')queue=[];try{window.dispatchEvent(new CustomEvent('mair:discovery-change',{detail:{percent:Number(slider.value)||0,target:targetCount()}}))}catch{}});
const originalBuild=window.buildSet||buildSet;
async function boundedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
function mem(){try{return JSON.parse(localStorage.getItem('jfm_director_memory')||'{"plays":{},"likes":{},"requests":{}}')}catch{return{plays:{},likes:{},requests:{}}}}
function skips(){try{return typeof skipMap==='function'?skipMap():JSON.parse(localStorage.getItem('jfm_skips')||'{}')}catch{return{}}}
function seedScore(t,m,sm){return(m.likes?.[t.id]||0)*5-(sm[t.id]||0)*4-(m.plays?.[t.id]||0)*.12+Math.random()*2}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sig=t=>`${norm(t?.name)}|${norm((t?.artists||[]).map?.(a=>a?.name||a)?.join?.(',')||'')}`;
function diag(state){const v={...state,at:Date.now(),version:'proportional-discovery-v6'};try{localStorage.setItem(DIAG,JSON.stringify(v))}catch{}window.JFMDiscoveryDiagnostic=v}
function acceptable(t,base,found,sm){if(!t?.id||!t?.uri)return false;if((sm[t.id]||0)>=2)return false;const k=sig(t);return!base.some(b=>b.id===t.id||sig(b)===k)&&!found.some(f=>f.id===t.id||sig(f)===k)}
function rateLimited(e){return/rate limit|rustiger|429|wacht .*secon|cooldown/i.test(String(e?.message||e))}
function sharedCooldown(){try{return Math.max(0,Number(window.JFMSpotifyGuard?.state?.cooldownUntil||0)-Date.now())}catch{return 0}}
async function awaitCooldown(stats,info){const ms=sharedCooldown();if(ms<=0)return true;stats.waited=true;if(info)info.textContent=`MY MAIR wacht ${Math.ceil(ms/1000)} sec op Spotify; je huidige muziek blijft spelen…`;if(ms>65000)return false;await wait(ms+200);return sharedCooldown()<=0}
function searchBudget(wanted){if(wanted<=0)return 0;if(wanted<=5)return 5;if(wanted<=15)return 8;if(wanted<=25)return 11;if(wanted<=40)return 14;return 18}
async function search(q,stats,limit=20,info=null){if(!q?.trim()||stats.searches>=stats.maxSearches||stats.rateLimited)return[];if(!(await awaitCooldown(stats,info))){stats.rateLimited=true;stats.lastError='Spotify cooldown';return[]}stats.searches++;try{const d=await api('/search?type=track&limit='+Math.max(1,Math.min(50,limit))+'&q='+encodeURIComponent(q));const items=d?.tracks?.items||[];stats.results+=items.length;return items}catch(e){stats.errors++;stats.lastError=String(e?.message||e);if(rateLimited(e)){if(await awaitCooldown(stats,info))return search(q,stats,limit,info);stats.rateLimited=true}return[]}}
function addCandidates(items,reason,base,found,sm,wanted){for(const t of items||[]){if(found.length>=wanted)break;if(!acceptable(t,base,found,sm))continue;const x=trackObj(t);x._discovery=true;x._discoveryReason=reason||'Past bij je luisterprofiel.';found.push(x)}}
function proportionalMix(familiar,discoveries,max=SET_SIZE){const f=[...familiar],d=[...discoveries],out=[];const total=Math.min(max,f.length+d.length),targetD=Math.min(d.length,total),targetF=Math.min(f.length,total-targetD);let usedD=0,usedF=0;for(let i=0;i<total;i++){const expectedD=(i+1)*(targetD/Math.max(1,total));const chooseD=d.length&&(usedD<targetD)&&(usedD<expectedD||!f.length||usedF>=targetF);if(chooseD){out.push(d.shift());usedD++}else if(f.length&&usedF<targetF){out.push(f.shift());usedF++}else if(d.length){out.push(d.shift());usedD++}}return out}
function seedArtists(ranked){return[...new Set(ranked.slice(0,24).flatMap(t=>t.artists||[]).map(String).filter(Boolean))]}
function broadQueries(ranked){const years=ranked.map(t=>Number(String(t?.release||'').slice(0,4))).filter(Boolean),avg=years.length?Math.round(years.reduce((a,b)=>a+b,0)/years.length):new Date().getFullYear()-3,now=new Date().getFullYear();return[`year:${Math.max(1990,avg-3)}-${Math.min(now,avg+3)} pop`,`year:${Math.max(2000,now-5)}-${now} indie pop`,`year:${Math.max(2000,now-4)}-${now} dance pop`,'alternative pop','modern pop']}
window.buildSet=buildSet=async function(){
  const base=await originalBuild(),pct=Math.max(0,Math.min(100,Number(slider.value)||0)),info=document.getElementById('queueInfo');
  if(!base?.length||pct<=0){diag({percent:pct,wanted:0,found:0,actualPercent:0,searches:0,maxSearches:0,results:0,errors:0,rateLimited:false});return base}
  const wanted=targetCount(pct),m=mem(),sm=skips(),ranked=[...base].sort((a,b)=>seedScore(b,m,sm)-seedScore(a,m,sm)),seedRows=ranked.slice(0,20).map(t=>({name:t.name,artists:t.artists,release:t.release})),found=[];
  const stats={percent:pct,wanted,found:0,actualPercent:0,searches:0,maxSearches:searchBudget(wanted),results:0,errors:0,rateLimited:false,waited:false,lastError:'',aiIdeas:0};
  if(!(await awaitCooldown(stats,info))){stats.rateLimited=true;diag(stats);if(info)info.textContent=`${base.length} tracks klaar · Discovery kon nu niet vernieuwen door Spotify-limiet.`;return base}
  if(info)info.textContent=`MY MAIR zoekt ${wanted} ontdekking${wanted===1?'':'en'} voor je ${pct}% mix…`;
  let ideas=[];
  try{const r=await boundedFetch('/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seeds:seedRows,count:Math.min(20,Math.max(6,wanted)),mode:settings?.mode||'normal'})});if(r.ok){const d=await r.json().catch(()=>({}));ideas=Array.isArray(d.tracks)?d.tracks.slice(0,20):[];stats.aiIdeas=ideas.length}}catch(e){stats.errors++;stats.lastError=e?.name==='AbortError'?'Discovery API timeout':String(e?.message||e)}
  for(const idea of ideas){if(found.length>=wanted||stats.searches>=stats.maxSearches||stats.rateLimited)break;const title=String(idea?.title||'').trim(),artist=String(idea?.artist||'').trim();if(!title&&!artist)continue;const q=title&&artist?`track:${title} artist:${artist}`:[title,artist].filter(Boolean).join(' ');addCandidates(await search(q,stats,12,info),idea?.reason||'AI-match op basis van je luisterprofiel.',base,found,sm,wanted)}
  const artists=seedArtists(ranked);
  for(const name of artists){if(found.length>=wanted||stats.searches>=stats.maxSearches||stats.rateLimited)break;addCandidates(await search(`artist:${name}`,stats,30,info),'Een minder bekende match rond een artiest die al bij je smaak past.',base,found,sm,wanted)}
  for(const q of broadQueries(ranked)){if(found.length>=wanted||stats.searches>=stats.maxSearches||stats.rateLimited)break;addCandidates(await search(q,stats,35,info),'Nieuwe muziek buiten je vaste rotatie, passend bij je luisterprofiel.',base,found,sm,wanted)}
  const actualDiscovery=Math.min(wanted,found.length),familiarNeeded=Math.max(0,SET_SIZE-actualDiscovery),familiar=ranked.slice(0,familiarNeeded),discoveries=found.slice(0,actualDiscovery);queue=proportionalMix(familiar,discoveries,SET_SIZE);
  if(queue.length<SET_SIZE){const used=new Set(queue.map(t=>t.id));for(const t of ranked){if(queue.length>=SET_SIZE)break;if(!used.has(t.id)){used.add(t.id);queue.push(t)}}}
  stats.found=actualDiscovery;stats.actualPercent=Math.round((actualDiscovery/Math.max(1,queue.length))*100);diag(stats);
  if(info){const shortfall=actualDiscovery<wanted?` · doel ${pct}%, gehaald ${stats.actualPercent}%`:` · ${stats.actualPercent}% echt nieuw`;info.textContent=`${queue.length} tracks klaar · ${actualDiscovery} ontdekking${actualDiscovery===1?'':'en'}${shortfall}.`}
  return queue
};
window.JFMDiscovery={version:'proportional-discovery-v6',targetCount,searchBudget,diagnostic:()=>{try{return JSON.parse(localStorage.getItem(DIAG)||'null')}catch{return null}}};
})();
