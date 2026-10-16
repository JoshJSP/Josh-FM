// MAIR Sleep v2 (ontwerp 3, "Zachte fade"): slaaptimer met een zacht zakkend volume, een keuze van 1 tot 10 minuten
// uitfaden en een optionele welterusten van de DJ. Neemt geen playback over: pauzeren, volume en stem lopen via
// JFMPlayback (playback-primary.js) en de MAIR Voice Engine.
(()=>{
'use strict';
if(window.MAIRSleep)return;
const KEY='jfm_sleep_timer_v1',PREF_KEY='jfm_sleep_prefs_v1',FADE_KEY='jfm_sleep_fade_v1';
const GRACE_MS=10*60*1000,RETRY_MS=10000,SHORT_FADE_MS=8000,LATE_MS=20000,GOODNIGHT_LEAD_MS=120000,GOODNIGHT_BEFORE_MS=8000;
const MINUTE_OPTIONS=[15,30,45,60],FADE_OPTIONS=[1,2,5,10];
const GOODNIGHT_LINES=['Het is bijna tijd om te slapen. Ik zet de muziek zachter. Welterusten, tot morgen op MAIR.','Welterusten. Ik laat de muziek zacht uitlopen. Slaap lekker.','Dit was het voor vandaag. Het volume zakt nu langzaam. Welterusten van MAIR.'];
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
let state=read(),prefs=readPrefs(),tickTimer=0,lastStopTry=0,stopBusy=false,lastError='',lastStoppedAt=0,open=false,graphKey='';
// Fade-status. 'fade' bestaat zolang het volume daalt; de voortgang volgt altijd de klok, dus een bevroren pagina haalt
// na het wakker worden gewoon de goede stand in (en bij te laat komen een korte fade in plaats van een sprong).
let fade=null,fadeDone=false,fadeAborted=false,fadeBusy=false;
let gn={phase:'idle',result:'',busy:false,boundary:false,text:'',prep:null,gen:0},gnGen=0;

function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(!x||typeof x!=='object')return null;/* Een timer die net is verlopen terwijl de pagina bevroren was (iOS, bfcache) moet alsnog stoppen: de tick voert hem uit. Veel later verlopen = oude restant, niet meer pauzeren. */if(x.mode==='time'&&Number(x.at||0)>Date.now()-GRACE_MS)return x;if(x.mode==='after-track'&&x.trackId)return x}catch{/* opslag geblokkeerd: dan zonder opslag */}return null}
function readPrefs(){try{const x=JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{};return{minutes:MINUTE_OPTIONS.includes(Number(x.minutes))?Number(x.minutes):30,fadeMin:FADE_OPTIONS.includes(Number(x.fadeMin))?Number(x.fadeMin):5,dj:x.dj!==false}}catch{return{minutes:30,fadeMin:5,dj:true}}}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs))}catch{/* opslag geblokkeerd: dan zonder opslag */}}
function save(v){state=v;try{localStorage.setItem(KEY,JSON.stringify(v))}catch{/* opslag geblokkeerd: dan zonder opslag */}emit();render()}
function clear(){state=null;fade=null;fadeDone=false;fadeAborted=false;goodnightReset();try{localStorage.setItem(KEY,'null')}catch{/* opslag geblokkeerd: dan zonder opslag */}emit();render()}
function playback(){return window.JFMPlaybackState?.get?.()||null}
function pb(){return window.JFMPlayback||null}
function track(){const p=playback()||{};return{trackId:String(p.trackId||''),uri:String(p.uri||''),title:String($('title')?.textContent||'MAIR'),artist:String($('artist')?.textContent||'')}}
function remainingMs(){return state?.mode==='time'?Math.max(0,Number(state.at||0)-Date.now()):0}
function fmt(ms){const total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),s=total%60;return`${m}:${String(s).padStart(2,'0')}`}
function clock(ms){return new Date(ms).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
function fadeMsOf(s){return s?.mode==='time'?Math.max(0,Math.min(Number(s.fadeMs)||0,Math.max(0,Number(s.at||0)-Number(s.createdAt||0)))):0}
function status(){return{version:'mair-sleep-v2.0',active:!!state,mode:state?.mode||'',endsAt:state?.mode==='time'?Number(state.at||0):0,remainingMs:remainingMs(),trackId:state?.trackId||'',open,lastError,lastStoppedAt,fadeMs:fadeMsOf(state),fadeStartsAt:state?.mode==='time'?Number(state.at||0)-fadeMsOf(state):0,fading:!!fade&&!fade.finished,fadeDone,fadeAborted,level:fade?fade.last:null,goodnight:{enabled:state?.dj===true,phase:gn.phase,result:gn.result},prefs:{...prefs}}}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:sleep',{detail:status()}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}}

// ---------- fade ----------
const ease=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)};
function levelFlag(on,base){try{if(on)localStorage.setItem(FADE_KEY,JSON.stringify({base,at:Date.now()}));else localStorage.removeItem(FADE_KEY)}catch{/* opslag geblokkeerd: dan zonder opslag */}}
function hasLevelFlag(){try{return !!localStorage.getItem(FADE_KEY)}catch{return false}}
function startFade(now,fs,due){
  const p=pb();if(typeof p?.fadeTo!=='function')return false;
  const base=Number(p.volume);const listener=Number.isFinite(base)?base:1;
  const long=!fadeAborted&&fadeMsOf(state)>0&&now<due;
  if(long){
    const late=now-fs>LATE_MS;
    // Op tijd: de curve loopt vanaf fs. Te laat (scherm uit, pagina bevroren): vanaf nu naar het stopmoment, minstens een korte fade.
    fade={t0:late?now:fs,t1:late?Math.max(due,now+SHORT_FADE_MS):due,from:late?Math.max(0,Math.min(1,Number(p.appliedVolume)||listener)):listener,last:late?Math.max(0,Math.min(1,Number(p.appliedVolume)||listener)):listener,lastAt:0,cal:null,bad:0,finished:false,kind:late?'late':'long'};
  }else fade={t0:now,t1:now+SHORT_FADE_MS,from:Math.max(0,Math.min(1,Number(p.appliedVolume)||listener)),last:Math.max(0,Math.min(1,Number(p.appliedVolume)||listener)),lastAt:0,cal:null,bad:0,finished:false,kind:'short'};
  levelFlag(true,listener);emit();return true
}
function stepMs(f){const dur=f.t1-f.t0;return dur<=20000?500:Math.max(2000,Math.min(7000,dur/90))}
async function driveFade(now){
  const f=fade,p=pb();if(!f||f.finished||fadeBusy||gn.busy||stopBusy||!p)return;
  const prog=(now-f.t0)/Math.max(1,f.t1-f.t0),done=prog>=1;
  if(!done&&now-f.lastAt<stepMs(f))return;
  const level=done?0:f.from*(1-ease(prog));
  if(!done&&Math.abs(level-f.last)<.01)return;
  fadeBusy=true;f.lastAt=now;
  try{
    // Heeft iemand anders het volume verzet (Spotify Connect, een tweede venster)? Dan stopt de fade en komt het volume terug.
    if(f.cal===true){const cur=await p.readVolume?.();if(fade!==f)return;if(typeof cur==='number'&&Math.abs(cur-f.last)>.06){if(++f.bad>=2){overrideFade('extern');return}}else f.bad=0}
    const ok=await p.fadeTo(level,{smooth:Math.abs(level-f.last)>.15&&!done});
    if(fade!==f)return;
    if(ok){f.last=level;if(f.cal===null){const cur=await p.readVolume?.();f.cal=typeof cur==='number'?Math.abs(cur-level)<.03:false}}
    if(done){f.finished=true;fadeDone=true}
    emit()
  }catch(e){window.MAIRRuntime?.caught?.('mair-sleep.fade',e);if(done&&fade===f){f.finished=true;fadeDone=true}}
  finally{fadeBusy=false}
}
async function restoreLevel(smooth=true){
  // Eerst laten uitlopen wat nog onderweg is, anders landt een late fade-stap na het herstel.
  for(let i=0;i<30&&fadeBusy;i++)await wait(50);
  const p=pb();if(typeof p?.restoreVolume!=='function')return false;
  for(let i=0;i<3;i++){let ok=false;try{ok=await p.restoreVolume({smooth:smooth&&i===0})}catch(e){window.MAIRRuntime?.caught?.('mair-sleep.restoreVolume',e)}if(ok){levelFlag(false);return true}await wait(500)}
  return false
}
function overrideFade(reason){
  if(!fade||fade.finished)return false;
  fade=null;fadeAborted=true;lastError='';
  try{window.MAIRRuntime?.record?.('sleep.fade-override',{reason},'info')}catch{/* logboek niet beschikbaar: onschuldig */}
  restoreLevel(true).catch(()=>{});emit();render();return true
}
function ensureFade(now,due){
  if(fade||fadeDone||gn.busy||stopBusy)return;
  const fs=due-fadeMsOf(state);
  if(fadeMsOf(state)>0&&!fadeAborted&&now>=fs&&now<due)startFade(now,fs,due);
  else if(now>=due)startFade(now,fs,due);
}

