(()=>{
if(window.JFMTasteModel)return;
const K='jfm_taste_model_v4';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{/* opslag geblokkeerd: dan zonder opslag */}};
const blank=()=>({tracks:{},artists:{},events:[],updatedAt:0,bans:{},banArtists:{},loves:{},loveArtists:{}});
const model=()=>({...blank(),...load(K,{})});
// Lezers (rotatie scoort tientallen nummers per ronde) krijgen een gecachte kopie; event() werkt op een verse.
let rawSeen=null,viewSeen=null;
const view=()=>{let raw=null;try{raw=localStorage.getItem(K)}catch{/* opslag geblokkeerd */}if(viewSeen&&raw===rawSeen)return viewSeen;rawSeen=raw;return viewSeen=model()};
const artist=t=>norm(t?.artists?.[0]?.name||t?.artists?.[0]||'');
// Love/ban werkt door in de keuze van de zender: love geeft een kleine, begrensde plus in de rotatiescore (rotation-engine);
// ban sluit het nummer uit van elke nieuwe wachtrij (queue-core commit/buildActive), en de artiest na BAN_ARTIST_AT gebande nummers.
// Blijft er door bans minder dan MIN_LEFT over, dan geldt de oude keuze: muziek gaat voor.
const BAN_ARTIST_AT=3,MAX_KEYS=400,MIN_LEFT=5,DAY=86400000;
const trim=(o,at)=>{const k=Object.keys(o);if(k.length<=MAX_KEYS)return o;k.sort((a,b)=>at(o[b])-at(o[a]));const out={};for(const x of k.slice(0,MAX_KEYS))out[x]=o[x];return out};
const bump=(o,k,now)=>{o[k]={n:Number(o[k]?.n||0)+1,at:now}};
const isBanned=(t,m)=>!!t?.id&&(!!m.bans?.[t.id]||Number(m.banArtists?.[artist(t)]?.n||0)>=BAN_ARTIST_AT);
function filterBanned(list,opts={}){try{const m=view();if(!Array.isArray(list)||!list.length||!Object.keys(m.bans||{}).length)return list;const out=list.filter(t=>!isBanned(t,m)||t?.id===opts.keepId||t?._request||(typeof window.jfmIsRequest==='function'&&window.jfmIsRequest(t)));return out.length>=Math.min(MIN_LEFT,list.length)?out:list}catch{return list}}
function rotationBoost(t){try{const m=view(),now=Date.now(),a=artist(t),dec=x=>Math.max(.2,Math.exp(-(now-Number(x?.at||0))/DAY/60)),l=m.loves?.[t?.id],la=m.loveArtists?.[a],ba=m.banArtists?.[a];return Math.min(8,Math.min(2,Number(l?.n||0))*2*dec(l)+Math.min(3,Number(la?.n||0))*1.5*dec(la))-Math.min(2,Number(ba?.n||0))*3}catch{return 0}}
function event(type,t,value){if(!t?.id)return;const m=model(),a=artist(t),v=Number(value||0),now=Date.now();if(type==='ban'){if(!m.bans[t.id]&&a)bump(m.banArtists,a,now);m.bans[t.id]=now;delete m.loves[t.id];m.bans=trim(m.bans,x=>x);m.banArtists=trim(m.banArtists,x=>x.at)}else if(type==='love'){delete m.bans[t.id];bump(m.loves,t.id,now);if(a)bump(m.loveArtists,a,now);m.loves=trim(m.loves,x=>x.at);m.loveArtists=trim(m.loveArtists,x=>x.at)}m.tracks[t.id]=Number(m.tracks[t.id]||0)+v;if(a)m.artists[a]=Number(m.artists[a]||0)+v*.45;m.events.unshift({type,id:t.id,artist:a,value:v,at:Date.now()});m.events=m.events.slice(0,160);m.updatedAt=Date.now();save(K,m);setTimeout(()=>window.JFMMusicIntelligence?.rerank?.(),50)}
function externalScore(t){let s=0;try{const d=load('jfm_director_memory',{plays:{},likes:{},requests:{}});s+=Number(d.likes?.[t.id]||0)*6+Number(d.requests?.[t.id]||0)*4-Math.min(5,Number(d.plays?.[t.id]||0))*.25}catch{/* optionele waarde/uitbreiding niet beschikbaar: dan terugval */}try{const sk=typeof window.skipMap==='function'?window.skipMap():load('jfm_skips',{});s-=Number(sk?.[t.id]||0)*7}catch{/* optionele waarde/uitbreiding niet beschikbaar: dan terugval */}try{const b=load('jfm_hit_battle_v1',{tracks:{},artists:{}}),x=b.tracks?.[t.id]||{};s+=Number(x.score||0)*2+Number(b.artists?.[artist(t)]||0)*.8}catch{/* optionele waarde/uitbreiding niet beschikbaar: dan terugval */}return s}
function score(t){if(!t?.id)return 0;const m=model(),a=artist(t),now=Date.now();let s=Number(m.tracks?.[t.id]||0)+Number(m.artists?.[a]||0)+externalScore(t);for(const e of (m.events||[]).slice(0,80)){if(e.id!==t.id&&e.artist!==a)continue;const age=(now-Number(e.at||0))/86400000,decay=Math.max(.12,Math.exp(-age/45)),w=e.id===t.id?0.65:0.2;s+=Number(e.value||0)*decay*w}return Math.max(-40,Math.min(40,s))}
// Het spelende nummer komt uit playback (zoals director.js doet); eerder zocht dit in window.queue, dat niet bestaat.
function current(){try{const it=typeof playback!=='undefined'?playback?.item:null;if(!it?.id)return null;return typeof trackObj==='function'?trackObj(it):{id:it.id,artists:(it.artists||[]).map(x=>x?.name||x)}}catch{return null}}
function bind(id,type,value){const b=document.getElementById(id);if(!b||b.dataset.tasteV4)return;b.dataset.tasteV4='1';b.addEventListener('click',()=>{const t=current();if(t)event(type,t,value)})}
function install(){bind('loveTrack','love',8);bind('banTrack','ban',-12)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();// Met het scherm uit verandert er geen UI om aan te haken, dus deze poller
// slaat over en draait eenmalig in zodra MAIR weer zichtbaar is (audit H-5).
setInterval(()=>{if(document.hidden)return;install()},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)install()});
window.JFMTasteModel={version:'personal-learning-v4',score,event,filterBanned,rotationBoost,isBanned:t=>isBanned(t,view()),get profile(){return model()},reset(){save(K,blank());window.JFMMusicIntelligence?.rerank?.()}};
})();