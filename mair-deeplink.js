// Deeplink ?station=<id>: VESPER opent MAIR met de zender die past bij wat Josh doet
// (leren, gamen, rijden). Staat vóór de andere scripts in index.html: music-choice.js
// leest bij het laden de laatst gekozen zender uit localStorage en zet die later
// steeds terug. Dus eerst die opslag op de nieuwe zender, daarna de knop tikken
// (zodat de radioset echt wisselt) tot body.dataset.musicChannel klopt.
(()=>{
  const id=new URLSearchParams(location.search).get('station');
  if(!id||!/^[a-z0-9]{2,12}$/.test(id))return;
  try{localStorage.setItem('jfm_music_channel_v1',id)}catch{/* opslag geblokkeerd: dan alleen tikken */}
  const tot=Date.now()+20000;
  const probeer=()=>{
    if(document.body?.dataset?.musicChannel!==id){
      const knop=document.querySelector(`[data-jfm-channel="${id}"],[data-mair-station="${id}"]`);
      if(knop)knop.click();
    }
    if(Date.now()<tot)return setTimeout(probeer,1000);
    if(document.body?.dataset?.musicChannel===id)history.replaceState(null,'',location.pathname);
  };
  setTimeout(probeer,1500);
})();
