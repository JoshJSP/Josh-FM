(()=>{
'use strict';
if(window.MAIRProfile)return;
const $=id=>document.getElementById(id),PROFILE_KEY='mair_profile_v1',MODE_DATA_KEY='mair_mode_analytics_v1',DISC_KEY='jfm_discovered_tracks_v1',RECAP_PERIOD_KEY='mair_profile_recap_period_v1',DAY=86400000,PERIODS=new Set(['weekly','monthly','yearly']);
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:fallback}catch{return fallback}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensureCss(){if(document.getElementById('mairProfileCss'))return;const l=document.createElement('link');l.id='mairProfileCss';l.rel='stylesheet';l.href='./mair-profile.css?v=8';document.head.appendChild(l)}
function suite(){try{return window.JFMRadioSuite?.state?.()||read('jfm_radio_suite',{})}catch{return read('jfm_radio_suite',{})}}
function telemetry(){return read('jfm_top40_telemetry_v1',{})}
function modeAnalytics(){const d=read(MODE_DATA_KEY,{events:[]});return Array.isArray(d.events)?d.events:[]}
function discoveryHistory(){try{const v=JSON.parse(localStorage.getItem(DISC_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id):[]}catch{return[]}}
function selectedPeriod(){const p=String(localStorage.getItem(RECAP_PERIOD_KEY)||'weekly');return PERIODS.has(p)?p:'weekly'}
function savePeriod(period){if(!PERIODS.has(period))return;try{localStorage.setItem(RECAP_PERIOD_KEY,period)}catch{}}
function periodMeta(period){if(period==='monthly')return{title:'Month',copy:'deze maand'};if(period==='yearly')return{title:'Year',copy:'dit jaar'};return{title:'Week',copy:'deze week'}}
function periodStart(period='weekly',now=Date.now()){const d=new Date(now);if(period==='weekly'){const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day)}else if(period==='monthly'){d.setDate(1);d.setHours(0,0,0,0)}else{d.setMonth(0,1);d.setHours(0,0,0,0)}return d.getTime()}
function trackCounts(period='weekly'){const events=modeAnalytics(),tracks=events.filter(x=>x&&x.type==='track');if(!tracks.length)return null;const start=periodStart(period),now=Date.now();return{total:tracks.length,period:tracks.filter(x=>Number(x.at)>=start&&Number(x.at)<=now).length}}
function periodDiscoveryCount(period='weekly'){const start=periodStart(period),now=Date.now();return discoveryHistory().filter(x=>Number(x.at)>=start&&Number(x.at)<=now).length}
function profile(){return{displayName:'Josh Kramer',role:'MAIR-Ontwikkelaar',tagline:'Jij bouwt. Jij luistert. Jij bepaalt.',...read(PROFILE_KEY,{})}}
function saveProfile(next){const p={...profile(),...next};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p))}catch{}return p}
function duration(minutes){const t=Math.max(0,Math.round(Number(minutes)||0)),h=Math.floor(t/60),m=t%60;return h?`${h}u ${m}m`:`${m}m`}
function score(e={}){return Number(e.listenMs||0)/60000+Number(e.completed||0)*4+Number(e.starts||0)*1.5+Number(e.likes||0)*5+Number(e.requests||0)*5}
function stamp(e={}){return Number(e.lastPlayedAt||e.lastSeenAt||e.updatedAt||e.lastAt||e.at||0)}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function titleArtistKey(e={}){const name=norm(e.name||e.title),artists=(e.artists||[e.artist]).filter(Boolean).map(norm).sort().join('|');return `${name}::${artists}`}
function favoriteData(){const entries=Object.values(telemetry()).filter(e=>e&&typeof e==='object');const artists=new Map();for(const e of entries){const s=score(e);for(const a of (e.artists||[]).map(String).filter(Boolean))artists.set(a,(artists.get(a)||0)+s)}const topArtists=[...artists.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);const seen=new Set(),recent=[];for(const e of [...entries].sort((a,b)=>(stamp(b)-stamp(a))||(score(b)-score(a)))){const key=titleArtistKey(e);if(!key||key==='::'||seen.has(key))continue;seen.add(key);recent.push(e);if(recent.length>=5)break}return{topArtists,recent}}
function dna(s={}){try{return window.MAIRMyMair?.radioDna?.(s)?.label||'Persoonlijke mix'}catch{return'Persoonlijke mix'}}
function recap(period='weekly'){try{return window.MAIRModeManager?.recap?.(period)||{}}catch{return{}}}
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
function metric(value,label){return `<div style="background:#0d0d10;border:1px solid #23242a;border-radius:16px;padding:14px 12px;min-width:0"><div style="color:#fff;font-size:22px;font-weight:900;line-height:1.05;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</div><div style="margin-top:7px;color:#8f9099;font-size:11px;line-height:1.2">${esc(label)}</div></div>`}
function periodButton(period,label,current){const active=period===current;return `<button type="button" data-profile-period="${period}" style="appearance:none;border:1px solid ${active?'#a64b13':'#303037'};background:${active?'#2a160a':'#101012'};color:${active?'#ff7a12':'#92939c'};border-radius:999px;padding:6px 9px;font:inherit;font-size:9px;font-weight:900;letter-spacing:.04em;cursor:pointer">${label}</button>`}
function wipePersonalStorage(storage){const preserve=new Set([PROFILE_KEY,'jfm_discovery']);const exact=new Set(['jfm_radio_suite',DISC_KEY,MODE_DATA_KEY,'jfm_top40_telemetry_v1','jfm_top40_snapshot_v1','jfm_taste_model_v4','jfm_director_memory','jfm_skips','jfm_hit_battle_v1','jfm_requests_v1','jfm_played_request_v1','jfm_dj_feedback','jfm_discovery_diag_v6',RECAP_PERIOD_KEY,'mair_profile_roast_round_v1']);const personal=/(telemetry|analytics|taste|memory|skip|top40|hit_battle|discover|request|feedback|recap|roast|history|recent|favorite|favourite|like|ban|learn)/i;for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(!key||preserve.has(key))continue;if(exact.has(key)||personal.test(key))storage.removeItem(key)}}
function resetListeningProfile(){try{window.JFMTop40?.clear?.()}catch{}try{window.JFMTasteModel?.reset?.()}catch{}try{window.JFMRadioSuite?.resetDiscoveries?.()}catch{}try{wipePersonalStorage(localStorage);wipePersonalStorage(sessionStorage)}catch{}try{const s=window.JFMRadioSuite?.state?.();if(s){Object.assign(s,{minutes:0,tracks:0,discoveries:0,requests:0,likes:0,dislikes:0,lastIds:[],lastArtists:[],startedAt:Date.now()});window.JFMRadioSuite?.save?.(s)}}catch{}try{for(const key of [MODE_DATA_KEY,'jfm_top40_telemetry_v1','jfm_top40_snapshot_v1','jfm_director_memory','jfm_skips','jfm_hit_battle_v1','jfm_requests_v1','jfm_played_request_v1','jfm_taste_model_v4',DISC_KEY,RECAP_PERIOD_KEY,'mair_profile_roast_round_v1'])localStorage.removeItem(key)}catch{}try{window.dispatchEvent(new CustomEvent('mair:profile-reset',{detail:{at:Date.now()}}))}catch{}setTimeout(()=>location.reload(),120);return true}
function render(){ensureCss();const pane=$('tab-settings');if(!pane)return null;pane.classList.add('mair-profile-tab');$('mairfmSettingsShortcut')?.remove();let page=$('mairProfilePage');if(!page){page=document.createElement('div');page.id='mairProfilePage';pane.appendChild(page)}const p=profile(),s=suite(),f=favoriteData(),period=selectedPeriod(),meta=periodMeta(period),w=recap(period),periodDiscoveries=periodDiscoveryCount(period),counts=trackCounts(period),minutes=Number(s.minutes||0),totalTracks=counts?counts.total:Number(s.tracks||0),periodTracks=counts?counts.period:Number(w.tracks||0);const favArtists=f.topArtists.length?f.topArtists.join(', '):'Nog in opbouw';const favoritePeriod='Wordt geleerd door MAIRFM';const mood=dna(s);const recapMinutes=Number(w.minutes||0),recapTitle=recapMinutes?`${duration(recapMinutes)} ${meta.copy}`:`Je ${meta.title.toLowerCase()} is in opbouw`;page.innerHTML=`
<div class="mair-profile-top"><h1>Mijn profiel</h1></div>
<section class="mair-profile-card mair-profile-hero">
  <div class="mair-profile-person"><div><div class="mair-profile-name">${esc(p.displayName)}</div><div class="mair-profile-role">${esc(p.role)} <span class="mair-profile-role-badge">♛</span></div><div class="mair-profile-tagline">${esc(p.tagline)}</div></div><button class="mair-profile-edit" id="mairProfileEdit" type="button" aria-label="Profiel bewerken">✎</button></div>
</section>
<section class="mair-profile-card">
  <div class="mair-profile-section-title"><i>◉</i><span><b>Jouw cijfers</b><small>Jouw luistergedrag op MAIR</small></span></div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${metric(duration(minutes),'Luistertijd')}${metric(totalTracks,'Nummers gehoord')}${metric(Number(s.likes||0),'Favorieten')}${metric(Number(s.discoveries||0),'Ontdekkingen')}</div>
</section>
<section class="mair-profile-card mair-profile-week">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:13px"><div class="mair-profile-section-title" style="margin-bottom:0;min-width:0"><i>◫</i><span><b>Your ${meta.title} on MAIR</b><small>${esc(recapTitle)}</small></span></div><div style="display:flex;gap:4px;flex-shrink:0">${periodButton('weekly','WEEK',period)}${periodButton('monthly','MONTH',period)}${periodButton('yearly','YEAR',period)}</div></div>
  <div class="mair-profile-week-grid"><div><span>TOP ARTIST</span><b>${esc(w.topArtist||'Nog in opbouw')}</b></div><div><span>JOUW NUMMER</span><b>${esc(w.topTrack||'Nog in opbouw')}</b></div><div><span>TRACKS</span><b>${periodTracks}</b></div><div><span>ONTDEKKINGEN</span><b>${periodDiscoveries}</b></div></div>${w.insight?`<p class="mair-profile-week-insight">${esc(w.insight)}</p>`:''}
</section>
<section class="mair-profile-card"><div class="mair-profile-section-title"><i>☷</i><span><b>Persoonlijke voorkeuren</b><small>Jouw muziek, jouw MAIR</small></span></div><div class="mair-profile-list">${row('♫','Favoriete artiesten',favArtists)}${row('◷','Favoriete periodes',favoritePeriod)}${row('☆','Radio-DNA',mood)}${row('＋','Ontdekkingsniveau',`${Number(s.discoveries||0)} ontdekkingen`)}</div></section>
<section class="mair-profile-card"><div class="mair-profile-section-title"><i>⌁</i><span><b>Recente activiteit</b><small>Onlangs geluisterd</small></span></div>${f.recent.length?`<div class="mair-profile-activity">${f.recent.map(recentHtml).join('')}</div>`:'<div class="mair-profile-empty">Luister verder om hier je recente muziek te zien.</div>'}</section>
<section class="mair-profile-card mair-profile-account"><div class="mair-profile-section-title"><i>●</i><span><b>App & account</b><small>Spotify, privacy en ondersteuning</small></span></div><div class="mair-profile-list">${row('◉','Spotify',spotifyConnected()?'Gekoppeld aan MAIRFM':'Niet gekoppeld')}${row('⌁','Privacy','Luisterdata blijft lokaal op dit apparaat')}${row('◷','Versie',releaseLine())}${row('⇧','Backup exporteren','Bewaar je MAIR-gegevens als bestand','backupExport')}${row('⇩','Backup importeren','Zet een eerder bewaard bestand terug','backupImport')}${row('◇','Geavanceerd & diagnostiek','Technische status, tests en herstel','diagnostics')}${row('↺','Alles resetten','Wis alle MAIR-luisterdata en begin opnieuw','resetProfile')}${row('↪','Spotify ontkoppelen','Verbreek de huidige Spotify-sessie','logout')}</div></section>
<div class="mair-profile-footer-note">MAIRFM · Jouw muziek. Als echte radio.</div>`;
$('mairProfileEdit')?.addEventListener('click',()=>{const name=prompt('Naam op je MAIR-profiel',p.displayName);if(name&&name.trim()){saveProfile({displayName:name.trim()});render()}});
page.querySelectorAll('[data-profile-period]').forEach(btn=>btn.addEventListener('click',()=>{savePeriod(btn.dataset.profilePeriod);render()}));
const reset=page.querySelector('[data-profile-action="resetProfile"]');const doReset=()=>{if(!confirm('Alles opnieuw beginnen? Dit wist je luistertijd, nummers, favorieten, ontdekkingen, recente activiteit, recaps, requests, skips en aangeleerde muzieksmaak. Je Spotify-koppeling en profielnaam blijven behouden.'))return;resetListeningProfile()};reset?.addEventListener('click',doReset);reset?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doReset()}});
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
const logout=page.querySelector('[data-profile-action="logout"]');const doLogout=()=>{$('logout')?.click()};logout?.addEventListener('click',doLogout);logout?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doLogout()}});return page}
function syncNav(){const btn=document.querySelector('.mair-bottom-nav [data-mair-tab="settings"]');if(btn)btn.setAttribute('aria-label','Profiel');$('mairfmSettingsShortcut')?.remove()}
function boot(){render();syncNav();window.addEventListener('pageshow',()=>{render();syncNav()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});for(const e of ['jfm:trackchange','mair:taste-feedback','mair:request-confirmed','mair:station-selected','mair:mode-analytics','mair:discovery-counted','mair:discoveries-reset','mair:profile-reset','jfm:release-status'])window.addEventListener(e,()=>setTimeout(render,120));setInterval(()=>{if($('tab-settings')?.classList.contains('active'))render()},15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRProfile={version:'mair-profile-v12-no-listening-goal',render,profile,saveProfile,selectedPeriod,resetListeningProfile,spotifyConnected};
})();
