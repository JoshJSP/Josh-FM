// Josh FM v2.2.6 authoritative DJ scheduler.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  let busy=false,armedFrom='',lastSeen='',autoCount=0,nextAuto=3;
  const state=async()=>{try{return await api('/me/player')}catch{return null}};
  const devicePath=p=>{const id=String(window.JFMPlaybackState?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return id?p+(p.includes('?')?'&':'?')+'device_id='+encodeURIComponent(id):p};
  const status=t=>{const e=$('queueInfo');if(e)e.textContent=t};
  function plan(){const v=Number($('talk')?.value||1),ranges=[[6,9],[3,5],[2,4],[1,3]],r=ranges[v]||ranges[1];nextAuto=Math.floor(Math.random()*(r[1]-r[0]+1))+r[0];autoCount=0}
  async function confirmPaused(uri){for(let i=0;i<8;i++){await wait(100+i*60);const s=await state();if(s?.item?.uri===uri&&!s?.is_playing)return s}return null}
  async function confirmPlaying(uri){for(let i=0;i<8;i++){await wait(100+i*60);const s=await state();if(s?.item?.uri===uri&&s?.is_playing)return s}return null}
  async function pause(uri){try{await api(devicePath('/me/player/pause'),{method:'PUT'})}catch{return false}return !!(await confirmPaused(uri))}
  async function rewind(uri){const s=await state();if(s?.item?.uri!==uri)return false;try{await api(devicePath('/me/player/seek?position_ms=0'),{method:'PUT'})}catch{return false}for(let i=0;i<6;i++){await wait(90+i*50);const x=await state();if(x?.item?.uri===uri&&Number(x.progress_ms||0)<1500)return true}return false}
  async function resume(uri){try{await api(devicePath('/me/player/play'),{method:'PUT'})}catch{return false}return !!(await confirmPlaying(uri))}
  async function prepare(track,manual){const[fact,weather]=await Promise.all([getFact(track),getWeather()]);const text=await makeDJScript(track,fact,weather,manual);if(!text)return null;if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}return{text,fact}}
  async function run(manual=false){if(busy)return false;const live=await state();const uri=String(live?.item?.uri||'');if(!live?.is_playing||!uri.startsWith('spotify:track:'))return false;busy=true;try{
    const track=trackObj(live.item);status('DJ wordt voorbereid…');const pack=await prepare(track,manual);if(!pack)return false;
    if(!(await pause(uri))){status('DJ overgeslagen · muziek kon niet veilig worden gepauzeerd.');return false}
    status('DJ live · muziek is stil.');if($('djText'))$('djText').textContent=pack.text;
    const spoken=(await window.speakText?.(pack.text,false))!==false;
    const same=await state();if(same?.item?.uri!==uri)return false;
    if(!(await rewind(uri)))return false;if(!(await resume(uri)))return false;
    if(spoken){try{localStorage.setItem('jfm_last_dj_break_at',String(Date.now()))}catch{};const t=$('djBreakTime');if(t)t.textContent=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
    status(spoken?'DJ klaar · nummer start vanaf 0:00.':'DJ overgeslagen · muziek hervat vanaf 0:00.');plan();return spoken
  }finally{busy=false}}
  function arm(){const id=String(playback?.item?.id||'');if(!id)return;armedFrom=armedFrom===id?'':id;const b=$('djNow');if(b){b.dataset.queued=armedFrom?'1':'0';const s=b.querySelector('span');if(s)s.textContent=armedFrom?'Skip naar het volgende nummer':'Laat hem iets vertellen'}status(armedFrom?'DJ staat klaar voor het volgende nummer.':'DJ-opdracht geannuleerd.')}
  function ownButton(){const old=$('djNow');if(!old||old.dataset.jfmOwner==='v226')return;const b=old.cloneNode(true);old.replaceWith(b);b.dataset.jfmOwner='v226';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();arm()},true)}
  async function onTrackChange(s){const id=String(s?.item?.id||'');if(!id||id===lastSeen)return;const previous=lastSeen;lastSeen=id;if(!previous)return;if(armedFrom&&id!==armedFrom){armedFrom='';const b=$('djNow');if(b){b.dataset.queued='0';const x=b.querySelector('span');if(x)x.textContent='Laat hem iets vertellen'}await wait(120);await run(true);return}autoCount++;if(autoCount>=nextAuto){let skip=false;try{skip=!!skipNextTalk;if(skip)skipNextTalk=false}catch{}if(skip)plan();else{await wait(120);await run(false)}}}
  window.refresh=async function(){const d=await api('/me/player');if(!d?.item)return;playback=d;try{window.JFMPlaybackState?.ingest?.(d,'dj-v226-refresh')}catch{};renderPlayback(d);await onTrackChange(d);lastTrackId=d.item.id};
  window.djBreak=()=>run(false);window.JFMDJAuthoritative={version:'v226-pause-speak-rewind-resume',run,plan,get busy(){return busy}};
  plan();ownButton();setInterval(()=>{ownButton();state().then(onTrackChange).catch(()=>{})},1200);window.addEventListener('pageshow',()=>setTimeout(ownButton,120));
})();
