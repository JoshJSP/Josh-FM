// MAIR DJ Memory — persistent anti-repeat context for presenter copy.
(()=>{
'use strict';
if(window.MAIRDJMemory)return;
const KEY='mair_dj_memory_v2',MAX=80,MAX_AGE=72*60*60*1000;
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const words=s=>norm(s).split(' ').filter(x=>x.length>2);
function load(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>Date.now()-Number(x?.at||0)<MAX_AGE).slice(0,MAX):[]}catch{return[]}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify((a||[]).slice(0,MAX)))}catch{}}
function opener(text){return words(text).slice(0,5).join(' ')}
function similarity(a,b){const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)}
function record(data={}){const text=String(data.text||'').replace(/\s+/g,' ').trim();if(!text)return false;let a=load();if(a[0]?.text===text)return false;const dj=String(data.dj||window.MAIRDJProfiles?.current?.id||'josh'),show=String(data.show||window.JFMStationClock?.current?.()?.show?.id||''),artists=[data.current?.artists?.[0],data.next?.artists?.[0],...(data.artists||[])].map(x=>String(x||'').trim()).filter(Boolean);a.unshift({at:Date.now(),dj,show,text,opener:opener(text),artists:[...new Set(artists)].slice(0,4),kind:String(data.kind||'')});save(a);try{window.dispatchEvent(new CustomEvent('mair:dj-memory',{detail:a[0]}))}catch{}return true}
function context(dj=window.MAIRDJProfiles?.current?.id||'josh'){const a=load(),mine=a.filter(x=>x.dj===dj),recent=mine.slice(0,14);return{recentDJ:recent.map(x=>x.text),avoidOpeners:[...new Set(recent.map(x=>x.opener).filter(Boolean))].slice(0,10),recentArtists:[...new Set(a.flatMap(x=>x.artists||[]))].slice(0,16),recentShows:[...new Set(recent.map(x=>x.show).filter(Boolean))].slice(0,6),lastAt:recent[0]?.at||0}}
function isTooSimilar(text,dj=window.MAIRDJProfiles?.current?.id||'josh'){return load().filter(x=>x.dj===dj).slice(0,10).some(x=>similarity(text,x.text)>=.72)}
function clear(){try{localStorage.removeItem(KEY)}catch{};try{window.dispatchEvent(new CustomEvent('mair:dj-memory-cleared'))}catch{}}
window.MAIRDJMemory={version:'mair-dj-memory-v2',record,context,isTooSimilar,similarity,list:load,clear};
})();
