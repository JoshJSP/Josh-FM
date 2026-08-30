// MAIR Discovery — the slider controls how adventurous the Discovery station may be.
(()=>{
'use strict';
const slider=document.getElementById('discovery'),label=document.getElementById('discoveryValue');if(!slider||!label)return;
const KEY='jfm_discovery',CACHE_KEY='jfm_discovery_station_cache_v1',CHANNEL_KEY='jfm_music_channel_v1',NOW=()=>new Date().getFullYear();
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const stored=Number(localStorage.getItem(KEY));slider.value=String(Number.isFinite(stored)?clamp(stored):50);
function levelName(v=slider.value){v=clamp(v);if(v<=15)return'Veilig';if(v<=35)return'Vertrouwd';if(v<=65)return'Gebalanceerd';if(v<=85)return'Avontuurlijk';return'Verrassing'}
function paint(){const v=clamp(slider.value);label.textContent=`${v}% · ${levelName(v)}`;label.title='Geldt alleen voor MAIR Discovery: hoger betekent verder buiten je vertrouwde muzieksmaak.'}
function stationId(){try{return window.JFMMusicChoice?.channel||localStorage.getItem(CHANNEL_KEY)||'mix'}catch{return localStorage.getItem(CHANNEL_KEY)||'mix'}}
function isDiscoveryStation(){return stationId()==='new'}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function telemetry(){return readJson('jfm_top40_telemetry_v1',{})}
function favoriteArtists(){const scores=new Map();for(const e of Object.values(telemetry())){if(!e||typeof e!=='object')continue;const s=Number(e.listenMs||0)/60000+Number(e.completed||0)*4+Number(e.starts||0)+Number(e.likes||0)*6;for(const a of (e.artists||[]).map(String).filter(Boolean))scores.set(a,(scores.get(a)||0)+s)}return[...scores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0])}
function queryPlan(v=slider.value){const y=NOW(),a=favoriteArtists(),value=clamp(v);if(value<=15)return[...(a.slice(0,2).map(x=>`artist:${x} year:${y}`)),`year:${y} pop`].slice(0,3);if(value<=35)return[...(a.slice(0,1).map(x=>`artist:${x} year:${y}`)),`year:${y} pop`,`year:${y} dance pop`].slice(0,3);if(value<=65)return[`year:${y} pop`,`year:${y} indie pop`,`year:${y} r&b`];if(value<=85)return[`year:${y} indie`,`year:${y} alternative`,`year:${y} electronic`];return[`year:${y} alternative`,`year:${y} indie`,`year:${y} electronic`]}
function cache(){const x=readJson(CACHE_KEY,{});return x&&typeof x==='object'?x:{}}
function saveCache(x){try{localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch{}}
function toTrack(t){return{id:t.id,uri:t.uri,name:t.name||'',artists:(t.artists||[]).map(a=>a?.name||a).filter(Boolean),album:t.album?.name||'',release:t.album?.release_date||'',image:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||'',url:t.external_urls?.spotify||'',duration:t.duration_ms||0,popularity:Number(t.popularity||0),_discovery:true}}
async function search(q){const c=cache(),k=String(q),hit=c[k];if(hit?.at&&Date.now()-Number(hit.at)<30*60*1000&&Array.isArray(hit.items)&&hit.items.length)return hit.items;try{const d=await api('/search?type=track&limit=50&q='+encodeURIComponent(q)),items=(d?.tracks?.items||[]).filter(t=>t?.id&&t?.uri).map(toTrack);if(items.length){c[k]={at:Date.now(),items};saveCache(c)}return items}catch{return[]}}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function sig(t){return`${norm(t?.name)}|${(t?.artists||[]).map(norm).sort().join('|')}`}
function dedupe(list){const ids=new Set(),sigs=new Set(),out=[];for(const t of list||[]){if(!t?.id||!t?.uri)continue;const k=sig(t);if(ids.has(t.id)||sigs.has(k))continue;ids.add(t.id);sigs.add(k);out.push(t)}return out}
function tasteScore(t){try{return Number(window.JFMTasteModel?.score?.(t)||0)}catch{return 0}}
function adventureScore(t,v){const a=clamp(v)/100,pop=Number(t.popularity||0),targetPop=78-a*58,popFit=20-Math.abs(pop-targetPop)/3.5,taste=tasteScore(t)*(1-a)*1.25,fresh=String(t.release||'').startsWith(String(NOW()))?8:2,random=Math.random()*(2+a*15);return fresh+popFit+taste+random}
let buildToken=0,busy=false,timer=null;
async function rebuildDiscoveryStation(force=false){if(!isDiscoveryStation())return false;if(busy&&!force)return false;const token=++buildToken;busy=true;const v=clamp(slider.value),info=document.getElementById('queueInfo');try{if(info)info.textContent=`MAIR Discovery · ${levelName(v)} · nieuwe muziek zoeken…`;const existing=(typeof queue!=='undefined'&&Array.isArray(queue)?queue:[]).map(t=>({...t,_discovery:true})),found=[...existing];for(const q of queryPlan(v)){if(token!==buildToken||!isDiscoveryStation())return false;found.push(...await search(q))}if(token!==buildToken||!isDiscoveryStation())return false;let ranked=dedupe(found).filter(t=>{const y=Number(String(t.release||'').slice(0,4));return!y||y>=NOW()-1}).map(t=>({...t,_discovery:true,_discoveryReason:`MAIR Discovery · ${levelName(v)}`})).sort((a,b)=>adventureScore(b,v)-adventureScore(a,v));if(ranked.length<5)return false;const currentId=(()=>{try{return playback?.item?.id||''}catch{return''}})(),currentTrack=currentId?existing.find(t=>t.id===currentId):null;if(currentTrack)ranked=[currentTrack,...ranked.filter(t=>t.id!==currentId)];queue=ranked.slice(0,50);try{window.__jfmStationQueueSig=''}catch{};try{window.jfmRenderNext?.();window.JFMProgramDirector?.render?.()}catch{}if(info)info.textContent=`${queue.length} tracks klaar · MAIR Discovery · ${v}% ${levelName(v)}.`;try{window.dispatchEvent(new CustomEvent('mair:discovery-station-refreshed',{detail:{percent:v,level:levelName(v),tracks:queue.length}}))}catch{}return true}finally{busy=false}}
function scheduleRebuild(ms=900){clearTimeout(timer);timer=setTimeout(()=>{if(isDiscoveryStation())rebuildDiscoveryStation().catch(()=>{})},ms)}
function ensureBridge(){if(window.MAIRProfileDiscoveryBridge||document.getElementById('mair-profile-discovery-bridge-js'))return;const s=document.createElement('script');s.id='mair-profile-discovery-bridge-js';s.src='./mair-profile-discovery-bridge.js?v=2';s.async=false;document.body.appendChild(s)}
paint();localStorage.setItem(KEY,slider.value);
slider.addEventListener('input',()=>{paint();localStorage.setItem(KEY,String(clamp(slider.value)))});
slider.addEventListener('change',()=>{paint();localStorage.setItem(KEY,String(clamp(slider.value)));try{window.dispatchEvent(new CustomEvent('mair:discovery-change',{detail:{percent:clamp(slider.value),level:levelName()}}))}catch{}if(isDiscoveryStation())scheduleRebuild(180)});
for(const e of ['mair:station-selected','mair:channelchange'])window.addEventListener(e,()=>scheduleRebuild(1000));
document.addEventListener('click',e=>{if(e.target.closest?.('[data-mair-station="new"],[data-jfm-channel="new"]'))scheduleRebuild(1300)},true);
window.addEventListener('pageshow',()=>scheduleRebuild(1200));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureBridge();scheduleRebuild(1200)},{once:true});else{ensureBridge();scheduleRebuild(1200)}
window.JFMDiscovery={version:'discovery-station-adventure-v7',value:()=>clamp(slider.value),level:()=>levelName(slider.value),queryPlan,rebuild:rebuildDiscoveryStation,isDiscoveryStation};
})();