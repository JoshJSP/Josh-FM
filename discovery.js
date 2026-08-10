// Josh FM AI discovery layer. Loaded after app.js so it can extend the existing radio builder.
(()=>{
const slider=document.getElementById('discovery'),label=document.getElementById('discoveryValue');
if(!slider||!label)return;
const stored=Number(localStorage.getItem('jfm_discovery'));
slider.value=Number.isFinite(stored)?Math.max(0,Math.min(100,stored)):30;
const paint=()=>label.textContent=`${slider.value}%`;
paint();
slider.addEventListener('input',()=>{paint();localStorage.setItem('jfm_discovery',slider.value)});
slider.addEventListener('change',()=>{localStorage.setItem('jfm_discovery',slider.value);if(typeof queue!=='undefined')queue=[]});

const originalBuild=window.buildSet||buildSet;
window.buildSet=buildSet=async function(){
  const base=await originalBuild();
  const pct=Number(slider.value)||0;
  if(!pct||!base?.length)return base;
  const wanted=Math.round(Math.min(50,base.length)*pct/100);
  if(!wanted)return base;
  const info=document.getElementById('queueInfo');
  if(info)info.textContent=`AI zoekt ${wanted} nieuwe tracks die bij je smaak passen…`;
  try{
    const seeds=base.slice(0,24).map(t=>({name:t.name,artists:t.artists,release:t.release}));
    const r=await fetch('/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seeds,count:Math.min(20,wanted),mode:settings?.mode||'normal'})});
    if(!r.ok)throw new Error('discovery unavailable');
    const d=await r.json(),ideas=Array.isArray(d.tracks)?d.tracks:[];
    const found=[];
    for(const idea of ideas.slice(0,Math.min(20,wanted*2))){
      if(found.length>=wanted)break;
      const q=[idea.title,idea.artist].filter(Boolean).join(' ');
      if(!q)continue;
      try{
        const s=await api('/search?type=track&limit=5&q='+encodeURIComponent(q));
        const items=s.tracks?.items||[];
        const pick=items.find(t=>!base.some(b=>b.id===t.id)&&!found.some(f=>f.id===t.id));
        if(pick)found.push(trackObj(pick));
      }catch{}
    }
    if(found.length){
      const keep=Math.max(0,Math.min(50,50-found.length));
      const familiar=base.slice(0,keep);
      const mixed=[...familiar,...found].sort(()=>Math.random()-.5);
      queue=mixed.slice(0,50);
      if(info)info.textContent=`${queue.length} tracks klaar · ${found.length} ontdekt door AI · ${pct}% ontdekking.`;
      return queue;
    }
  }catch(e){console.warn('AI discovery:',e)}
  if(info)info.textContent=`${base.length} tracks klaar · AI-ontdekking tijdelijk niet beschikbaar.`;
  return base;
};
})();