// ---------- welterusten van de DJ ----------
function goodnightReset(){gnGen++;const wasBusy=gn.busy;gn={phase:'idle',result:'',busy:false,boundary:false,text:'',prep:null,gen:gnGen};if(wasBusy)try{window.MAIRVoiceEngine?.cancel?.('sleep-cancel',`sleep-goodnight-${gnGen-1}`)}catch{/* stem annuleren mislukt: onschuldig */}}
function planGoodnight(now,due){
  if(gn.phase==='done'||gn.phase==='busy'||state?.dj!==true||fadeMsOf(state)<=0||fade||fadeDone)return;
  const fs=due-fadeMsOf(state);
  if(now<fs-GOODNIGHT_LEAD_MS)return;
  if(now>fs+GOODNIGHT_BEFORE_MS*2){gn.phase='done';gn.result='skipped-late';return}
  if(gn.phase==='idle'){
    gn.phase='armed';gn.text=GOODNIGHT_LINES[Math.floor(Math.random()*GOODNIGHT_LINES.length)];const gen=gn.gen;
    gn.prep=(async()=>{try{if(document.visibilityState==='hidden'||typeof window.prepareSpeech!=='function')return false;return !!(await window.prepareSpeech(gn.text,false,{breakId:`sleep-goodnight-${gen}`}))}catch{return false}})()
  }
  // Liefst bij een natuurlijke trackwissel in het venster voor de fade; anders vlak voor het begin van de fade.
  if(gn.boundary||now>=fs-GOODNIGHT_BEFORE_MS)speakGoodnight().catch(()=>{})
}
async function speakGoodnight(){
  if(gn.phase!=='armed')return;gn.phase='busy';gn.busy=true;const gen=gn.gen,breakId=`sleep-goodnight-${gen}`,text=gn.text,prep=gn.prep;let ducked=false,result='skipped',retry=false;
  const p=pb();
  try{
    // Praat de DJ of het nieuws al? Dan nu niet ertussen, maar over een tel opnieuw proberen (tot het venster voorbij is).
    if(window.MAIRVoiceEngine?.speaking||window.MAIRDJ?.busy){gn.phase='armed';gn.busy=false;gn.boundary=false;retry=true;return}
    if(typeof window.speakText!=='function'||document.visibilityState==='hidden'){result='skipped'}
    else{
      const ready=await Promise.race([prep,wait(6000).then(()=>false)]);
      if(gen!==gnGen)return;
      if(!ready)result='failed';
      else{
        try{ducked=!!(await p?.djDuck?.())}catch{ducked=false}
        const ok=await Promise.race([window.speakText(text,false,{breakId}),wait(30000).then(()=>'timeout')]);
        if(ok==='timeout'){try{await window.MAIRVoiceEngine?.cancel?.('sleep-goodnight-timeout',breakId)}catch{/* stem annuleren mislukt: onschuldig */}}
        result=ok===true?'said':'failed'
      }
    }
  }catch(e){result='failed';window.MAIRRuntime?.caught?.('mair-sleep.goodnight',e)}
  finally{
    // Het volume altijd terugzetten, ook als de stem faalde of de timer ondertussen is geannuleerd.
    if(ducked)try{await p?.djUnduck?.()}catch(e){window.MAIRRuntime?.caught?.('mair-sleep.unduck',e)}
    if(gen===gnGen&&!retry){gn.busy=false;gn.phase='done';gn.result=result;emit();render()}
  }
}

