(()=>{
'use strict';
if(window.MAIRCategoryPurity)return;
const semantic=new Set(['nl','party','chill','sleep','summer']);
const sleepNoise=/\b(white noise|brown noise|pink noise|rain sounds?|ocean sounds?|nature sounds?|sleep sounds?|asmr|binaural|delta waves?|theta waves?|meditation|soundscape|drone|ambient sleep|deep sleep)\b/i;
async function boundedFetch(url,opt={},ms=10000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
const year=t=>Number(String(t?.release||t?.album?.release_date||'').slice(0,4))||0;
const currentYear=()=>new Date().getFullYear();
const dedupe=list=>{const seen=new Set();return(Array.isArray(list)?list:[]).filter(t=>t?.id&&t?.uri&&!seen.has(t.id)&&(seen.add(t.id),true))};
function hardFilter(channel,list){const now=currentYear();list=dedupe(list);if(channel==='new')return list.filter(t=>year(t)===now);if(channel==='throwback')return list.filter(t=>year(t)>0&&year(t)<=2016);if(channel==='00s')return list.filter(t=>year(t)>=2000&&year(t)<=2009);if(channel==='10s')return list.filter(t=>year(t)>=2010&&year(t)<=2019);if(channel==='hits')return list.filter(t=>year(t)>=now-3&&Number(t?.popularity||0)>=65);if(channel==='top40')return list.filter(t=>year(t)>=now-1&&Number(t?.popularity||0)>=70);if(channel==='sleep')return list.filter(t=>!sleepNoise.test(`${String(t?.name||'')} ${JSON.stringify(t?.artists||[])} ${String(t?.album||'')}`));return list}
async function validate(channel,list,{minimum=1}={}){channel=String(channel||'mix');const original=dedupe(list);let filtered=hardFilter(channel,original);if(!filtered.length&&original.length&&channel!=='sleep')filtered=original;if(semantic.has(channel)&&filtered.length){try{const r=await boundedFetch('/api/category-filter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel,tracks:filtered.slice(0,50)})});if(r.ok){const d=await r.json().catch(()=>({})),accepted=new Set((Array.isArray(d.accepted)?d.accepted:[]).filter(x=>Number(x?.confidence)>=.90).map(x=>String(x.id))),semanticFiltered=filtered.filter(t=>accepted.has(String(t.id)));if(channel==='sleep')filtered=semanticFiltered;else if(semanticFiltered.length>=Math.max(1,Number(minimum)||1))filtered=semanticFiltered}}catch{}}
filtered=dedupe(filtered);if(channel==='sleep')return filtered;return filtered.length?filtered:original}
function active(){return localStorage.getItem('jfm_music_channel_v1')||'mix'}
window.MAIRCategoryPurity={version:'mair-category-purity-v2.2-sleep-songs',validate,hardFilter,active,isStrict:c=>c!=='mix'};
})();