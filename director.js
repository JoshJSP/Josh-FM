// Josh FM Program Director — local/free intelligence layer
(()=>{
  const $=id=>document.getElementById(id);
  const memoryKey='jfm_director_memory';
  const memory=()=>{try{return JSON.parse(localStorage.getItem(memoryKey)||'{"plays":{},"likes":{},"requests":{}}')}catch{return{plays:{},likes:{},requests:{}}}};
  const save=m=>localStorage.setItem(memoryKey,JSON.stringify(m));
  const artistKey=t=>(t?.artists?.[0]||'').toLowerCase();

  window.jfmDirectorMemory=memory;
  window.jfmIsRequest=t=>{const m=memory();return !!(t&&(m.requests[t.id]||m.requests[t.uri]))};

  function score(t){
    const m=memory(), skips=(typeof skipMap==='function'?skipMap():{});
    return Math.random()*4-(skips[t.id]||0)*3-(m.plays[t.id]||0)*.35+(m.likes[t.id]||0)*4+(m.requests[t.id]||m.requests[t.uri]||0)*5;
  }
  function direct(list){
    const pool=[...list].sort((a,b)=>score(b)-score(a)),out=[];
    while(pool.length){
      const recentArtists=new Set(out.slice(-5).map(artistKey));
      let i=pool.findIndex(t=>!recentArtists.has(artistKey(t)));
      if(i<0)i=0;
      out.push(pool.splice(i,1)[0]);
    }
    return out;
  }
  function kind(t){
    const m=memory();
    if(m.requests[t.id]||m.requests[t.uri])return 'Verzoek';
    if(t._discovery)return 'Ontdekking';
    return 'Voor jou';
  }
  function upcoming(){
    const current=playback?.item?.id;
    const idx=(queue||[]).findIndex(t=>t.id===current);
    if(idx>=0)return (queue||[]).slice(idx+1,idx+7);
    return (queue||[]).filter(t=>t.id!==current).slice(0,6);
  }
  window.jfmUpcoming=upcoming;
  function renderNext(){
    const box=$('directorQueue'); if(!box)return;
    const items=upcoming();
    if(!items.length){box.innerHTML='<p class="muted">Start Josh FM om de programmering te zien.</p>';if($('nextUp'))$('nextUp').textContent='—';return}
    box.innerHTML=items.map((t,i)=>`<div class="director-track"><span class="director-num">${i+1}</span>${t.image?`<img src="${esc(t.image)}" alt="">`:''}<div class="director-meta"><b>${esc(t.name)}</b><span>${esc((t.artists||[]).join(', '))}</span></div><em>${kind(t)}</em></div>`).join('');
    const n=items[0]; if($('nextUp'))$('nextUp').textContent=n?`${n.name} · ${(n.artists||[]).join(', ')}`:'—';
  }
  window.jfmRenderNext=renderNext;
  const oldBuild=buildSet;
  buildSet=window.buildSet=async function(){const list=await oldBuild();queue=direct(queue||list||[]);renderNext();return queue};

  // Mark every manually queued search result as a real request.
  $('searchResults')?.addEventListener('click',e=>{
    const btn=e.target.closest?.('.result');if(!btn)return;
    const uri=btn.dataset.uri;if(!uri)return;
    const m=memory();m.requests[uri]=(m.requests[uri]||0)+1;save(m);
    const em=btn.querySelector('em');if(em)em.textContent='✓ verzoek';
  },true);

  // Learn passively from what actually plays; all data stays on-device.
  let seen='';
  setInterval(()=>{
    const item=playback?.item,id=item?.id;if(!id||id===seen)return;seen=id;
    const m=memory();m.plays[id]=(m.plays[id]||0)+1;
    if(item?.uri&&m.requests[item.uri])m.requests[id]=Math.max(m.requests[id]||0,m.requests[item.uri]);
    save(m);renderNext();
  },5000);

  $('loveTrack')?.addEventListener('click',()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)+1;save(m);$('loveTrack').textContent='♥ Onthouden';setTimeout(()=>$('loveTrack').textContent='♥ Meer zoals dit',1000)});
  $('banTrack')?.addEventListener('click',async()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)-3;save(m);try{await control('next')}catch{}});
  setInterval(renderNext,5000);setTimeout(renderNext,1200);
})();