// ---------- stoppen ----------
async function stopRadio(reason='sleep-timer'){
  if(stopBusy)return false;stopBusy=true;lastError='';const truth=window.JFMPlaybackState,before=truth?.get?.();let op=0;
  try{
    try{op=truth?.begin?.('pause',{expectedUri:String(before?.uri||''),timeoutMs:10000})||0;truth?.setExpectedLive?.(false,reason)}catch(e){window.MAIRRuntime?.caught?.('mair-sleep.begin',e)}
    const pause=window.JFMPlayback?.pause;
    if(typeof pause!=='function')throw Error('MAIR playback-controller is nog niet beschikbaar');
    // Het uitfaden gebeurt vooraf in de tick (ensureFade/driveFade); 'na dit nummer' stopt op een natuurlijk einde en fadet niet.
    const faded=!!fade||fadeDone||hasLevelFlag();
    let ok=false;try{ok=await pause()}finally{if(faded)await restoreLevel(false)}
    if(!ok)throw Error(pb()?.health?.lastError||'Spotify kon niet worden gepauzeerd');
    lastStoppedAt=Date.now();clear();
    try{window.dispatchEvent(new CustomEvent('mair:sleep-complete',{detail:{reason,at:lastStoppedAt}}))}catch{/* event versturen mislukt: alleen een melding, geen gevolg */}
    return true
  }catch(e){if(before?.expectedLive)try{truth?.setExpectedLive?.(true,'sleep-pause-failed')}catch(e){window.MAIRRuntime?.caught?.('mair-sleep.setExpectedLive',e)};lastError=String(e?.message||e||'Sleep timer kon MAIR niet pauzeren');emit();render();return false}
  finally{try{if(op)truth?.end?.(op,{error:lastError})}catch(e){window.MAIRRuntime?.caught?.('mair-sleep.end',e)};stopBusy=false}
}

