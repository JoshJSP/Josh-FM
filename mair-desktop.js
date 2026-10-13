// Zet de huidige hoes als CSS-variabele --mair-art op #tab-radio, voor de wazige achtergrond in mair-desktop.css.
(function(){
  const img=document.getElementById('artImg'),radio=document.getElementById('tab-radio');
  if(!img||!radio)return;
  const sync=()=>{const u=img.classList.contains('hidden')?'':(img.currentSrc||img.src);radio.style.setProperty('--mair-art',u?'url("'+u.replace(/"/g,'%22')+'")':'none')};
  new MutationObserver(sync).observe(img,{attributes:true,attributeFilter:['src','class']});
  img.addEventListener('load',sync);sync();
})();
