// MAIRFM Passenger autocomplete — isolated host-side Spotify search broker.
(()=>{
'use strict';
if(window.MAIRPassengerSearchHost)return;
let busy=false,lastSeen=new Set(),timer=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function spotify(q){
  if(typeof api!=='function')throw Error('Spotify API niet beschikbaar');
  const d=await api(`/search?type=track&limit=6&q=${encodeURIComponent(q)}`);
  return (d?.tracks?.items||[]).slice(0,6).map(t=>({
    id:t.id||'',
    uri:t.uri||'',
    name:t.name||'',
    artists:(t.artists||[]).map(a=>a?.name||'').filter(Boolean),
    image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||''
  })).filter(t=>t.id&&t.uri&&t.name)
}
async function post(body){
  const r=await fetch('/api/passenger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||`Passenger search fout ${r.status}`);
  return d
}
async function tick(){
  if(busy)return;
  const host=window.MAIRPassengerMode?.state?.();
  if(!host?.active||!host.code||!host.hostSecret)return;
  busy=true;
  try{
    const r=await fetch(`/api/passenger?code=${encodeURIComponent(host.code)}&hostSecret=${encodeURIComponent(host.hostSecret)}`,{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!Array.isArray(d.searches))return;
    const pending=d.searches.filter(s=>s?.id&&s?.query&&!lastSeen.has(s.id)).slice(0,4);
    for(const s of pending){
      lastSeen.add(s.id);
      try{
        const results=await spotify(s.query);
        await post({action:'search-result',code:host.code,hostSecret:host.hostSecret,searchId:s.id,results});
      }catch(error){
        await post({action:'search-result',code:host.code,hostSecret:host.hostSecret,searchId:s.id,error:String(error?.message||error).slice(0,150),results:[]}).catch(()=>{});
      }
      await sleep(80)
    }
    if(lastSeen.size>40)lastSeen=new Set([...lastSeen].slice(-20))
  }catch(error){
    console.warn('[Passenger Search Host]',error)
  }finally{busy=false}
}
function start(){if(timer)return;timer=setInterval(tick,900);tick()}
function stop(){if(timer){clearInterval(timer);timer=null}}
start();
window.addEventListener('mair:car-mode',()=>setTimeout(tick,100));
window.MAIRPassengerSearchHost={version:'2026-08-30-v1-safe-bridge',tick,start,stop,status:()=>({busy,seen:lastSeen.size})};
})();
