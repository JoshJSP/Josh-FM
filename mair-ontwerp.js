// Haalt een kleur uit de albumhoes en zet hem als --mair-cover (achtergrond van de telefoon-layout).
// Alleen uiterlijk: geen hoes, geen CORS of een fout geeft gewoon het oranje terug. Raakt de speler niet aan.
(()=>{
const root=document.documentElement,FALLBACK='#ff6a00';
let last='';
function set(c){root.style.setProperty('--mair-cover',c||FALLBACK)}
// Gemiddelde van de levendige pixels, daarna donkerder gemaakt zodat witte tekst leesbaar blijft.
function pick(img){
  const n=24,cv=document.createElement('canvas');cv.width=cv.height=n;
  const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,n,n);
  const d=cx.getImageData(0,0,n,n).data;let r=0,g=0,b=0,w=0;
  for(let i=0;i<d.length;i+=4){const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]),s=mx?(mx-mn)/mx:0,wt=.05+s*s*(mx/255);r+=d[i]*wt;g+=d[i+1]*wt;b+=d[i+2]*wt;w+=wt}
  if(!w)return null;r/=w;g/=w;b/=w;
  const k=Math.min(1,150/Math.max(r,g,b,1));
  return '#'+[r,g,b].map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');
}
function update(){
  const el=document.getElementById('artImg'),src=el&&!el.classList.contains('hidden')&&el.currentSrc||'';
  if(src===last)return;last=src;
  if(!src)return set();
  const im=new Image();im.crossOrigin='anonymous';
  im.onload=()=>{if(src!==last)return;try{set(pick(im))}catch{set()}};
  im.onerror=()=>{if(src===last)set()};
  im.src=src;
}
function start(){
  const el=document.getElementById('artImg');
  if(!el){setTimeout(start,500);return}
  new MutationObserver(update).observe(el,{attributes:true,attributeFilter:['src','class']});
  el.addEventListener('load',update);update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
