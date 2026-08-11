// Josh FM Program Director — local/free adaptive programming
(()=>{
const $=id=>document.getElementById(id),memoryKey='jfm_director_memory';
const memory=()=>{try{return JSON.parse(localStorage.getItem(memoryKey)||'{"plays":{},"likes":{},"requests":{},"discoveryWins":{},"discoveryLosses":{}}')}catch{return{plays:{},likes:{},requests:{},discoveryWins:{},discoveryLosses:{}}}};
const save=m=>localStorage.setItem(memoryKey,JSON.stringify(m));
const artistKey=t=>(t?.artists?.[0]||'').toLowerCase().trim();
const yr=t=>Number(String(t?.release||'').slice(0,4))||0;
const isRequest=t=>{if(!t)return false;try{if(window.JFMRequests?.isRequest?.(t))return true}catch{}const m=memory();return!!(m.requests[t.id]||m.requests[t.uri])};
window.jfmDirectorMemory=memory;window.jfmIsRequest=isRequest;

function baseScore(t){
  const m=memory(),skips=(typeof skipMap==='function'?skipMap():{});
  return Math.random()*2.4-(skips[t.id]||0)*3.4-(m.plays[t.id]||0)*.3+(m.likes[t.id]||0)*4.6+(m.requests[t.id]||m.requests[t.uri]||0)*6.4+(m.discoveryWins[t.id]||0)*3.2-(m.discoveryLosses[t.id]||0)*4.2
}
function fitScore(t,out){
  let s=baseScore(t);const a=artistKey(t),recent=out.slice(-6),last=recent[recent.length-1];
  if(!last)return s;
  for(let back=1;back<=recent.length;back++){
    const prev=recent[recent.length-back];
    if(a&&a===artistKey(prev))s-=[0,14,10,7,5,3,2][back]||2;
  }
  const y=yr(t),ly=yr(last);if(y&&ly){const gap=Math.abs(y-ly);if(gap<=6)s+=1.1;else if(gap>25)s-=1.2}
  const recentDiscovery=recent.slice(-2).some(x=>x?._discovery);
  if(t._discovery){s+=recentDiscovery?-7:1.6}else if(last?._discovery)s+=2.2;
  const recentRequests=recent.slice(-3).filter(isRequest).length;
  if(isRequest(t)){s+=recentRequests?-(6+recentRequests*3):2.5}else if(isRequest(last))s+=1.4;
  return s
}
function directWithContext(list,context=[]){
  const pool=[...list],prefix=(context||[]).filter(Boolean).slice(-6),out=[];
  while(pool.length){let best=0,bestS=-Infinity;const scoring=[...prefix,...out];for(let i=0;i<pool.length;i++){const s=fitScore(pool[i],scoring);if(s>bestS){bestS=s;best=i}}out.push(pool.splice(best,1)[0])}
  return out
}
function direct(list){return directWithContext(list,[])}
function kind(t){if(isRequest(t))return'Verzoek';if(t?._discovery)return'Ontdekking';return'Voor jou'}
function baseUpcoming(){const current=playback?.item?.id,idx=(queue||[]).findIndex(t=>t.id===current);if(idx>=0)return(queue||[]).slice(idx+1,idx+7);return(queue||[]).filter(t=>t.id!==current).slice(0,6)}
function upcoming(){
  const items=baseUpcoming();
  try{
    const armed=window.JFMRequests?.list?.().find(r=>r.status==='armed');
    if(armed?.track?.uri){const t={...armed.track,_request:true};const dedup=items.filter(x=>x.uri!==t.uri&&x.id!==t.id);return[t,...dedup].slice(0,6)}
  }catch{}
  return items
}
window.jfmUpcoming=upcoming;
function renderNext(){const box=$('directorQueue');if(!box)return;const items=upcoming();if(!items.length){box.innerHTML='<p class="muted">Start Josh FM om de programmering te zien.</p>';if($('nextUp'))$('nextUp').textContent='—';return}box.innerHTML=items.map((t,i)=>`<div class="director-track"><span class="director-num">${i+1}</span>${t.image?`<img src="${esc(t.image)}" alt="">`:''}<div class="director-meta"><b>${esc(t.name)}</b><span>${esc((t.artists||[]).join(', '))}</span></div><em>${kind(t)}</em></div>`).join('');const n=items[0];if($('nextUp'))$('nextUp').textContent=n?`${n.name} · ${(n.artists||[]).join(', ')}`:'—'}
window.jfmRenderNext=renderNext;
const oldBuild=buildSet;buildSet=window.buildSet=async function(){const list=await oldBuild();queue=direct(queue||list||[]);renderNext();return queue};
$('searchResults')?.addEventListener('click',e=>{const btn=e.target.closest?.('.result');if(!btn)return;const uri=btn.dataset.uri;if(!uri)return;const m=memory(),id=uri.split(':').pop();m.requests[uri]=(m.requests[uri]||0)+1;if(id)m.requests[id]=(m.requests[id]||0)+1;save(m)},true);
let seen='';setInterval(()=>{const item=playback?.item,id=item?.id;if(!id||id===seen)return;seen=id;const m=memory();m.plays[id]=(m.plays[id]||0)+1;if(item?.uri&&m.requests[item.uri])m.requests[id]=Math.max(m.requests[id]||0,m.requests[item.uri]);save(m);renderNext()},5000);
window.addEventListener('jfm:trackchange',()=>renderNext());
window.addEventListener('jfm:requests-change',()=>renderNext());
$('loveTrack')?.addEventListener('click',()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)+1;const q=(queue||[]).find(t=>t.id===id);if(q?._discovery)m.discoveryWins[id]=(m.discoveryWins[id]||0)+1;save(m);$('loveTrack').textContent='♥ Onthouden';setTimeout(()=>$('loveTrack').textContent='♥ Meer zoals dit',1000)});
$('banTrack')?.addEventListener('click',async()=>{const id=playback?.item?.id;if(!id)return;const m=memory();m.likes[id]=(m.likes[id]||0)-3;const q=(queue||[]).find(t=>t.id===id);if(q?._discovery)m.discoveryLosses[id]=(m.discoveryLosses[id]||0)+1;save(m);try{await window.JFMPlayback?.next?.()||control('next')}catch{}});
window.JFMProgramDirector={version:'director-v4-requests',direct,directWithContext,score:fitScore,upcoming,kind,isRequest};
setInterval(renderNext,5000);setTimeout(renderNext,1200);
})();
