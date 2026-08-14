// MAIR v2.2.6 authoritative DJ scheduler.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const TALK_RANGES=[[6,9],[3,5],[2,4],[1,3]],TALK_LABELS=['Weinig','Normaal','Radio','Veel'];
  let busy=false,armedFrom='',lastSeen='',autoCount=0,nextAuto=3,lastPlanReason='boot',lastTrigger=null;
  let pendingAuto=false,pendingSince=0,pendingAttempts=0,lastFailure='',retryTimer=null;
  const state=async()=>{try{return await api('/me/player')}catch{return null}};
  const devicePath=p=>{const id=String(window.JFMPlaybackState?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return id?p+(p.includes('?')?'&':'?')+'device_id='+encodeURIComponent(id):p};
  const status=t=>{const e=$('queueInfo');if(e)e.textContent=t};
  const talkValue=()=>Math.max(0,Math.min(3,Number($('talk')?.value??1)||0));
  function scheduleState(){return{mode:talkValue(),label:TALK_LABELS[talkValue()]||'Normaal',tracksSinceTalk:autoCount,target:nextAuto,remaining:pendingAuto?0:Math.max(0,nextAuto-autoCount),busy,pendingAuto,pendingSince,pendingAttempts,lastFailure,lastPlanReason,lastTrigger}}
  function renderSchedule(){const v=$('talkValue');if(v){const s=scheduleState();v.textContent=s.pendingAuto?`${s.label} · DJ klaar voor volgende overgang`:`${s.label} · DJ over ${s.remaining} nummer${s.remaining===1?'':'s'}`;v.dataset.djRemaining=String(s.remaining);v.dataset.djPending=s.pendingAuto?'1':'0'}try{window.dispatchEvent(new CustomEvent('mair:dj-schedule',{detail:scheduleState()}))}catch{}}
  function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null}}
  function plan(reason='scheduled'){clearRetry();const v=talkValue(),r=TALK_RANGES[v]||TALK_RANGES[1];nextAuto=Math.floor(Math.random()*(r[1]-r[0]+1))+r[0];autoCount=0;pendingAuto=false;pendingSince=0;pendingAttempts=0;lastFailure='';lastPlanReason=reason;renderSchedule();return scheduleState()}
  function replanFromSetting(){plan('frequency-change');status(`Praatfrequentie ${TALK_LABELS[talkValue()]} · volgende DJ over ${nextAuto} nummer${nextAuto===1?'':'s'}.`)}
  async function confirmPaused(uri){for(let i=0;i<10;i++){await wait(120+i*70);const s=await state();if(s?.item?.uri===uri&&!s?.is_playing)return s}return null}
  async function confirmPlaying(uri){for(let i=0;i<10;i++){await wait(120+i*70);const s=await state();if(s?.item?.uri===uri&&s?.is_playing)return s}return null}
  async function pause(uri){try{await api(devicePath('/me/player/pause'),{method:'PUT'})}catch{return false}return !!(await confirmPaused(uri))}
  async function rewind(uri){const s=await state();if(s?.item?.uri!==uri)return false;try{await api(devicePath('/me/player/seek?position_ms=0'),{method:'PUT'})}catch{return false}for(let i=0;i<8;i++){await wait(100+i*60);const x=await state();if(x?.item?.uri===uri&&Number(x.progress_ms||0)<1800)return true}return false}
  async function resume(uri){try{await api(devicePath('/me/player/play'),{method:'PUT'})}catch{return false}return !!(await confirmPlaying(uri))}
  async function prepare(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);if(!text)return null;if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}return{text,fact}}
  async function recover(uri){if(!uri)return false;const s=await state();if(s?.item?.uri!==uri)return false;if(!s.is_playing){await rewind(uri).catch(()=>false);return resume(uri)}return true}
  async function run(manual=false){if(busy)return false;const live=await state();const uri=String(live?.item?.uri||'');if(!live?.is_playing||!uri.startsWith('spotify:track:')){lastFailure='blocked-not-playing';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();return false}busy=true;lastTrigger={at:Date.now(),manual,result:'preparing',uri};renderSchedule();let pausedForDJ=false;try{
    const track=trackObj(live.item);status('DJ wordt voorbereid…');const pack=await prepare(track,manual);if(!pack){lastFailure='prepare-failed';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();status('DJ wacht · voorbereiding of TTS lukte nog niet.');return false}
    if(typeof window.speakText!=='function'){lastFailure='voice-unavailable';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();status('DJ wacht · stemruntime is nog niet beschikbaar.');return false}
    if(!(await pause(uri))){lastFailure='pause-failed';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();status('DJ wacht · Spotify kon nog niet veilig pauzeren.');return false}pausedForDJ=true;
    status('DJ live · muziek is stil.');if($('djText'))$('djText').textContent=pack.text;
    const spoken=(await window.speakText(pack.text,false))===true;
    const same=await state();if(same?.item?.uri!==uri){lastFailure='track-changed-during-break';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();status('DJ wacht · track wisselde tijdens de break.');return false}
    if(!(await rewind(uri)))throw Error('DJ-herstel: track kon niet naar 0:00.');
    if(!(await resume(uri)))throw Error('DJ-herstel: muziek kon niet hervatten.');pausedForDJ=false;
    if(!spoken){lastFailure='tts-failed';lastTrigger={at:Date.now(),manual,result:lastFailure,uri};renderSchedule();status('DJ wacht · stem was nog niet hoorbaar.');return false}
    try{localStorage.setItem('jfm_last_dj_break_at',String(Date.now()))}catch{};const t=$('djBreakTime');if(t)t.textContent=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
    lastFailure='';lastTrigger={at:Date.now(),manual,result:'spoken',uri};status('DJ klaar · nummer start vanaf 0:00.');plan('break-complete');return true
  }catch(e){lastFailure='error';lastTrigger={at:Date.now(),manual,result:'error',error:String(e?.message||e),uri};renderSchedule();status(String(e?.message||e));return false}finally{if(pausedForDJ){const ok=await recover(uri).catch(()=>false);status(ok?'DJ wacht · muziek veilig hervat.':'DJ wacht · open Spotify om playback te hervatten.')}busy=false;renderSchedule()}}
  function schedulePendingRetry(delay=1400){if(!pendingAuto||busy||retryTimer)return;retryTimer=setTimeout(async()=>{retryTimer=null;if(!pendingAuto||busy)return;const live=await state();if(!live?.is_playing||!String(live?.item?.uri||'').startsWith('spotify:track:')){schedulePendingRetry(Math.min(3500,delay+700));return}await attemptPending('same-track-retry')},delay)}
  async function attemptPending(reason='track-transition'){if(!pendingAuto||busy)return false;pendingAttempts++;lastPlanReason=reason;renderSchedule();const ok=await run(false);if(ok)return true;status(`DJ blijft klaar · ${lastFailure||'overgang nog niet veilig'}.`);schedulePendingRetry(Math.min(3200,900+pendingAttempts*450));return false}
  function markPending(reason='target-reached'){if(!pendingAuto){pendingAuto=true;pendingSince=Date.now();pendingAttempts=0;lastFailure='';lastPlanReason=reason;renderSchedule()}return pendingAuto}
  function arm(){const id=String(playback?.item?.id||'');if(!id)return;armedFrom=armedFrom===id?'':id;const b=$('djNow');if(b){b.dataset.queued=armedFrom?'1':'0';const s=b.querySelector('span');if(s)s.textContent=armedFrom?'Skip naar het volgende nummer':'Laat hem iets vertellen'}status(armedFrom?'DJ staat klaar voor het volgende nummer.':'DJ-opdracht geannuleerd.')}
  function ownButton(){const old=$('djNow');if(!old||old.dataset.jfmOwner==='v229')return;const b=old.cloneNode(true);old.replaceWith(b);b.dataset.jfmOwner='v229';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();arm()},true)}
  async function onTrackChange(s){const id=String(s?.item?.id||'');if(!id||id===lastSeen)return;const previous=lastSeen;lastSeen=id;if(!previous){renderSchedule();return}if(armedFrom&&id!==armedFrom){armedFrom='';const b=$('djNow');if(b){b.dataset.queued='0';const x=b.querySelector('span');if(x)x.textContent='Laat hem iets vertellen'}await wait(180);await run(true);return}
    if(pendingAuto){await wait(220);await attemptPending('next-track-retry');return}
    autoCount++;renderSchedule();if(autoCount>=nextAuto){let skip=false;try{skip=!!skipNextTalk;if(skip)skipNextTalk=false}catch{}if(skip){plan('skip-next-talk');return}markPending('target-reached');lastTrigger={at:Date.now(),manual:false,result:'triggered',trackId:id,tracksSinceTalk:autoCount,target:nextAuto};renderSchedule();await wait(220);await attemptPending('target-transition')}}
  window.refresh=async function(){const d=await api('/me/player');if(!d?.item)return;playback=d;try{window.JFMPlaybackState?.ingest?.(d,'dj-v229-refresh')}catch{};renderPlayback(d);await onTrackChange(d);lastTrackId=d.item.id};
  window.djBreak=()=>run(false);window.JFMDJAuthoritative={version:'v229-voice-runtime-guard',run,plan,replan:replanFromSetting,state:scheduleState,retry:()=>attemptPending('manual-retry'),get busy(){return busy}};
  function bindFrequency(){const talk=$('talk');if(!talk||talk.dataset.mairDjFrequencyBound==='1')return;talk.dataset.mairDjFrequencyBound='1';talk.addEventListener('input',replanFromSetting);talk.addEventListener('change',replanFromSetting)}
  plan('boot');ownButton();bindFrequency();setInterval(()=>{ownButton();bindFrequency();state().then(onTrackChange).catch(()=>{})},1200);window.addEventListener('pageshow',()=>setTimeout(()=>{ownButton();bindFrequency();renderSchedule();if(pendingAuto)schedulePendingRetry(900)},120));
})();
