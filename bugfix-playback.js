(()=>{
  const $=id=>document.getElementById(id);

  function ensureValidSource(){
    const source=$('source');
    const playlist=$('playlist');
    if(!source)return;
    if(source.value==='playlist'){
      const raw=(playlist?.value||'').trim();
      const valid=/playlist[/:]([A-Za-z0-9]+)/.test(raw)||/^[A-Za-z0-9]{10,}$/.test(raw);
      if(!valid){
        source.value='top';
        if(playlist)playlist.classList.add('hidden');
        try{
          const s=JSON.parse(localStorage.getItem('jfm_settings')||'{}');
          s.source='top';
          localStorage.setItem('jfm_settings',JSON.stringify(s));
        }catch{}
      }
    }
  }

  async function safeNext(){
    try{
      if(typeof playback!=='undefined'&&playback?.item?.id&&typeof recordSkip==='function')recordSkip(playback.item.id);
      await api('/me/player/next',{method:'POST'});
      setTimeout(()=>{try{refresh()}catch{}},650);
    }catch(e){
      console.error('Josh FM next error',e);
      const msg=String(e?.message||e||'Onbekende fout');
      const q=$('queueInfo');
      if(q)q.textContent='Volgende nummer lukte niet: '+msg;
    }
  }

  async function safeStart(){
    ensureValidSource();
    try{
      if(typeof queue!=='undefined'&&Array.isArray(queue)&&queue.length===0&&typeof buildSet==='function')await buildSet();
      await startRadio();
    }catch(e){
      console.error('Josh FM start error',e);
      const msg=String(e?.message||e||'Onbekende fout');
      const q=$('queueInfo');
      if(q)q.textContent='Starten lukte niet: '+msg;
    }
  }

  const next=$('next');
  if(next)next.onclick=()=>safeNext();
  const start=$('start');
  if(start)start.onclick=()=>safeStart();

  ensureValidSource();
})();
