(()=>{
'use strict';
if(window.MAIRProfile)return;
const $=id=>document.getElementById(id),PROFILE_KEY='mair_profile_v1',MODE_DATA_KEY='mair_mode_analytics_v1',DISC_KEY='jfm_discovered_tracks_v1',DAY=86400000;
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:fallback}catch{return fallback}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensureCss(){if(document.getElementById('mairProfileCss'))return;const l=document.createElement('link');l.id='mairProfileCss';l.rel='stylesheet';l.href='./mair-profile.css?v=9';document.head.appendChild(l)}
function suite(){try{return window.JFMRadioSuite?.state?.()||read('jfm_radio_suite',{})}catch{return read('jfm_radio_suite',{})}}
function telemetry(){return read('jfm_top40_telemetry_v1',{})}
function modeAnalytics(){const d=read(MODE_DATA_KEY,{events:[]});return Array.isArray(d.events)?d.events:[]}
function discoveryHistory(){try{const v=JSON.parse(localStorage.getItem(DISC_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id):[]}catch{return[]}}
// Alleen de week bestaat nog; Month en Year zijn uit het product gehaald.
function periodStart(now=Date.now()){const d=new Date(now),day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d.getTime()}
function trackCounts(){const events=modeAnalytics(),tracks=events.filter(x=>x&&x.type==='track');if(!tracks.length)return null;const start=periodStart(),now=Date.now();return{total:tracks.length,period:tracks.filter(x=>Number(x.at)>=start&&Number(x.at)<=now).length}}
function profile(){return{displayName:'Josh Kramer',role:'MAIR-Ontwikkelaar',tagline:'Jij bouwt. Jij luistert. Jij bepaalt.',...read(PROFILE_KEY,{})}}
function saveProfile(next){const p={...profile(),...next};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p))}catch{/* opslag geblokkeerd: dan zonder opslag */}return p}
function duration(minutes){const t=Math.max(0,Math.round(Number(minutes)||0)),h=Math.floor(t/60),m=t%60;return h?`${h}u ${m}m`:`${m}m`}
function score(e={}){return Number(e.listenMs||0)/60000+Number(e.completed||0)*4+Number(e.starts||0)*1.5+Number(e.likes||0)*5+Number(e.requests||0)*5}
function stamp(e={}){return Number(e.lastPlayedAt||e.lastSeenAt||e.updatedAt||e.lastAt||e.at||0)}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function titleArtistKey(e={}){const name=norm(e.name||e.title),artists=(e.artists||[e.artist]).filter(Boolean).map(norm).sort().join('|');return `${name}::${artists}`}
function favoriteData(){const entries=Object.values(telemetry()).filter(e=>e&&typeof e==='object');const artists=new Map();for(const e of entries){const s=score(e);for(const a of (e.artists||[]).map(String).filter(Boolean))artists.set(a,(artists.get(a)||0)+s)}const topArtists=[...artists.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);const seen=new Set(),recent=[];for(const e of [...entries].sort((a,b)=>(stamp(b)-stamp(a))||(score(b)-score(a)))){const key=titleArtistKey(e);if(!key||key==='::'||seen.has(key))continue;seen.add(key);recent.push(e);if(recent.length>=5)break}return{topArtists,recent}}
function dna(s={}){try{return window.MAIRMyMair?.radioDna?.(s)?.label||'Persoonlijke mix'}catch{return'Persoonlijke mix'}}
function spotifyConnected(){try{const state=window.JFMAuth?.state;if(state&&typeof state==='object')return!!(state.hasRefreshToken||state.hasAccessToken);return!!(localStorage.getItem('jfm_refresh')||localStorage.getItem('jfm_token'))}catch{return false}}
function recentHtml(track){const name=track?.name||track?.title||'MAIR track',artist=(track?.artists||[track?.artist]).filter(Boolean).join(', ')||'MAIR';const image=track?.image||track?.imageUrl||track?.albumImage||'';return `<div class="mair-profile-track"><div class="mair-profile-cover">${image?`<img src="${esc(image)}" alt="">`:esc(name.slice(0,2).toUpperCase())}</div><b>${esc(name)}</b><small>${esc(artist)}</small></div>`}
// De Instellingen-tab wordt volledig door deze pagina afgedekt: mair-profile.css
// heeft .mair-profile-tab>:not(#mairProfilePage){display:none!important}. Alles wat
// andere modules in die tab hangen is dus onzichtbaar, inclusief de versionbox uit
// index.html. Wat Josh moet kunnen zien hoort daarom hier te staan.
function releaseLine(){
  const r=window.JFM_RELEASE||{};
  const version=String(r.displayVersion||r.version||'onbekend');
  const build=String(r.build||'onbekend');
  return `v${version} · build ${build}`
}
function row(icon,title,copy,action=''){return `<div class="mair-profile-row${action?' mair-profile-row-action':''}"${action?` data-profile-action="${action}" role="button" tabindex="0"`:''}><span class="mair-profile-row-icon">${icon}</span><span><b>${esc(title)}</b><small>${esc(copy)}</small></span>${action?'<em aria-hidden="true">›</em>':''}</div>`}
function metric(value,label){return `<div class="mair-profile-metric"><div class="mair-profile-metric-v">${esc(value)}</div><div class="mair-profile-metric-l">${esc(label)}</div></div>`}
function wipePersonalStorage(storage){const preserve=new Set([PROFILE_KEY,'jfm_discovery']);const exact=new Set(['jfm_radio_suite',DISC_KEY,MODE_DATA_KEY,'jfm_top40_telemetry_v1','jfm_top40_snapshot_v1','jfm_taste_model_v4','jfm_director_memory','jfm_skips','jfm_hit_battle_v1','jfm_requests_v1','jfm_played_request_v1','jfm_dj_feedback','jfm_discovery_diag_v6','mair_profile_recap_period_v1','mair_profile_roast_round_v1']);const personal=/(telemetry|analytics|taste|memory|skip|top40|hit_battle|discover|request|feedback|recap|roast|history|recent|favorite|favourite|like|ban|learn)/i;for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(!key||preserve.has(key))continue;if(exact.has(key)||personal.test(key))storage.removeItem(key)}}
function resetListeningProfile(){try{window.JFMTop40?.clear?.()}catch(e){window.MAIRRuntime?.caught?.('mair-profile.clear',e)}try{window.JFMTasteModel?.reset?.()}catch(e){window.MAIRRuntime?.caught?.('mair-profile.reset',e)}try{window.JFMRadioSuite?.resetDiscoveries?.()}catch(e){window.MAIRRuntime?.caught?.('mair-profile.resetDiscoveries',e)}try{wipePersonalStorage(localStorage);wipePersonalStorage(sessionStorage)}catch{/* opslag geblokkeerd: dan zonder opslag */}try{const s=window.JFMRadioSuite?.state?.();if(s){Object.assign(s,{minutes:0,tracks:0,discoveries:0,requests:0,likes:0,dislikes:0,lastIds:[],lastArtists:[],startedAt:Date.now()});window.JFMRadioSuite?.save?.(s)}}catch(e){window.MAIRRuntime?.caught?.('mair-profile.state',e)}try{for(const key of [MODE_DATA_KEY,'jfm_top40_telemetry_v1','jfm_top40_snapshot_v1','jfm_director_memory','jfm_skips','jfm_hit_battle_v1','jfm_requests_v1','jfm_played_request_v1','jfm_taste_model_v4',DISC_KEY,'mair_profile_recap_period_v1','mair_profile_roast_round_v1'])localStorage.removeItem(key)}catch{/* opslag geblokkeerd: dan zonder opslag */}try{window.dispatchEvent(new CustomEvent('mair:profile-reset',{detail:{at:Date.now()}}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}setTimeout(()=>location.reload(),120);return true}
// Ritlijst: de laatste 10 Car Mode-ritten die rideEnd in mair_car_rides_v1 zet.
const RIDES_KEY='mair_car_rides_v1';
function rides(){try{const v=JSON.parse(localStorage.getItem(RIDES_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.at).slice(0,10):[]}catch{return[]}}
function rideDur(m){m=Math.max(0,Math.round(Number(m)||0));return m>=60?`${Math.floor(m/60)} u ${m%60} min`:`${m} min`}
function rideWhen(at){const d=new Date(Number(at));if(isNaN(d))return'';return d.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
function rideDiff(d){if(d==null||!isFinite(d))return'';d=Math.round(d);return d===0?'precies op tijd':d>0?`${d} min later`:`${-d} min sneller`}
function rideHtml(r){const km=Number(r.km);const bits=[rideDur(r.min),isFinite(km)&&km>0?km.toFixed(1).replace('.',',')+' km':'',rideDiff(r.diff)].filter(Boolean).join(' · ');return `<div class="mair-rides-row"><span class="mair-rides-icon">${r.arrived?'⚑':'◦'}</span><span><b>${esc(r.name||'Je rit')}</b><small>${esc(rideWhen(r.at))}</small></span><em>${esc(bits)}</em></div>`}
function ridesHtml(){const list=rides();return `<section class="mair-profile-card mair-rides"><div class="mair-profile-section-title"><i>⇢</i><span><b>Jouw ritten</b><small>De laatste 10 ritten in Car Mode</small></span></div>${list.length?`<div class="mair-profile-list">${list.map(rideHtml).join('')}</div>`:'<div class="mair-profile-empty">Nog geen ritten. Rij een keer met Car Mode, dan staat hij hier.</div>'}</section>`}
// Backup en Diagnostiek staan uit beeld: lang drukken op de versie laat ze zien of verbergt ze.
let hiddenOpen=false;
function bindLongPress(el){if(!el)return;let t=0;const stop=()=>{clearTimeout(t);t=0};el.addEventListener('pointerdown',()=>{stop();t=setTimeout(()=>{t=0;hiddenOpen=!hiddenOpen;const box=$('mairProfileHidden');if(box)box.hidden=!hiddenOpen;try{navigator.vibrate?.(15)}catch{/* geen trilling: niet erg */}},700)});for(const e of ['pointerup','pointerleave','pointercancel'])el.addEventListener(e,stop);el.addEventListener('contextmenu',e=>e.preventDefault())}
function render(){ensureCss();const pane=$('tab-settings');if(!pane)return null;pane.classList.add('mair-profile-tab');$('mairfmSettingsShortcut')?.remove();let page=$('mairProfilePage');if(!page){page=document.createElement('div');page.id='mairProfilePage';pane.appendChild(page)}const p=profile(),s=suite(),f=favoriteData(),counts=trackCounts(),minutes=Number(s.minutes||0),totalTracks=counts?counts.total:Number(s.tracks||0);const favArtists=f.topArtists.length?f.topArtists.join(', '):'Nog in opbouw';const favoritePeriod='Wordt geleerd door MAIRFM';const mood=dna(s);page.innerHTML=`
<div class="mair-profile-top"><h1>Mijn profiel</h1></div>
<section class="mair-profile-card mair-profile-hero">
  <div class="mair-profile-person"><div><div class="mair-profile-name">${esc(p.displayName)}</div><div class="mair-profile-role">${esc(p.role)} <span class="mair-profile-role-badge">♛</span></div><div class="mair-profile-tagline">${esc(p.tagline)}</div></div><button class="mair-profile-edit" id="mairProfileEdit" type="button" aria-label="Profiel bewerken">✎</button></div>
</section>
<section class="mair-profile-card">
  <div class="mair-profile-section-title"><i>◉</i><span><b>Jouw cijfers</b><small>Jouw luistergedrag op MAIR</small></span></div>
  <div class="mair-profile-metrics">${metric(duration(minutes),'Luistertijd')}${metric(totalTracks,'Nummers gehoord')}${metric(Number(s.likes||0),'Favorieten')}${metric(Number(s.discoveries||0),'Ontdekkingen')}</div>
</section>
${ridesHtml()}
<section class="mair-profile-card"><div class="mair-profile-section-title"><i>☷</i><span><b>Persoonlijke voorkeuren</b><small>Jouw muziek, jouw MAIR</small></span></div><div class="mair-profile-list">${row('♫','Favoriete artiesten',favArtists)}${row('◷','Favoriete periodes',favoritePeriod)}${row('☆','Radio-DNA',mood)}${row('＋','Ontdekkingsniveau',`${Number(s.discoveries||0)} ontdekkingen`)}</div></section>
<section class="mair-profile-card"><div class="mair-profile-section-title"><i>⌁</i><span><b>Recente activiteit</b><small>Onlangs geluisterd</small></span></div>${f.recent.length?`<div class="mair-profile-activity">${f.recent.map(recentHtml).join('')}</div>`:'<div class="mair-profile-empty">Luister verder om hier je recente muziek te zien.</div>'}</section>
<section class="mair-profile-card"><div class="mair-profile-section-title"><i>♪</i><span><b>Geluid &amp; DJ</b><small>Volume en de live DJ</small></span></div><div style="padding:2px 2px 12px"><div class="mair-profile-goal-head" style="margin-bottom:8px"><b>MAIR-volume</b><span id="volumeValue">100%</span></div><input id="volume" type="range" min="0" max="100" value="100" step="1" aria-label="MAIR-volume" style="width:100%"><small style="display:block;color:#8f9099;margin-top:6px">Los van de volumeknoppen van je telefoon.</small></div><div class="mair-profile-list"><div class="mair-profile-row mair-profile-row-action" data-mair-dj-toggle role="button" tabindex="0"><span class="mair-profile-row-icon">🎙️</span><span><b>Live DJ</b><small data-mair-dj-hint>Praat tussen de nummers door. Tik om hem op dit toestel uit te zetten.</small></span><em data-mair-dj-state aria-hidden="true">UIT</em></div></div></section><div class="mair-profile-version" id="mairProfileVersion">Versie ${esc(releaseLine())}</div><div class="mair-profile-list mair-profile-hidden" id="mairProfileHidden"${hiddenOpen?'':' hidden'}>${row('⇧','Backup exporteren','Bewaar je MAIR-gegevens als bestand','backupExport')}${row('⇩','Backup importeren','Zet een eerder bewaard bestand terug','backupImport')}${row('◇','Geavanceerd & diagnostiek','Technische status, tests en herstel','diagnostics')}</div><details class="mair-profile-more"><summary>Beheer</summary><div class="mair-profile-list">${row('↺','Alles resetten','Wis alle MAIR-luisterdata en begin opnieuw','resetProfile')}${row('↪','Spotify ontkoppelen','Verbreek de huidige Spotify-sessie','logout')}</div></details>
<div class="mair-profile-footer-note">MAIRFM · Jouw muziek. Als echte radio.</div>`;
bindLongPress($('mairProfileVersion'));
$('mairProfileEdit')?.addEventListener('click',()=>{const name=prompt('Naam op je MAIR-profiel',p.displayName);if(name&&name.trim()){saveProfile({displayName:name.trim()});render()}});

const reset=page.querySelector('[data-profile-action="resetProfile"]');const doReset=()=>{if(!confirm('Alles opnieuw beginnen? Dit wist je luistertijd, nummers, favorieten, ontdekkingen, recente activiteit, recaps, requests, skips en aangeleerde muzieksmaak. Je Spotify-koppeling en profielnaam blijven behouden.'))return;resetListeningProfile()};reset?.addEventListener('click',doReset);reset?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doReset()}});
try{window.JFMPlayback?.bindVolume?.()}catch(e){window.MAIRRuntime?.caught?.('mair-profile.bindVolume',e)}try{window.MAIRDiagnosticsHub?.paintDjSwitch?.()}catch{/* optionele UI/DOM-hook niet beschikbaar: onschuldig */}
  page.querySelector('[data-mair-dj-toggle]')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click()}});
  const diagnostics=page.querySelector('[data-profile-action="diagnostics"]');const openDiagnostics=()=>{if(window.MAIRDiagnosticsHub?.open)window.MAIRDiagnosticsHub.open();else window.dispatchEvent(new Event('mair:diagnostics-open'))};diagnostics?.addEventListener('click',openDiagnostics);diagnostics?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDiagnostics()}});
