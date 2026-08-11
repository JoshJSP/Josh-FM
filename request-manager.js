// Josh FM Request Manager — smart scheduling with one reliable armed request at a time.
(()=>{
  const KEY='jfm_requests_v1',MAX_ACTIVE=8,MAX_ARMED_TRANSITIONS=3,$=id=>document.getElementById(id);
  const now=()=>Date.now();
  let requests=load(),arming=false;
  const events=[];
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.filter(r=>r&&r.uri&&r.status!=='played').slice(0,MAX_ACTIVE).map(r=>({...r,armedTransitions:Number(r.armedTransitions||0),armAttempts:Number(r.armAttempts||0)})):[]}catch{return[]}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(requests.slice(0,MAX_ACTIVE)))}catch{}render();try{window.dispatchEvent(new CustomEvent('jfm:requests-change',{detail:{requests:requests.map(r=>({...r}))}}))}catch{}}
  function trace(stage,extra={}){events.unshift({at:now(),stage,...extra});if(events.length>80)events.length=80}
  const artistKey=t=>String(t?.artists?.[0]||'').toLowerCase().trim();
  function currentTrack(){try{return playback?.item?trackObj(playback.item):null}catch{return null}}
  function upcoming(){try{return window.jfmUpcoming?.()||[]}catch{return[]}}
  function chooseDelay(track){
    const current=currentTrack(),future=upcoming();let delay=2+Math.floor(Math.random()*2);
    const a=artistKey(track);if(a){if(a===artistKey(current))delay=Math.max(delay,3);for(let i=0;i<Math.min(5,future.length);i++)if(a===artistKey(future[i]))delay=Math.max(delay,i+3)}
    const active=requests.filter(r=>r.status==='planned'||r.status==='armed');if(active.length)delay=Math.max(delay,Math.min(5,2+active.length));return Math.min(6,delay)
  }
  async function resolveTrack(uri,button){
    const id=String(uri||'').split(':').pop();if(id)try{const raw=await api('/tracks/'+encodeURIComponent(id));if(raw?.id)return trackObj(raw)}catch{}
    const name=button?.querySelector('b')?.textContent?.trim()||'Spotify request',artists=(button?.querySelector('small')?.textContent||'').split(',').map(x=>x.trim()).filter(Boolean);
    return{id:id||'',uri,name,artists,image:button?.querySelector('img')?.src||'',duration:0}
  }
  function activeFor(uri){return requests.find(r=>r.uri===uri&&(r.status==='planned'||r.status==='armed'))||null}
  async function add(uri,button=null){
    if(!uri)return null;const existing=activeFor(uri);if(existing){paintButton(button,existing);return existing}
    if(requests.filter(r=>r.status==='planned'||r.status==='armed').length>=MAX_ACTIVE){status('Je request-wachtrij zit vol. Wacht tot er eentje draait.');return null}
    const track=await resolveTrack(uri,button),delay=chooseDelay(track),r={id:'req_'+now()+'_'+Math.random().toString(36).slice(2,7),uri,track,status:'planned',remaining:delay,requestedAt:now(),armedAt:0,armedTransitions:0,armAttempts:0};
    requests.push(r);save();paintButton(button,r);trace('request-added',{uri,remaining:delay});status(`${track.name} staat gepland · verwacht over ongeveer ${delay} nummers.`);return r
  }
  function paintButton(button,r){if(!button||!r)return;const em=button.querySelector('em');if(em)em.textContent=r.status==='armed'?'HIERNA ✓':`±${Math.max(1,r.remaining||1)} ✓`;button.dataset.requested='1'}
  function status(text){const q=$('queueInfo');if(q)q.textContent=text}
  function etaText(r){if(r.status==='armed')return'Hierna';const n=Math.max(1,Number(r.remaining)||1);return`± ${n} nummer${n===1?'':'s'}`}
  function ensurePanel(){if($('requestQueue'))return;const pane=$('tab-requests');if(!pane)return;const first=pane.querySelector('.card'),card=document.createElement('article');card.className='card';card.id='requestQueue';card.innerHTML='<div class="row between"><div><div class="kicker">REQUEST LINE</div><h3>Geplande verzoeken</h3></div><span id="requestCount" class="accent">0</span></div><div id="requestItems"><p class="muted">Nog geen verzoeken gepland.</p></div>';first?.insertAdjacentElement('afterend',card)}
  function render(){ensurePanel();const box=$('requestItems'),count=$('requestCount');if(!box)return;const active=requests.filter(r=>r.status==='planned'||r.status==='armed');if(count)count.textContent=String(active.length);if(!active.length){box.innerHTML='<p class="muted">Nog geen verzoeken gepland.</p>';return}const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));box.innerHTML=active.map(r=>`<div class="director-track" data-request-id="${safe(r.id)}">${r.track?.image?`<img src="${safe(r.track.image)}" alt="" loading="lazy">`:''}<div class="director-meta"><b>${safe(r.track?.name||'Request')}</b><span>${safe((r.track?.artists||[]).join(', '))}</span></div><em>${etaText(r)}</em></div>`).join('')}
  async function remoteQueueHas(uri){try{const d=await api('/me/player/queue');return (d?.queue||[]).some(t=>t?.uri===uri)}catch{return false}}
  async function armDue(){
    if(arming||requests.some(x=>x.status==='armed'))return false;const r=requests.find(x=>x.status==='planned'&&Number(x.remaining)<=1);if(!r)return false;
    arming=true;try{
      const alreadyQueued=await remoteQueueHas(r.uri);if(!alreadyQueued)await api('/me/player/queue?uri='+encodeURIComponent(r.uri),{method:'POST'});
      r.status='armed';r.armedAt=now();r.armedTransitions=0;r.armAttempts=Number(r.armAttempts||0)+1;save();trace(alreadyQueued?'request-adopted-remote':'request-armed',{uri:r.uri,attempt:r.armAttempts});status(`${r.track?.name||'Je request'} staat klaar in de Spotify-wachtrij.`);return true
    }catch(e){trace('request-arm-error',{uri:r.uri,error:String(e?.message||e)});status('Request kon nog niet worden klaargezet · Josh FM probeert het bij de volgende track opnieuw.');return false}
    finally{arming=false}
  }
  async function recoverStaleArmed(){
    const r=requests.find(x=>x.status==='armed');if(!r||Number(r.armedTransitions||0)<MAX_ARMED_TRANSITIONS)return false;
    const stillQueued=await remoteQueueHas(r.uri);if(stillQueued){r.armedTransitions=Math.max(1,MAX_ARMED_TRANSITIONS-1);save();trace('request-still-remote',{uri:r.uri});return false}
    r.status='planned';r.remaining=1;r.armedAt=0;r.armedTransitions=0;save();trace('request-replanned',{uri:r.uri,attempt:r.armAttempts});status(`${r.track?.name||'Request'} is opnieuw ingepland omdat Spotify hem niet afspeelde.`);setTimeout(()=>armDue().catch(()=>{}),250);return true
  }
  function onTrackChange(){
    const cur=currentTrack(),uri=cur?.uri||'',played=requests.find(r=>r.uri===uri&&(r.status==='armed'||r.status==='planned'));
    if(played){played.status='played';played.playedAt=now();trace('request-played',{uri});requests=requests.filter(r=>r.id!==played.id);save();status(`${played.track?.name||'Request'} draait nu · request afgevinkt.`);setTimeout(()=>armDue().catch(()=>{}),300);return}
    for(const r of requests){if(r.status==='planned')r.remaining=Math.max(1,(Number(r.remaining)||1)-1);else if(r.status==='armed')r.armedTransitions=Number(r.armedTransitions||0)+1}
    save();recoverStaleArmed().catch(()=>{});armDue().catch(()=>{})
  }
  document.addEventListener('click',e=>{const b=e.target.closest?.('.result');if(!b?.dataset?.uri)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();add(b.dataset.uri,b).catch(err=>{trace('request-add-error',{error:String(err?.message||err)});status('Request toevoegen lukte niet.')})},true);
  window.addEventListener('jfm:trackchange',()=>onTrackChange());window.addEventListener('online',()=>{recoverStaleArmed().catch(()=>{});armDue().catch(()=>{})});
  setInterval(()=>{render();if(document.visibilityState==='visible'){recoverStaleArmed().catch(()=>{});armDue().catch(()=>{})}},5000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensurePanel();render()});else{ensurePanel();render()}
  window.JFMRequests={version:'requests-v2-reliable-arming',add,list:()=>requests.map(r=>({...r})),isRequest:t=>!!t&&requests.some(r=>(r.uri===t.uri||r.track?.id===t.id)&&(r.status==='planned'||r.status==='armed')),eta:t=>{const r=requests.find(x=>x.uri===t?.uri||x.track?.id===t?.id);return r?etaText(r):''},armDue,recoverStaleArmed,log:()=>[...events]};
})();
