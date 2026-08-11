// Josh FM Radio Suite — memory, stats, hour markers, DJ feedback learning
(()=>{
 const $=id=>document.getElementById(id),K='jfm_radio_suite',DK='jfm_dj_feedback';
 const load=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch{return{}}},save=s=>localStorage.setItem(K,JSON.stringify(s));
 const loadDj=()=>{try{return JSON.parse(localStorage.getItem(DK)||'{"up":0,"down":0,"liked":[],"disliked":[]}')}catch{return{up:0,down:0,liked:[],disliked:[]}}},saveDj=d=>localStorage.setItem(DK,JSON.stringify(d));
 let s={minutes:0,tracks:0,discoveries:0,requests:0,likes:0,dislikes:0,lastIds:[],lastArtists:[],startedAt:0,...load()};
 document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(x=>x.remove());const touch=document.createElement('link');touch.rel='apple-touch-icon';touch.sizes='512x512';touch.href='/api/icon?v=6';document.head.appendChild(touch);const fav=document.createElement('link');fav.rel='icon';fav.type='image/png';fav.href='/api/icon?v=6';document.head.appendChild(fav);
 function rememberTrack(t){if(!t?.id||s.lastIds[0]===t.id)return;s.tracks++;s.lastIds.unshift(t.id);s.lastIds=s.lastIds.slice(0,100);const a=(t.artists?.[0]?.name||t.artists?.[0]||'').toLowerCase();if(a){s.lastArtists.unshift(a);s.lastArtists=s.lastArtists.slice(0,50)}save(s);renderStats()}
 function renderStats(){[['statTracks',s.tracks],['statDiscoveries',s.discoveries],['statRequests',s.requests],['statHours',(s.minutes/60).toFixed(1)+' u']].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v})}
 function autoMode(){if(localStorage.getItem('jfm_auto_program')==='0')return;const h=new Date().getHours();let m=h<10?'morning':h>=23?'late':h>=20?'chill':'normal';if([5,6].includes(new Date().getDay())&&h>=19)m='party';if(settings?.mode!==m&&typeof setMode==='function')setMode(m)}
 function ensureShowPill(){const live=document.querySelector('.live');if(!live)return null;let e=$('showMini');if(!e){e=document.createElement('span');e.id='showMini';e.className='show-mini';e.style.cssText='margin-left:auto;opacity:.82;font-size:11px;font-weight:800;letter-spacing:.03em';live.appendChild(e)}return e}
 function renderShow(){const clock=window.JFMRadioClock,e=ensureShowPill();if(!e)return;const show=clock?.showName?.()||'Josh FM',phase=clock?.clockPhase?.()||'open';e.textContent=show;e.dataset.phase=phase;e.title=`Radio clock: ${phase}`;document.body.dataset.show=show;document.body.dataset.clockPhase=phase}
 setInterval(()=>{if(playback?.is_playing){s.minutes++;save(s);renderStats()}},60000);let seen='';setInterval(()=>{const t=playback?.item;if(t?.id&&t.id!==seen){seen=t.id;rememberTrack(t)}renderShow()},5000);
 let hour=new Date().getHours();setInterval(()=>{const h=new Date().getHours();if(h!==hour){hour=h;window.jfmHourMarker=true}renderShow()},15000);
 document.addEventListener('click',e=>{const b=e.target.closest?.('.result');if(!b)return;setTimeout(()=>{try{const uri=b.dataset.uri,id=uri?.split(':').pop();if(id){const m=JSON.parse(localStorage.getItem('jfm_director_memory')||'{"plays":{},"likes":{},"requests":{}}');m.requests=m.requests||{};m.requests[id]=(m.requests[id]||0)+1;localStorage.setItem('jfm_director_memory',JSON.stringify(m));s.requests++;save(s);renderStats();b.querySelector('em')&&(b.querySelector('em').textContent='VERZOEK ✓')}}catch{}},200)},true);
 $('loveTrack')?.addEventListener('click',()=>{s.likes++;const id=playback?.item?.id;if(queue?.find(t=>t.id===id)?._discovery)s.discoveries++;save(s);renderStats()});$('banTrack')?.addEventListener('click',()=>{s.dislikes++;save(s);renderStats()});
 $('autoProgram')?.addEventListener('change',e=>{localStorage.setItem('jfm_auto_program',e.target.checked?'1':'0');if(e.target.checked)autoMode()});if($('autoProgram'))$('autoProgram').checked=localStorage.getItem('jfm_auto_program')!=='0';
 const djText=$('djText');if(djText&&$('factSource')){const wrap=document.createElement('div');wrap.id='djFeedback';wrap.style.cssText='display:flex;gap:8px;margin-top:12px';wrap.innerHTML='<button id="djUp" type="button" style="flex:1;border:1px solid #293650;background:#111827;color:#fff;border-radius:12px;padding:9px">👍 Meer zo</button><button id="djDown" type="button" style="flex:1;border:1px solid #293650;background:#111827;color:#fff;border-radius:12px;padding:9px">👎 Minder zo</button>';$('factSource').insertAdjacentElement('afterend',wrap);const rate=good=>{const d=loadDj(),text=window.jfmLastDJText||djText.textContent||'';if(!text)return;if(good){d.up++;d.liked.unshift(text);d.liked=d.liked.slice(0,15);$('djUp').textContent='👍 Onthouden'}else{d.down++;d.disliked.unshift(text);d.disliked=d.disliked.slice(0,15);$('djDown').textContent='👎 Onthouden'}saveDj(d);setTimeout(()=>{$('djUp').textContent='👍 Meer zo';$('djDown').textContent='👎 Minder zo'},900)};$('djUp').onclick=()=>rate(true);$('djDown').onclick=()=>rate(false)}
 autoMode();setInterval(autoMode,10*60*1000);renderStats();setTimeout(renderShow,1400);if($('installHint')&&/iphone|ipad|ipod/i.test(navigator.userAgent))$('installHint').textContent='Op iPhone: open Josh FM vanaf je beginscherm voor de volledige app-ervaring.';
 function authGuard(){const text=($('queueInfo')?.textContent||'').toLowerCase();if(text.includes('opnieuw gekoppeld')||text.includes('niet gekoppeld')||text.includes('spotify-login')){$('setup')?.classList.remove('hidden');if($('connect'))$('connect').disabled=false}}
 setInterval(authGuard,600);window.addEventListener('pageshow',authGuard);setTimeout(authGuard,800);
 window.JFMRadioSuite={state:()=>s,save,autoMode,renderShow,djFeedback:loadDj};

 // Load the playback truth layer first, then recovery and queue controllers in a deterministic order.
 const loadScript=(src,id)=>new Promise((resolve,reject)=>{
   if(document.getElementById(id))return resolve();
   const x=document.createElement('script');x.id=id;x.src=src;x.onload=()=>resolve();x.onerror=()=>reject(new Error(`Kon ${src} niet laden`));document.body.appendChild(x)
 });
 (async()=>{
   try{
     await loadScript('./playback-state.js?v=1','jfm-playback-state');
     await loadScript('./spotify-recovery.js?v=5','jfm-spotify-recovery');
     await loadScript('./station-queue.js?v=1','jfm-station-queue');
   }catch(e){console.warn('Josh FM controller load',e)}
 })();
})();
