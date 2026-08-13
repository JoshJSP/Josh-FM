(()=>{
if(window.JFMTasteModel)return;
const K='jfm_taste_model_v4';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const blank=()=>({tracks:{},artists:{},events:[],updatedAt:0});
const model=()=>({...blank(),...load(K,{})});
const artist=t=>norm(t?.artists?.[0]||'');
function event(type,t,value){if(!t?.id)return;const m=model(),a=artist(t),v=Number(value||0);m.tracks[t.id]=Number(m.tracks[t.id]||0)+v;if(a)m.artists[a]=Number(m.artists[a]||0)+v*.45;m.events.unshift({type,id:t.id,artist:a,value:v,at:Date.now()});m.events=m.events.slice(0,160);m.updatedAt=Date.now();save(K,m);setTimeout(()=>window.JFMMusicIntelligence?.rerank?.(),50)}
function externalScore(t){let s=0;try{const d=load('jfm_director_memory',{plays:{},likes:{},requests:{}});s+=Number(d.likes?.[t.id]||0)*6+Number(d.requests?.[t.id]||0)*4-Math.min(5,Number(d.plays?.[t.id]||0))*.25}catch{}try{const sk=typeof window.skipMap==='function'?window.skipMap():load('jfm_skips',{});s-=Number(sk?.[t.id]||0)*7}catch{}try{const b=load('jfm_hit_battle_v1',{tracks:{},artists:{}}),x=b.tracks?.[t.id]||{};s+=Number(x.score||0)*2+Number(b.artists?.[artist(t)]||0)*.8}catch{}return s}
function score(t){if(!t?.id)return 0;const m=model(),a=artist(t),now=Date.now();let s=Number(m.tracks?.[t.id]||0)+Number(m.artists?.[a]||0)+externalScore(t);for(const e of (m.events||[]).slice(0,80)){if(e.id!==t.id&&e.artist!==a)continue;const age=(now-Number(e.at||0))/86400000,decay=Math.max(.12,Math.exp(-age/45)),w=e.id===t.id?0.65:0.2;s+=Number(e.value||0)*decay*w}return Math.max(-40,Math.min(40,s))}
function current(){try{const id=window.JFMPlaybackState?.get?.()?.trackId||window.playback?.item?.id;return (window.queue||[]).find(t=>t?.id===id)||null}catch{return null}}
function bind(id,type,value){const b=document.getElementById(id);if(!b||b.dataset.tasteV4)return;b.dataset.tasteV4='1';b.addEventListener('click',()=>{const t=current();if(t)event(type,t,value)})}
let last='';window.addEventListener('jfm:trackchange',e=>{const id=e?.detail?.trackId||'';if(!id||id===last)return;last=id;const t=(window.queue||[]).find(x=>x?.id===id);if(t)event('play',t,.35)});
function install(){bind('loveTrack','love',8);bind('banTrack','ban',-12)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();setInterval(install,3000);
window.JFMTasteModel={version:'personal-learning-v4',score,event,get profile(){return model()},reset(){save(K,blank());window.JFMMusicIntelligence?.rerank?.()}};
})();