// ---------- timer ----------
function start({stopInMs,fadeMs=0,dj=false}={}){
  const total=Math.max(1000,Number(stopInMs)||0),now=Date.now();
  const wasFading=!!fade||hasLevelFlag();fade=null;fadeDone=false;fadeAborted=false;goodnightReset();lastStopTry=0;lastError='';
  if(wasFading)restoreLevel(true).catch(()=>{});
  save({mode:'time',at:now+total,minutes:Math.round(total/60000),createdAt:now,fadeMs:Math.max(0,Math.min(Number(fadeMs)||0,total)),dj:!!dj});ensureTick();return status()
}
function scheduleMinutes(minutes,opts={}){
  const n=Math.max(1,Math.min(240,Number(minutes)||0)),fadeMin=Number(opts.fadeMin??prefs.fadeMin),dj=opts.dj??prefs.dj;
  return start({stopInMs:n*60000,fadeMs:Math.max(0,fadeMin)*60000,dj})
}
function scheduleAfterTrack(){const t=track();if(!t.trackId){lastError='Start eerst een nummer voordat je “na dit nummer” gebruikt.';emit();render();return false}const wasFading=!!fade||hasLevelFlag();fade=null;fadeDone=false;fadeAborted=false;goodnightReset();if(wasFading)restoreLevel(true).catch(()=>{});lastError='';save({mode:'after-track',trackId:t.trackId,createdAt:Date.now(),title:t.title,artist:t.artist});ensureTick();return true}
function cancel(){const wasFading=!!fade||hasLevelFlag();clear();lastError='';if(wasFading)restoreLevel(true).catch(()=>{});return true}
function onTick(){
  const now=Date.now();
  if(state?.mode==='time'){
    const due=Number(state.at||0);
    if(due&&due<now-GRACE_MS&&(!fade||fade.finished)){clear()}
    else if(due){
      planGoodnight(now,due);
      ensureFade(now,due);
      if(fade&&!fade.finished)driveFade(now).catch(()=>{});
      const ready=fade?fade.finished:now>=due;
      if(ready&&now>=due&&now-lastStopTry>=RETRY_MS){lastStopTry=now;stopRadio('timer').catch(()=>{})}
    }
  }
  if(open)render()
}
function ensureTick(){if(tickTimer)return;tickTimer=setInterval(onTick,500)}
async function activateSleepStation(){lastError='';const select=window.MAIRStationController?.select||window.JFMMusicChoice?.chooseChannel;if(typeof select!=='function'){lastError='MAIR SLEEP is nog niet klaar. Open het muziekkanaal opnieuw.';render();return false}try{const ok=await select.call(window.MAIRStationController||window.JFMMusicChoice,'sleep');if(ok===false)throw Error('MAIR SLEEP kon niet worden gestart');render();return true}catch(e){lastError=String(e?.message||e);render();return false}}

