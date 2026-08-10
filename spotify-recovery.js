// Keep Spotify Connect recoverable after iPhone gives audio focus to the DJ voice.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const key='jfm_spotify_device_id';
  function rememberFromState(s){const id=s?.device?.id;if(id)localStorage.setItem(key,id);return id||''}
  async function devices(){try{return (await api('/me/player/devices'))?.devices||[]}catch{return[]}}
  async function chooseDevice(){
    const list=await devices();
    const stored=localStorage.getItem(key)||'';
    const pick=list.find(d=>d.is_active)||list.find(d=>d.id===stored)||list.find(d=>d.type==='Smartphone')||list[0];
    if(pick?.id)localStorage.setItem(key,pick.id);
    return pick?.id||stored;
  }
  async function transfer(deviceId,play=true){
    if(!deviceId)return false;
    try{await api('/me/player',{method:'PUT',body:{device_ids:[deviceId],play:!!play}});await wait(500);return true}catch(e){console.warn('Spotify transfer failed',e);return false}
  }
  window.jfmEnsureSpotifyDevice=async function(play=true){
    try{const s=await api('/me/player');if(s?.device?.id){rememberFromState(s);if(!play||s.is_playing)return s.device.id}}
    catch{}
    const id=await chooseDevice();
    if(id)await transfer(id,play);
    return id;
  };
  window.jfmPlayUri=async function(uri){
    let id=await window.jfmEnsureSpotifyDevice(false);
    for(let i=0;i<4;i++){
      const suffix=id?`?device_id=${encodeURIComponent(id)}`:'';
      try{await api('/me/player/play'+suffix,{method:'PUT',body:uri?{uris:[uri]}:undefined})}catch(e){
        if(/No active device/i.test(String(e?.message||e))){id=await chooseDevice();if(id)await transfer(id,false);continue}
      }
      await wait(550+i*250);
      try{const s=await api('/me/player');if(s?.device?.id)rememberFromState(s);if(s?.is_playing&&(!uri||s.item?.uri===uri)){playback=s;try{renderPlayback(s)}catch{};return true}}
      catch{}
      if(id)await transfer(id,true);
    }
    return false;
  };
  const originalRefresh=window.refresh;
  if(typeof originalRefresh==='function')window.refresh=refresh=async function(...args){const out=await originalRefresh.apply(this,args);try{rememberFromState(playback)}catch{}return out};
  const play=document.getElementById('play');
  if(play)play.onclick=async()=>{
    try{
      if(playback?.is_playing){await api('/me/player/pause',{method:'PUT'});setTimeout(()=>refresh().catch(()=>{}),300);return}
      const ok=await window.jfmPlayUri(null);
      if(!ok){const q=document.getElementById('queueInfo');if(q)q.textContent='Spotify is niet actief. Open Spotify één keer en kom terug naar Josh FM.'}
      setTimeout(()=>refresh().catch(()=>{}),350);
    }catch(e){console.warn('Josh FM play recovery',e)}
  };
})();