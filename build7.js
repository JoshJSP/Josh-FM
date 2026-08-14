(()=>{
'use strict';
const $=id=>document.getElementById(id);
const KEY='mair_build7';
const defaults={dj:'mix',rotation:60,liveContext:true,personal:true,requestPriority:'balanced'};
let prefs={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')};
const DJs={mix:['DJ Mix','Wisselt automatisch tussen Josh, Maya, Max en Noah'],josh:['Josh','Allround · warm · energiek'],maya:['Maya','Warm · levendig · persoonlijk'],max:['Max','Snel · jong · energiek'],noah:['Noah','Rustig · late night · muziekkenner']};
function save(){localStorage.setItem(KEY,JSON.stringify(prefs));document.dispatchEvent(new CustomEvent('mair:prefs',{detail:prefs}))}
function inject(){
 const radio=$('tab-radio'),settings=$('tab-settings'),requests=$('tab-requests'); if(!radio||!settings||!requests)return;
 const forYou=document.createElement('article');forYou.className='card mair-b7';forYou.innerHTML=`<div class="kicker">VOOR JOU</div><h3>MAIR leert wat jij wilt horen</h3><p class="muted">Je skips, likes, verzoeken en luistermomenten sturen de mix. Dit blijft op dit apparaat.</p><div class="grid2"><button class="quick" id="b7Comfort"><b>✨ Mijn mix</b><span>Bekend met ruimte voor ontdekking</span></button><button class="quick" id="b7Fresh"><b>⚡ Meer nieuw</b><span>Geef ontdekkingen tijdelijk voorrang</span></button></div>`;radio.insertBefore(forYou,radio.children[1]||null);
 const dj=document.createElement('article');dj.className='card mair-b7';dj.innerHTML=`<div class="kicker">MAIR DJ</div><h3>Wie presenteert?</h3><div id="b7Djs" class="chips"></div><label>DJ-wissel<select id="b7Rotation"><option value="30">Elke 30 minuten</option><option value="60">Elk uur</option><option value="120">Elke 2 uur</option></select></label><label class="switch"><input id="b7Context" type="checkbox"><span></span><b>Live Context gebruiken</b></label><p class="muted">Tijd, weer en locatie worden alleen gebruikt wanneer ze iets natuurlijks toevoegen aan de uitzending.</p>`;settings.insertBefore(dj,settings.firstChild);
 const req=document.createElement('div');req.className='mair-request-sheet hidden';req.id='b7RequestSheet';req.innerHTML=`<div class="mair-sheet-card"><div class="row between"><div><div class="kicker">VERZOEK</div><h3 id="b7ReqTitle">Toevoegen aan MAIR?</h3></div><button id="b7ReqClose" class="circle">×</button></div><p class="muted">Je verzoek krijgt voorrang in de programmering. De DJ kan het als verzoek aankondigen.</p><button id="b7ReqConfirm" class="cta">Zet in de uitzending</button></div>`;document.body.appendChild(req);
 renderDjs();$('b7Rotation').value=String(prefs.rotation);$('b7Context').checked=prefs.liveContext;
 $('b7Rotation').onchange=e=>{prefs.rotation=Number(e.target.value);save()};$('b7Context').onchange=e=>{prefs.liveContext=e.target.checked;save()};
 $('b7Comfort').onclick=()=>{prefs.personal=true;prefs.requestPriority='balanced';save();toast('Mijn mix actief')};$('b7Fresh').onclick=()=>{prefs.personal=true;prefs.requestPriority='discover';save();const d=$('discovery');if(d){d.value=Math.max(60,Number(d.value));d.dispatchEvent(new Event('input'));d.dispatchEvent(new Event('change'))}toast('Meer nieuwe muziek actief')};
 $('b7ReqClose').onclick=()=>req.classList.add('hidden');req.onclick=e=>{if(e.target===req)req.classList.add('hidden')};
 document.addEventListener('mair:request-preview',e=>openRequest(e.detail));
}
function renderDjs(){const box=$('b7Djs');if(!box)return;box.innerHTML=Object.entries(DJs).map(([id,[name,desc]])=>`<button class="chip ${prefs.dj===id?'active':''}" data-b7dj="${id}" title="${desc}">${name}</button>`).join('');box.querySelectorAll('[data-b7dj]').forEach(b=>b.onclick=()=>{prefs.dj=b.dataset.b7dj;save();renderDjs();toast(prefs.dj==='mix'?'DJ Mix actief':DJs[prefs.dj][0]+' is nu jouw DJ')})}
function openRequest(detail={}){const s=$('b7RequestSheet');if(!s)return;$('b7ReqTitle').textContent=detail.name?`${detail.name} aanvragen?`:'Nummer aanvragen?';s.classList.remove('hidden');$('b7ReqConfirm').onclick=()=>{s.classList.add('hidden');document.dispatchEvent(new CustomEvent('mair:request-confirmed',{detail}));toast('Verzoek staat klaar voor MAIR')}}
function toast(text){let t=$('b7Toast');if(!t){t=document.createElement('div');t.id='b7Toast';t.className='mair-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),1800)}
window.MAIR_BUILD7={getPrefs:()=>({...prefs}),setRequest:openRequest,DJs};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();