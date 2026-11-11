// Deeplink ?station=<id>: VESPER opent MAIR met de zender die past bij wat Josh doet
// (leren, gamen, rijden). Wacht tot de zenderknop er is en tikt hem aan; daarna is
// de parameter weg, zodat herladen niet opnieuw schakelt.
(()=>{
  const id=new URLSearchParams(location.search).get('station');
  if(!id||!/^[a-z0-9]{2,12}$/.test(id))return;
  const tot=Date.now()+15000;
  const zoek=()=>{
    const knop=document.querySelector(`[data-jfm-channel="${id}"],[data-mair-station="${id}"]`);
    if(knop){knop.click();history.replaceState(null,'',location.pathname);return}
    if(Date.now()<tot)setTimeout(zoek,400);
  };
  setTimeout(zoek,800);
})();
