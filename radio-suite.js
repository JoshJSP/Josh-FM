// Josh FM Radio Suite — free/local enhancements: clock, memory, requests, discovery feedback, stats, auto-programming, transitions
(()=>{
 const $=id=>document.getElementById(id), K='jfm_radio_suite';
 const load=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch{return{}}};
 const save=s=>localStorage.setItem(K,JSON.stringify(s));
 let s={minutes:0,tracks:0,discoveries:0,requests:0,likes:0,dislikes:0,lastIds:[],lastArtists:[],startedAt:0,...load()};
 function rememberTrack(t){if(!t?.id||s.lastIds[0]===t.id)return;s.tracks++;s.lastIds.unshift(t.id);s.lastIds=s.lastIds.slice(0,100);const a=(t.artists?.[0]?.name||t.artists?.[0]||'').toLowerCase();if(a){s.lastArtists.unshift(a);s.lastArtists=s.lastArtists.slice(0,50)}save(s);renderStats()}
 function renderStats(){[['statTracks',s.tracks],['statDiscoveries',s.discoveries],['statRequests',s.requests],['statHours',(s.minutes/60).toFixed(1)+' u']].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v})}
 function autoMode(){if(localStorage.getItem('jfm_auto_program')==='0')return;const h=new Date().getHours();let m=h<10?'morning':h>=23?'late':h>=20?'chill':'normal';if([5,6].includes(new Date().getDay())&&h>=19)m='party';if(settings?.mode!==m&&typeof setMode==='function')setMode(m)}
 setInterval(()=>{if(playback?.is_playing){s.minutes+=1;save(s);renderStats()}},60000);
 let seen='';setInterval(()=>{const t=playback?.item;if(t?.id&&t.id!==seen){seen=t.id;rememberTrack(t)}},5000);
 // Hour marker: prepares a natural clock break, but never interrupts a song mid-track.
 let hour=new Date().getHours();setInterval(()=>{const h=new Date().getHours();if(h!==hour){hour=h;window.jfmHourMarker=true}},15000);
 // Better request bookkeeping.
 document.addEventListener('click',e=>{const b=e.target.closest?.('.result');if(!b)return;setTimeout(()=>{try{const uri=b.dataset.uri,id=uri?.split(':').pop();if(id){const m=JSON.parse(localStorage.getItem('jfm_director_memory')||'{"plays":{},"likes":{},"requests":{}}');m.requests=m.requests||{};m.requests[id]=(m.requests[id]||0)+1;localStorage.setItem('jfm_director_memory',JSON.stringify(m));s.requests++;save(s);renderStats();b.querySelector('em')&&(b.querySelector('em').textContent='VERZOEK ✓')}}catch{}},200)},true);
 // Discovery feedback: learn whether discovered songs land.
 $('loveTrack')?.addEventListener('click',()=>{s.likes++;const id=playback?.item?.id;if(queue?.find(t=>t.id===id)?._discovery)s.discoveries++;save(s);renderStats()});
 $('banTrack')?.addEventListener('click',()=>{s.dislikes++;save(s);renderStats()});
 // Auto programme switch.
 $('autoProgram')?.addEventListener('change',e=>{localStorage.setItem('jfm_auto_program',e.target.checked?'1':'0');if(e.target.checked)autoMode()});
 if($('autoProgram'))$('autoProgram').checked=localStorage.getItem('jfm_auto_program')!=='0';
 autoMode();setInterval(autoMode,10*60*1000);renderStats();
 // PWA install hint (iOS cannot trigger install programmatically).
 if($('installHint')&&/iphone|ipad|ipod/i.test(navigator.userAgent))$('installHint').textContent='Op iPhone: Deel → Zet op beginscherm voor de volledige app-ervaring.';
 window.JFMRadioSuite={state:()=>s,save,autoMode};
})();