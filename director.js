// Josh FM Program Director — local/free intelligence layer
(()=>{
  const $=id=>document.getElementById(id);
  const memoryKey='jfm_director_memory';
  const memory=()=>{try{return JSON.parse(localStorage.getItem(memoryKey)||'{"plays":{},"likes":{},"requests":{}}')}catch{return{plays:{},likes:{},requests:{}}}};
  const save=m=>localStorage.setItem(memoryKey,JSON.stringify(m));
  const artistKey=t=>(t?.artists?.[0]||'').toLowerCase();

  function score(t){
    const m=memory(), skips=(typeof skipMap==='function'?skipMap():{});
    return Math.random()*4-(skips[t.id]||0)*3-(m.plays[t.id]||0)*.35+(m.likes[t.id]||0)*4+(m.requests[t.id]||0)*5;
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
    if(m.requests[t.id])return 'Verzoek';
    if(t._discovery)return 'Ontdekking';
    return 'Voor jou';
  }
  function renderNext(){
    const box=$('directorQueue'); if(!box)return;
    const current=playback?.item?.id;
    let items=(queue||[]).filter(t=>t.id!==current).slice(0,6);
    if(!items.length){box.innerHTML='<p class="muted">Start Josh FM om de programmering te zien.</p>';return}
    box.innerHTML=items.map((t,i)=>`<div class="director-track"><span class="director-num">${i+1}</span>${t.image?`<img src="${esc(t.image)}" alt="">`:''}<div class="director-meta"><b>${esc(t.name)}</b><span>${esc((t.artists||[]).join(', '))}</span></div><em>${kind(t)}</em></div>`).join('');
    const n=items[0]; if($('nextUp'))$('nextUp').textContent=n?`${n.name} · ${(n.artists||[]).join(', ')}`:'—';
  }
  const oldBuild=buildSet;
  buildSet=window.buildSet=async function(){const list=await oldBuild();queue=direct(queue||list||[]);renderNext();return queue};

  // Learn passively from what actually plays; all data stays on-device.
  let seen='';
  setInterval(()=>{
    const id=playback?.item?.id;if(!id||id===seen)return;seen=id;
    const m=memory();m.plays[id]=(m.plays[id]||0)+1;save(m);renderNext();
  },7000);

  $('loveTrack')?.addEventListener('click',()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)+1;save(m);$('loveTrack').textContent='♥ Meer zoals dit';});
  $('banTrack')?.addEventListener('click',async()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)-3;save(m);try{await control('next')}catch{}});
  setInterval(renderNext,8000);setTimeout(renderNext,1200);
})();