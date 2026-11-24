// Deeplink ?station=<id>: VESPER opent MAIR met de zender die past bij wat Josh doet
// (leren, gamen, rijden). Staat vóór de andere scripts in index.html: music-choice.js
// leest bij het laden de laatst gekozen zender uit localStorage en zet die later
// steeds terug. Dus eerst die opslag op de nieuwe zender, daarna de knop tikken
// (zodat de radioset echt wisselt) tot body.dataset.musicChannel klopt.
// De iOS-app (mairfm://?station=<id>) roept window.mairDeeplink(id) aan als de pagina
// al open staat, zodat de muziek niet stopt door een herlaad (ios/App/App/SceneDelegate.swift).
(()=>{
  const geldig=id=>typeof id==='string'&&/^[a-z0-9]{2,12}$/.test(id);
  const kies=(id,wacht=1500)=>{
    if(!geldig(id))return false;
    try{localStorage.setItem('jfm_music_channel_v1',id)}catch{/* opslag geblokkeerd: dan alleen tikken */}
    const tot=Date.now()+20000;
    const probeer=()=>{
      // klopt hij, dan stoppen: kiest Josh daarna zelf iets anders, dan blijft dat staan
      if(document.body?.dataset?.musicChannel===id){
        if(new URLSearchParams(location.search).has('station'))history.replaceState(null,'',location.pathname);
        return;
      }
      const knop=document.querySelector(`[data-jfm-channel="${id}"],[data-mair-station="${id}"]`);
      if(knop)knop.click();
      if(Date.now()<tot)setTimeout(probeer,1000);
    };
    setTimeout(probeer,wacht);
    return true;
  };
  window.mairDeeplink=id=>kies(id,0);
  kies(new URLSearchParams(location.search).get('station'));
})();