const exportRow=page.querySelector('[data-profile-action="backupExport"]');
const doExport=()=>{if(typeof window.JFMDataPortability?.download!=='function'){alert('Backup is nog aan het laden. Probeer het over een paar seconden opnieuw.');return}try{window.JFMDataPortability.download()}catch(e){alert('Backup maken lukte niet: '+(e?.message||e))}};
exportRow?.addEventListener('click',doExport);exportRow?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doExport()}});
const importRow=page.querySelector('[data-profile-action="backupImport"]');
const doImport=()=>{
  let input=document.getElementById('mairProfileImportFile');
  if(!input){input=document.createElement('input');input.type='file';input.id='mairProfileImportFile';input.accept='application/json,.json';input.hidden=true;document.body.appendChild(input);
    input.addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
      try{await window.JFMDataPortability?.importFile?.(file);alert('Backup hersteld. MAIRFM wordt opnieuw geladen.');setTimeout(()=>location.reload(),400)}
      catch(err){alert('Import mislukt: '+(err?.message||err))}})}
  if(typeof window.JFMDataPortability?.importFile!=='function'){alert('Backup is nog aan het laden. Probeer het over een paar seconden opnieuw.');return}
  input.click()
};
importRow?.addEventListener('click',doImport);importRow?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doImport()}});
const logout=page.querySelector('[data-profile-action="logout"]');const doLogout=()=>{$('logout')?.click()};logout?.addEventListener('click',doLogout);logout?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doLogout()}});/* Discovery-kaart meteen terugzetten, anders knippert hij weg tot de volgende refresh (Josh 25-11-2026) */window.MAIRProfileDiscoveryBridge?.install?.();return page}
function syncNav(){const btn=document.querySelector('.mair-bottom-nav [data-mair-tab="settings"]');if(btn)btn.setAttribute('aria-label','Profiel');$('mairfmSettingsShortcut')?.remove()}
function boot(){render();syncNav();window.addEventListener('pageshow',()=>{render();syncNav()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});for(const e of ['jfm:trackchange','mair:taste-feedback','mair:request-confirmed','mair:station-selected','mair:mode-analytics','mair:discovery-counted','mair:discoveries-reset','mair:profile-reset','jfm:release-status','mair:car-ride-end'])window.addEventListener(e,()=>setTimeout(render,120));setInterval(()=>{if(!$('tab-settings')?.classList.contains('active'))return;/* niet opnieuw opbouwen onder een slider of veld waar de gebruiker mee bezig is */const f=document.activeElement;if(f&&$('mairProfilePage')?.contains(f)&&/^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName))return;render()},15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRProfile={version:'mair-profile-v14-rides',render,rides,profile,saveProfile,resetListeningProfile,spotifyConnected};
})();
