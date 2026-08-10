// Josh FM radio upgrades — local memory, DJ feedback, intentional music runs and timely hour-openers.
(()=>{
const $=id=>document.getElementById(id),MEM='jfm_long_radio_memory',FB='jfm_dj_feedback';
function load(k,fallback){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function memory(){return load(MEM,[])}
function feedback(){return load(FB,{up:0,down:0,items:[],avoid:[]})}
window.JFMRadioUpgrades={memory,feedback};

// Keep a lightweight memory of the last few hours/days so the DJ can refer back naturally.
let seen='';setInterval(()=>{try{const item=playback?.item;if(!item?.id||item.id===seen)return;seen=item.id;const t=trackObj(item),m=memory();m.unshift({id:t.id,name:t.name,artists:t.artists,release:t.release,at:Date.now()});const unique=[];for(const x of m){if(!unique.some(y=>y.id===x.id))unique.push(x);if(unique.length>=80)break}save(MEM,unique)}catch{}},4000);

// Make long uninterrupted music stretches happen sometimes instead of forcing a DJ break on a rigid rhythm.
try{const oldSchedule=window.scheduleTalk||scheduleTalk;if(typeof oldSchedule==='function'){window.scheduleTalk=scheduleTalk=function(){oldSchedule();const level=Number(document.getElementById('talk')?.value||1);const quietChance=[.48,.32,.20,.10][level]??.25;if(Math.random()<quietChance){const extra=2+Math.floor(Math.random()*3);nextTalkAt+=extra;window.jfmMusicRun=true}else window.jfmMusicRun=false}}}catch{}

// At a new hour, make the next natural track boundary an hour-opener instead of waiting many songs.
let lastHour=new Date().getHours();setInterval(()=>{const h=new Date().getHours();if(h===lastHour)return;lastHour=h;window.jfmHourMarker=true;try{if(playback?.is_playing){tracksSinceTalk=Math.max(tracksSinceTalk,nextTalkAt-1)}}catch{}},12000);

// Add simple feedback directly to the latest DJ moment. This trains style locally without accounts or paid storage.
function installFeedback(){const text=$('djText');if(!text||$('djFeedback'))return;const card=text.closest('.card');if(!card)return;const row=document.createElement('div');row.id='djFeedback';row.className='dj-feedback';row.innerHTML='<span>Hoe was deze break?</span><div><button type="button" data-v="up">👍 Goed</button><button type="button" data-v="down">👎 Minder</button></div>';card.appendChild(row);row.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const f=feedback(),v=b.dataset.v,last=String(window.jfmLastDJText||text.textContent||'').trim();if(v==='up')f.up=(f.up||0)+1;else{f.down=(f.down||0)+1;if(last){f.avoid=f.avoid||[];f.avoid.unshift(last);f.avoid=f.avoid.slice(0,10)}}f.items=f.items||[];f.items.unshift({v,text:last,at:Date.now()});f.items=f.items.slice(0,30);save(FB,f);row.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));const span=row.querySelector('span');if(span)span.textContent=v==='up'?'Onthouden — meer in deze stijl':'Onthouden — deze stijl minder'})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFeedback);else installFeedback();
})();