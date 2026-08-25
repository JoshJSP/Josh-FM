// MAIR Live News — opt-in, source-attributed RSS context for DJ links.
(()=>{
'use strict';
if(window.MAIRLiveNews)return;
const $=id=>document.getElementById(id),ENABLED='mair_news_enabled_v1',CACHE='mair_news_cache_v1',LAST='mair_news_last_used_v1',LAST_SLOT='mair_news_last_slot_v1',LAST_TITLE='mair_news_last_title_v1',COOLDOWN=27*60*1000;let data=null,lastError='',loading=false;
const isEnabled=()=>localStorage.getItem(ENABLED)==='1';
function cached(){try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch{return null}}
function save(d){try{localStorage.setItem(CACHE,JSON.stringify(d))}catch{}}
function fresh(h){if(!h?.title)return false;if(!h.publishedAt)return true;const at=new Date(h.publishedAt).getTime();return Number.isFinite(at)&&Date.now()-at<12*60*60*1000}
function slot(date=new Date()){const d=new Date(date);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${d.getMinutes()<30?'00':'30'}`}
async function refresh(force=false){if(loading||(!force&&!isEnabled()))return data||cached();loading=true;try{const r=await fetch('/api/live-headlines',{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(d.headlines))throw Error(d?.error||`Nieuws HTTP ${r.status}`);data=d;save(d);lastError='';emit();render();return d}catch(e){lastError=String(e?.message||e);data=data||cached();emit();render();return data}finally{loading=false}}
function candidates(){const d=data||cached(),lastTitle=String(localStorage.getItem(LAST_TITLE)||'').trim();return(d?.headlines||[]).filter(fresh).filter(h=>String(h?.title||'').trim()!==lastTitle)}
function candidate(){const list=candidates();return list[0]||((data||cached())?.headlines||[]).filter(fresh)[0]||null}
function eligible(){if(!isEnabled())return false;const now=Date.now(),last=Number(localStorage.getItem(LAST)||0);if(now-last<COOLDOWN)return false;const p=window.JFMStationClock?.current?.()?.phase||document.body?.dataset?.clockPhase||'open';if(!['top','half'].includes(p))return false;return localStorage.getItem(LAST_SLOT)!==slot()}
function take(){if(!eligible())return null;const h=candidate();if(!h)return null;try{localStorage.setItem(LAST,String(Date.now()));localStorage.setItem(LAST_SLOT,slot());localStorage.setItem(LAST_TITLE,String(h.title||''))}catch{};render();return{title:h.title,source:h.source||'NOS',sourceLabel:(data||cached())?.sourceLabel||'NOS Nieuws',link:h.link||'',publishedAt:h.publishedAt||null}}
function peek(){const h=candidate();return{enabled:isEnabled(),eligible:eligible(),headline:h,source:(data||cached())?.sourceLabel||'NOS Nieuws',lastUsed:Number(localStorage.getItem(LAST)||0),lastSlot:localStorage.getItem(LAST_SLOT)||'',error:lastError,loading}}
function setEnabled(v){localStorage.setItem(ENABLED,v?'1':'0');const box=$('newsMention');if(box)box.checked=!!v;if(v)refresh(true);render();emit()}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:live-news',{detail:peek()}))}catch{}}
function installUI(){if($('newsMention'))return;const weather=$('weatherMention'),host=weather?.closest('label');if(!host)return;const label=document.createElement('label');label.className='switch';label.innerHTML='<input id="newsMention" type="checkbox"><span></span><b>Actuele headlines (NOS, max 1× per half uur)</b>';host.insertAdjacentElement('afterend',label);const p=document.createElement('p');p.id='mairNewsStatus';p.className='muted';p.style.marginTop='8px';label.insertAdjacentElement('afterend',p);$('newsMention').checked=isEnabled();$('newsMention').addEventListener('change',e=>setEnabled(e.target.checked));render()}
function render(){const p=$('mairNewsStatus');if(!p)return;const s=peek();p.textContent=!s.enabled?'Nieuwscontext staat uit.':s.error?`Nieuws tijdelijk niet beschikbaar · ${s.error}`:s.headline?`Volgend halfuurmoment · ${s.source} · ${s.headline.title}`:'Nieuws wordt opgehaald…'}
function boot(){installUI();data=cached();if(isEnabled())refresh(true);setInterval(()=>refresh(false),10*60*1000);setInterval(render,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRLiveNews={version:'mair-live-news-v1.1-half-hour',refresh,peek,take,setEnabled,get enabled(){return isEnabled()}};
})();