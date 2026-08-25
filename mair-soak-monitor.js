// MAIR Soak Monitor — passive long-session health observation without touching playback.
(()=>{
'use strict';
if(window.MAIRSoakMonitor)return;
const $=id=>document.getElementById(id),KEY='mair_soak_session_v1';let lastPlayed=0,lastMissed=0;
function blank(){return{active:false,completed:false,startedAt:0,targetAt:0,stoppedAt:0,trackChanges:0,lastTrackAt:0,maxTrackGapMs:0,djPlayed:0,djMissed:0,reloadRepairs:0,errors:[],events:0}}
function load(){try{return{...blank(),...JSON.parse(sessionStorage.getItem(KEY)||'{}')}}catch{return blank()}}
let state=load();
function save(){try{sessionStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function addError(source,error){if(!state.active||!error)return;state.errors.unshift({at:Date.now(),source,error:String(error).slice(0,220)});state.errors=state.errors.slice(0,30);state.events++;save();render()}
function maybeComplete(){if(state.active&&state.targetAt&&Date.now()>=state.targetAt){state.active=false;state.completed=true;state.stoppedAt=Date.now();save();render();emit()}}
function onTrack(){if(!state.active)return;const now=Date.now();if(state.lastTrackAt){const gap=now-state.lastTrackAt;state.maxTrackGapMs=Math.max(state.maxTrackGapMs,gap)}state.lastTrackAt=now;state.trackChanges++;state.events++;save();render();maybeComplete()}
function onDJ(e){const d=e?.detail||{};if(!state.active){lastPlayed=Number(d.played||lastPlayed);lastMissed=Number(d.missed||lastMissed);return}const p=Number(d.played||0),m=Number(d.missed||0);if(p>lastPlayed)state.djPlayed+=p-lastPlayed;if(m>lastMissed)state.djMissed+=m-lastMissed;lastPlayed=p;lastMissed=m;if(d.error)addError('dj',d.error);state.events++;save();render();maybeComplete()}
function onReload(e){if(!state.active)return;const d=e?.detail||{};if(d.status==='repaired')state.reloadRepairs++;if(d.status==='error')addError('reload',d.error||d.reason||'reload error');state.events++;save();render();maybeComplete()}
function start(minutes=60){state=blank();state.active=true;state.startedAt=Date.now();state.targetAt=state.startedAt+Math.max(1,Number(minutes)||60)*60000;const d=window.MAIRDJ?.diagnostics?.()||{};lastPlayed=Number(d.played||0);lastMissed=Number(d.missed||0);save();render();emit();return summary()}
function stop(){if(state.active){state.active=false;state.stoppedAt=Date.now();save();render();emit()}return summary()}
function reset(){state=blank();save();render();emit()}
function summary(){const end=state.active?Date.now():(state.stoppedAt||Date.now()),elapsed=Math.max(0,end-(state.startedAt||end)),minutes=elapsed/60000,score=Math.max(0,100-state.djMissed*8-state.errors.length*10-Math.max(0,state.reloadRepairs-2)*2);return{...state,elapsedMs:elapsed,elapsedMinutes:Number(minutes.toFixed(1)),score}}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:soak',{detail:summary()}))}catch{}}
function install(){if($('mairSoakCard'))return;const pane=$('tab-settings');if(!pane)return;const c=document.createElement('article');c.id='mairSoakCard';c.className='card';c.innerHTML='<div class="kicker">60+ MINUTEN SOAK TEST</div><h3>Lange-duurmonitor</h3><p class="muted">Observeert passief echte trackwissels, DJ-breaks, reload-herstel en fouten. De monitor bestuurt Spotify niet.</p><div class="grid2"><button id="mairSoakStart" class="secondary" type="button">Start 60 min</button><button id="mairSoakStop" class="secondary" type="button">Stop</button></div><p id="mairSoakStatus" class="muted" style="margin-top:10px"></p>';const version=pane.querySelector('.versionbox');pane.insertBefore(c,version||null);$('mairSoakStart').onclick=()=>start(60);$('mairSoakStop').onclick=()=>stop();render()}
function render(){const p=$('mairSoakStatus');if(!p)return;const s=summary();p.textContent=s.active?`LIVE · ${s.elapsedMinutes} min · ${s.trackChanges} trackwissels · DJ ${s.djPlayed}/${s.djMissed} · fouten ${s.errors.length}`:s.startedAt?`${s.completed?'VOLTOOID':'GESTOPT'} · ${s.elapsedMinutes} min · score ${s.score}/100 · ${s.trackChanges} trackwissels · fouten ${s.errors.length}`:'Nog niet gestart.'}
function boot(){install();window.addEventListener('jfm:trackchange',onTrack);window.addEventListener('mair:dj-v2-state',onDJ);window.addEventListener('mair:reload-audibility',onReload);window.addEventListener('error',e=>addError('window',e.message||'window error'));setInterval(maybeComplete,15000);setInterval(render,5000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRSoakMonitor={version:'mair-soak-monitor-v1',start,stop,reset,summary};
})();
