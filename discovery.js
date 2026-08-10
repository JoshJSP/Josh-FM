// Josh FM discovery layer — AI first, Spotify-only fallback if AI is unavailable.
(()=>{
const slider=document.getElementById('discovery'),label=document.getElementById('discoveryValue');if(!slider||!label)return;
const stored=Number(localStorage.getItem('jfm_discovery'));slider.value=Number.isFinite(stored)?Math.max(0,Math.min(100,stored)):30;const paint=()=>label.textContent=`${slider.value}%`;paint();slider.addEventListener('input',()=>{paint();localStorage.setItem('jfm_discovery',slider.value)});slider.addEventListener('change',()=>{localStorage.setItem('jfm_discovery',slider.value);if(typeof queue!=='undefined')queue=[]});
const originalBuild=window.buildSet||buildSet;
function mem(){try{return JSON.parse(localStorage.getItem('jfm_director_memory')||'{"plays":{},"likes":{},"requests":{}}')}catch{return{plays:{},likes:{},requests:{}}}}
function skips(){try{return typeof skipMap==='function'?skipMap():JSON.parse(localStorage.getItem('jfm_skips')||'{}')}catch{return{}}}
function seedScore(t,m,sm){return (m.likes?.[t.id]||0)*5-(sm[t.id]||0)*4-(m.plays?.[t.id]||0)*.12+Math.random()*2}
function interleave(familiar,discoveries,max=50){const out=[],f=[...familiar],d=[...discoveries];let sinceDiscovery=2;while(out.length<max&&(f.length||d.length)){const canDiscovery=d.length&&sinceDiscovery>=2,wantDiscovery=canDiscovery&&(Math.random()<.34||!f.length);if(wantDiscovery){out.push(d.shift());sinceDiscovery=0}else if(f.length){out.push(f.shift());sinceDiscovery++}else if(d.length){out.push(d.shift());sinceDiscovery=0}}return out}
function acceptable(t,base,found,sm){return !!t?.id&&!base.some(b=>b.id===t.id)&&!found.some(f=>f.id===t.id)&&(sm[t.id]||0)<2}
async function searchIdea(idea,base,found,sm){const exact=[idea.title,idea.artist].filter(Boolean).join(' '),queries=[`track:${idea.title} artist:${idea.artist}`,exact,`${idea.artist} ${idea.title}`];for(const q of queries){if(!q.trim())continue;try{const s=await api('/search?type=track&limit=10&q='+encodeURIComponent(q)),items=s.tracks?.items||[],candidate=items.find(t=>acceptable(t,base,found,sm));if(candidate)return candidate}catch{}}return null}
async function spotifyFallback(seeds,base,found,sm,wanted){
  const artistNames=[...new Set(seeds.flatMap(s=>s.artists||[]).filter(Boolean))].slice(0,8),genres=[];
  for(const name of artistNames){if(found.length>=wanted)break;try{const a=await api('/search?type=artist&limit=3&q='+encodeURIComponent(`artist:${name}`)),artist=a.artists?.items?.[0];if(!artist)continue;(artist.genres||[]).slice(0,3).forEach(g=>{if(!genres.includes(g))genres.push(g)});
      const tracks=await api('/search?type=track&limit=20&q='+encodeURIComponent(`artist:${name}`));for(const t of tracks.tracks?.items||[]){if(found.length>=wanted)break;if(acceptable(t,base,found,sm)){const x=trackObj(t);x._discovery=true;x._discoveryReason='Spotify-match op basis van je luisterprofiel.';found.push(x)}}
    }catch{}
  }
  for(const genre of genres.slice(0,8)){if(found.length>=wanted)break;try{const s=await api('/search?type=track&limit=30&q='+encodeURIComponent(`genre:"${genre}"`));for(const t of s.tracks?.items||[]){if(found.length>=wanted)break;if(acceptable(t,base,found,sm)){const x=trackObj(t);x._discovery=true;x._discoveryReason=`Past bij je smaak binnen ${genre}.`;found.push(x)}}}catch{}}
  // Last-resort variety: use seed words/titles, but never return a track already in the base set.
  for(const seed of seeds.slice(0,10)){if(found.length>=wanted)break;const words=String(seed.name||'').split(/\s+/).filter(w=>w.length>3).slice(0,2);for(const word of words){if(found.length>=wanted)break;try{const s=await api('/search?type=track&limit=20&q='+encodeURIComponent(word));for(const t of s.tracks?.items||[]){if(found.length>=wanted)break;if(acceptable(t,base,found,sm)){const x=trackObj(t);x._discovery=true;x._discoveryReason='Ontdekt via overeenkomsten met je recente muziek.';found.push(x)}}}catch{}}}
  return found;
}
window.buildSet=buildSet=async function(){const base=await originalBuild();const pct=Number(slider.value)||0;if(!pct||!base?.length)return base;const wanted=Math.max(1,Math.round(Math.min(50,base.length)*pct/100));const info=document.getElementById('queueInfo');if(info)info.textContent=`Josh FM zoekt ${wanted} nieuwe tracks die bij je smaak passen…`;
const m=mem(),sm=skips(),ranked=[...base].sort((a,b)=>seedScore(b,m,sm)-seedScore(a,m,sm)),seeds=ranked.slice(0,24).map(t=>({name:t.name,artists:t.artists,release:t.release,liked:m.likes?.[t.id]||0,skipped:sm[t.id]||0})),found=[];
let aiWorked=false;
try{const r=await fetch('/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seeds,count:Math.min(24,wanted+6),mode:settings?.mode||'normal'})});let d={};try{d=await r.json()}catch{}if(r.ok){for(const idea of (Array.isArray(d.tracks)?d.tracks:[]).slice(0,Math.min(36,wanted*3))){if(found.length>=wanted)break;const candidate=await searchIdea(idea,base,found,sm);if(candidate){const x=trackObj(candidate);x._discovery=true;x._discoveryReason=idea.reason||'';found.push(x)}}aiWorked=found.length>0}}
catch(e){console.warn('AI discovery unavailable, using Spotify fallback:',e)}
if(found.length<wanted)await spotifyFallback(seeds,base,found,sm,wanted);
if(found.length){const familiar=ranked.slice(0,Math.max(0,50-found.length));queue=interleave(familiar,found,50);if(info)info.textContent=`${queue.length} tracks klaar · ${found.length} ontdekking${found.length===1?'':'en'} toegevoegd · ${pct}% ontdekking${aiWorked?'':' · Spotify fallback'}.`;return queue}
if(info)info.textContent=`${base.length} tracks klaar · geen geschikte nieuwe tracks gevonden.`;return base;
}
})();