// ---------- scherm ----------
function ensureStyle(){if($('mairSleepStyle'))return;const s=document.createElement('style');s.id='mairSleepStyle';s.textContent=`
.mair-sleep-launch{width:100%;margin-top:10px;border:1px solid #282d36;background:#11151b;color:#f4f6f8;border-radius:16px;padding:14px 16px;text-align:left;font-weight:800}.mair-sleep-launch span{display:block;color:#8e98a7;font-size:12px;font-weight:600;margin-top:3px}
.mair-sleep-overlay{position:fixed;inset:0;z-index:12000;overflow:auto;color:#f2ecff;background:radial-gradient(circle at 80% 0,#1d1038 0,#08060f 55%);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;padding:calc(env(safe-area-inset-top) + 18px) calc(env(safe-area-inset-right) + 20px) calc(env(safe-area-inset-bottom) + 22px) calc(env(safe-area-inset-left) + 20px);transition:filter .5s ease}
.mair-sleep-overlay[hidden]{display:none}.mair-sleep-overlay.mair-sleep-dim{filter:brightness(.72)}
.mair-sleep-overlay *{box-sizing:border-box}.mair-sleep-overlay button{font-family:inherit;-webkit-tap-highlight-color:transparent}
.mair-sleep-wrap{max-width:560px;margin:0 auto;min-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 40px);display:flex;flex-direction:column}
.mair-sleep-top{display:flex;justify-content:space-between;align-items:center}.mair-sleep-kicker{font-size:11px;letter-spacing:.18em;font-weight:800;color:#b07cff}
.mair-sleep-close{width:44px;height:44px;border-radius:50%;border:1px solid #2b1c4b;background:transparent;display:grid;place-items:center;color:#c18aff;font-size:24px;line-height:1;padding:0}
.mair-sleep-h{font-size:15px;color:#9d90b8;margin-top:14px}.mair-sleep-h b{display:block;font-size:32px;line-height:1.1;color:#f7f2ff;letter-spacing:-.03em;margin-top:2px;overflow-wrap:anywhere}
.mair-sleep-graph{margin:16px 0 6px;border-radius:22px;background:#0f0a1d;border:1px solid #251a40;padding:12px 10px 8px;transition:opacity .3s}.mair-sleep-graph.mair-sleep-faint{opacity:.4}
.mair-sleep-graph svg{width:100%;height:auto;display:block}.mair-sleep-axis{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:#6f6290;padding:0 6px}
.mair-sleep-lab{font-size:12px;letter-spacing:.14em;font-weight:800;color:#7f72a0;margin:14px 0 8px}
.mair-sleep-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mair-sleep-seg button{height:50px;min-width:0;border-radius:15px;background:#130d24;border:1px solid #2a1d48;display:grid;place-items:center;font-weight:700;font-size:16px;color:#cdbdf0;padding:0 2px;white-space:nowrap}
.mair-sleep-seg button.mair-sleep-on{background:linear-gradient(150deg,#8f46f5,#5a25c9);border-color:#b98aff;color:#fff}
.mair-sleep-opt{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:15px;color:#d9ccf3;background:#0f0a1d;border:1px solid #251a40;border-radius:16px;padding:12px 16px;width:100%;text-align:left}
.mair-sleep-opt[disabled]{opacity:.5}.mair-sleep-opt span.mair-sleep-opt-t{min-width:0}.mair-sleep-opt small{display:block;font-size:11px;color:#7f72a0;margin-top:2px}
.mair-sleep-sw{flex:none;width:50px;height:28px;border-radius:14px;background:#2a1d48;position:relative;transition:background .2s}.mair-sleep-sw:after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .2s}.mair-sleep-sw.mair-sleep-on{background:#8f46f5}.mair-sleep-sw.mair-sleep-on:after{left:25px}
.mair-sleep-go[hidden]{display:none}.mair-sleep-go{margin:0;width:100%;min-height:60px;border-radius:20px;border:0;background:linear-gradient(135deg,#9b4dff,#6a2fd8);color:#fff;font-weight:800;font-size:18px;box-shadow:0 12px 36px rgba(120,60,220,.35)}
.mair-sleep-body{display:flex;flex-direction:column;flex:1}.mair-sleep-r{display:flex;flex-direction:column;flex:1}.mair-sleep-go-wrap{margin-top:14px}
.mair-sleep-go.mair-sleep-off{background:transparent;border:1px solid #b98aff;color:#e0c8ff;box-shadow:none}
.mair-sleep-more{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}.mair-sleep-more button{min-height:42px;border:0;background:transparent;color:#8d80ad;font-size:13px;padding:6px 2px}
.mair-sleep-err{color:#ffb4b4;text-align:center;font-size:13px;margin-top:4px;overflow-wrap:anywhere}.mair-sleep-err:empty{display:none}
@media (orientation:landscape) and (max-height:500px){
.mair-sleep-overlay{padding:calc(env(safe-area-inset-top) + 10px) calc(env(safe-area-inset-right) + 24px) calc(env(safe-area-inset-bottom) + 8px) calc(env(safe-area-inset-left) + 24px)}
.mair-sleep-wrap{max-width:none;min-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 18px);display:grid;grid-template-columns:1.2fr 1fr;grid-template-rows:auto 1fr;column-gap:26px}
.mair-sleep-top{grid-column:1/3}.mair-sleep-body{display:contents}
.mair-sleep-g{grid-column:1;grid-row:2;align-self:center;min-width:0}.mair-sleep-h{margin-top:0;font-size:13px}.mair-sleep-h b{font-size:24px}.mair-sleep-graph{margin:8px 0 4px}
.mair-sleep-r{grid-column:2;grid-row:2;justify-content:center;min-width:0}.mair-sleep-lab{margin:4px 0 6px;font-size:11px}
.mair-sleep-seg button{height:42px;font-size:15px;border-radius:13px}.mair-sleep-opt{margin-top:8px;padding:8px 14px}
.mair-sleep-go{min-height:50px;font-size:17px}.mair-sleep-go-wrap{margin-top:10px;padding-top:0}.mair-sleep-more button{min-height:34px;padding:2px 4px;font-size:13px}.mair-sleep-more{margin-top:2px}
}
`;document.head.appendChild(s)}
function ensureUI(){
  ensureStyle();const radio=$('tab-radio');
  if(radio&&!$('mairSleepOpen')){const actions=$('djNow')?.closest('.grid2'),b=document.createElement('button');b.id='mairSleepOpen';b.type='button';b.className='mair-sleep-launch';b.innerHTML='🌙 Sleep <span id="mairSleepLaunchStatus">Timer instellen</span>';b.onclick=()=>setOpen(true);if(actions)actions.insertAdjacentElement('afterend',b);else radio.appendChild(b)}
  if($('mairSleepOverlay'))return;
  const o=document.createElement('div');o.id='mairSleepOverlay';o.className='mair-sleep-overlay';o.hidden=true;o.dataset.sleepLayout='fade';
  o.innerHTML=`<div class="mair-sleep-wrap"><div class="mair-sleep-top"><span class="mair-sleep-kicker">MAIR SLEEP</span><button id="mairSleepClose" class="mair-sleep-close" type="button" aria-label="Sluiten">×</button></div>
<div class="mair-sleep-body"><div class="mair-sleep-g"><div class="mair-sleep-h"><span id="mairSleepLine">Stopt over 30 minuten</span><b id="mairSleepBig">Zacht uit om --:--</b></div>
<div id="mairSleepGraph" class="mair-sleep-graph"><div id="mairSleepSvg"></div><div class="mair-sleep-axis"><span>nu</span><span id="mairSleepAxisMid">--:--</span><span id="mairSleepAxisEnd">--:-- pauze</span></div></div></div>
<div class="mair-sleep-r"><div class="mair-sleep-lab">STOPPEN OVER</div><div class="mair-sleep-seg" id="mairSleepMinutes"><button type="button" data-sleep-minutes="15">15</button><button type="button" data-sleep-minutes="30">30</button><button type="button" data-sleep-minutes="45">45</button><button type="button" data-sleep-minutes="60">60</button></div>
<div class="mair-sleep-lab">ZACHT UITFADEN</div><div class="mair-sleep-seg" id="mairSleepFades"><button type="button" data-sleep-fade="1">1 min</button><button type="button" data-sleep-fade="2">2 min</button><button type="button" data-sleep-fade="5">5 min</button><button type="button" data-sleep-fade="10">10 min</button></div>
<button id="mairSleepDj" type="button" class="mair-sleep-opt" role="switch" aria-checked="true"><span class="mair-sleep-opt-t">DJ zegt welterusten<small id="mairSleepDjNote">kort, vlak voor de fade begint</small></span><span id="mairSleepDjSw" class="mair-sleep-sw mair-sleep-on"></span></button>
<div class="mair-sleep-go-wrap"><button id="mairSleepStart" type="button" class="mair-sleep-go">Start slaaptimer</button><button id="mairSleepCancel" type="button" class="mair-sleep-go mair-sleep-off" hidden>Timer uitzetten</button></div>
<div class="mair-sleep-more"><button id="mairSleepAfterTrack" type="button">Stop na dit nummer</button><button id="mairSleepStation" type="button">Luister naar MAIR SLEEP</button></div><div id="mairSleepError" class="mair-sleep-err"></div></div></div></div>`;
  document.body.appendChild(o);
  $('mairSleepClose').onclick=()=>setOpen(false);
  $('mairSleepStation').onclick=()=>activateSleepStation();
  $('mairSleepAfterTrack').onclick=()=>scheduleAfterTrack();
  $('mairSleepCancel').onclick=()=>cancel();
  $('mairSleepStart').onclick=()=>{scheduleMinutes(prefs.minutes,{fadeMin:prefs.fadeMin,dj:prefs.dj&&djAvailable()})};
  $('mairSleepDj').onclick=()=>{if(!djAvailable())return;choose('dj',!prefs.dj)};
  o.querySelectorAll('[data-sleep-minutes]').forEach(b=>b.onclick=()=>choose('minutes',Number(b.dataset.sleepMinutes)));
  o.querySelectorAll('[data-sleep-fade]').forEach(b=>b.onclick=()=>choose('fade',Number(b.dataset.sleepFade)));
  let dimTimer=0;const wake=()=>{o.classList.remove('mair-sleep-dim');clearTimeout(dimTimer);if(open)dimTimer=setTimeout(()=>o.classList.add('mair-sleep-dim'),8000)};['pointerdown','touchstart','click'].forEach(n=>o.addEventListener(n,wake,{passive:true}));wake()
}
function djAvailable(){return window.MAIR_DJ_ENABLED!==false}
// Wijzigingen tijdens een lopende timer gelden meteen; zonder timer kies je alleen en start je met de knop.
function choose(kind,val){
  if(kind==='minutes')prefs.minutes=val;else if(kind==='fade')prefs.fadeMin=val;else prefs.dj=!!val;savePrefs();
  if(state?.mode==='after-track'&&kind==='minutes')scheduleMinutes(val);
  else if(state?.mode==='time'){
    if(kind==='minutes')scheduleMinutes(val);
    else if(kind==='fade'&&!fade&&!fadeDone){const left=remainingMs();save({...state,fadeMs:Math.min(val*60000,left)});fadeAborted=false}
    else if(kind==='dj')save({...state,dj:!!val&&djAvailable()})
  }
  render()
}
function curve(fx,total,pts=28){const x0=8,x1=332,top=28,bot=112;let d=`M${x0} ${top} H${fx.toFixed(1)}`;for(let i=1;i<=pts;i++){const p=i/pts,x=fx+(x1-fx)*p,y=top+(bot-top)*ease(p);d+=` L${x.toFixed(1)} ${y.toFixed(1)}`}return d}
function drawGraph(totalMs,fadeMs,elapsedMs,faint){
  const total=Math.max(1000,totalMs),f=Math.max(0,Math.min(fadeMs,total)),x0=8,x1=332,fx=x1-(x1-x0)*(f/total),key=`${Math.round(total/1000)}|${Math.round(f/1000)}`;
  const host=$('mairSleepSvg');if(!host)return;
  if(key!==graphKey){graphKey=key;const path=curve(fx),right=fx>230,lx=right?fx-7:fx+7;
    host.innerHTML=`<svg viewBox="0 0 340 130" role="img" aria-label="Volume zakt tot de stoptijd"><defs><linearGradient id="mairSleepGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b4dff" stop-opacity=".55"/><stop offset="1" stop-color="#9b4dff" stop-opacity="0"/></linearGradient></defs><path d="${path} V122 H8Z" fill="url(#mairSleepGrad)"/><path d="${path}" fill="none" stroke="#c18aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="${fx.toFixed(1)}" y1="12" x2="${fx.toFixed(1)}" y2="122" stroke="#3b2a66" stroke-dasharray="4 4"/><text x="${lx.toFixed(1)}" y="22" fill="#9d90b8" font-size="11" text-anchor="${right?'end':'start'}">volume zakt hier</text><circle id="mairSleepDot" cx="8" cy="28" r="6" fill="#fff"/></svg>`}
  const dot=$('mairSleepDot');if(dot){const t=Math.max(0,Math.min(1,elapsedMs/total)),fadeStart=1-f/total,p=f>0?(t-fadeStart)/(f/total):0,x=x0+(x1-x0)*t,y=28+84*ease(p);dot.setAttribute('cx',x.toFixed(1));dot.setAttribute('cy',y.toFixed(1))}
  $('mairSleepGraph')?.classList.toggle('mair-sleep-faint',!!faint)
}
function render(){
  ensureUI();const launch=$('mairSleepLaunchStatus'),now=Date.now();
  const timed=state?.mode==='time',after=state?.mode==='after-track';
  const minutes=timed?Math.max(1,Math.round((Number(state.at)-Number(state.createdAt))/60000)):prefs.minutes;
  const totalMs=timed?Math.max(1000,Number(state.at)-Number(state.createdAt)):prefs.minutes*60000;
  const fadeMs=timed?fadeMsOf(state):Math.min(prefs.fadeMin*60000,totalMs);
  const stopAt=timed?Number(state.at):now+totalMs,fadeStart=stopAt-fadeMs;
  const line=$('mairSleepLine'),big=$('mairSleepBig');
  if(timed){if(line)line.textContent=fade&&!fade.finished?`Het volume zakt. Nog ${fmt(remainingMs())}`:`Nog ${fmt(remainingMs())}`;if(big)big.textContent=`Zacht uit om ${clock(stopAt)}`;if(launch)launch.textContent=`Nog ${fmt(remainingMs())}`}
  else if(after){if(line)line.textContent='Stopt na dit nummer';if(big)big.textContent=state.title||'Na dit nummer';if(launch)launch.textContent='Stopt na dit nummer'}
  else{if(line)line.textContent=`Stopt over ${minutes} minuten`;if(big)big.textContent=`Zacht uit om ${clock(stopAt)}`;if(launch)launch.textContent='Timer instellen'}
  $('mairSleepAxisMid')&&($('mairSleepAxisMid').textContent=clock(fadeStart));$('mairSleepAxisEnd')&&($('mairSleepAxisEnd').textContent=`${clock(stopAt)} pauze`);
  drawGraph(totalMs,fadeMs,timed?now-Number(state.createdAt):0,after);
  const selMin=timed?minutes:prefs.minutes,selFade=timed?Math.round(fadeMs/60000)||prefs.fadeMin:prefs.fadeMin;
  const root=$('mairSleepOverlay');
  root?.querySelectorAll('[data-sleep-minutes]').forEach(b=>{const on=Number(b.dataset.sleepMinutes)===selMin&&!after;b.classList.toggle('mair-sleep-on',on);b.setAttribute('aria-pressed',on?'true':'false')});
  root?.querySelectorAll('[data-sleep-fade]').forEach(b=>{const on=Number(b.dataset.sleepFade)===(timed?selFade:prefs.fadeMin);b.classList.toggle('mair-sleep-on',on);b.setAttribute('aria-pressed',on?'true':'false')});
  const dj=djAvailable(),djOn=dj&&(timed?state.dj===true:prefs.dj),sw=$('mairSleepDjSw'),djBtn=$('mairSleepDj'),note=$('mairSleepDjNote');
  if(sw)sw.classList.toggle('mair-sleep-on',djOn);if(djBtn){djBtn.setAttribute('aria-checked',djOn?'true':'false');djBtn.toggleAttribute('disabled',!dj)}
  if(note)note.textContent=!dj?'de DJ staat uit':gn.phase==='busy'?'de DJ zegt het nu':gn.result==='failed'?'lukte niet, de muziek loopt gewoon door':'kort, vlak voor de fade begint';
  $('mairSleepStart')?.toggleAttribute('hidden',!!state);$('mairSleepCancel')?.toggleAttribute('hidden',!state);
  const err=$('mairSleepError');if(err)err.textContent=lastError||''
}
function setOpen(v){ensureUI();open=!!v;const o=$('mairSleepOverlay');if(o)o.hidden=!open;if(open){render();document.body.style.overflow='hidden'}else document.body.style.overflow='';emit()}
function onNatural(detail={}){if(state?.mode!=='after-track')return;const ended=String(detail.trackId||detail.endedTrackId||'');if(ended&&ended===String(state.trackId||''))stopRadio('after-track').catch(()=>{})}
// Een volume dat door de luisteraar wordt verzet (schuif, sneltoets) breekt de fade af. De fade zelf stuurt dit event nooit.
function onUserVolume(){if(fade&&!fade.finished)overrideFade('gebruiker')}
// Is de pagina tijdens een fade weggeweest en staat het volume nog laag (herstart, crash)? Dan alsnog terugzetten.
function recoverLevel(){if(!hasLevelFlag()||state?.mode==='time'&&(fade||Number(state.at||0)>Date.now()-GRACE_MS))return;let tries=0;const go=async()=>{if(await restoreLevel(false))return;if(++tries<15)setTimeout(go,2000)};setTimeout(go,1500)}
function boot(){ensureUI();ensureTick();render();recoverLevel();window.addEventListener('jfm:natural-track-end',e=>onNatural(e.detail||{}));window.addEventListener('jfm:natural-next-ready',e=>onNatural(e.detail||{}));window.addEventListener('jfm:trackchange',()=>{if(gn.phase==='armed')gn.boundary=true;render()});window.addEventListener('mair:channelchange',render);window.addEventListener('mair:volume',onUserVolume);window.addEventListener('pageshow',()=>{state=read();render();onTick()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onTick()});setInterval(()=>{if(open||state)render()},1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRSleep={version:'mair-sleep-v2.0',open:()=>setOpen(true),close:()=>setOpen(false),scheduleMinutes,scheduleAfterTrack,start,cancel,status,stop:stopRadio,activateSleepStation};
})();
