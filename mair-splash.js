// Splash in de app (Capacitor of beginscherm), 2 s: de strepen vallen van boven, het zwarte vlak komt erachter
// en dan staat het logo er. Staat bovenaan <body> zodat hij er is voordat de rest laadt. Web in de browser slaat hem over.
// Divs met transform/opacity i.p.v. SVG: die animaties lopen op de GPU en haperen niet terwijl de app-scripts laden.
(()=>{
  const app=window.Capacitor?.isNativePlatform?.()||matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(!app)return;
  const u=v=>v/5.12+'%'; // logo-eenheden (512) naar procenten van de tegel
  const bars=[[92,144,224],[144,199,169],[196,252,116],[248,203,165],[300,151,217],[352,144,224]];
  const el=document.createElement('div');
  el.id='mairSplash';
  el.innerHTML=`<style>
#mairSplash{position:fixed;inset:0;z-index:2147483647;background:#ff633e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7vw;transition:opacity .3s ease}
#mairSplash .ms-logo{position:relative;width:min(60vw,340px);aspect-ratio:1}
#mairSplash .ms-tile{position:absolute;inset:0;border-radius:21.9%;background:#171816;animation:ms-tile .4s cubic-bezier(.3,1.4,.5,1) 1.1s both}
#mairSplash .ms-bar{position:absolute;border-radius:99px;background:#171816;transform-origin:50% 100%;animation:ms-drop .62s both,ms-color .25s ease 1.1s both}
#mairSplash .ms-track{position:absolute;left:${u(88)};width:${u(302)};top:${u(387)};height:${u(9)};border-radius:9px;background:#ff633e;opacity:.24;animation:ms-fade .3s ease 1.35s both}
#mairSplash .ms-dot{position:absolute;left:${u(398)};top:${u(387)};width:${u(24)};height:${u(24)};border-radius:50%;background:#fff8ec;animation:ms-pop .35s cubic-bezier(.3,1.6,.5,1) 1.4s both}
#mairSplash .ms-name{font:900 min(13vw,74px)/1 "Arial Black","Helvetica Neue",Arial,sans-serif;color:#171816;letter-spacing:-.01em;animation:ms-up .4s cubic-bezier(.2,.8,.2,1) 1.45s both}
@keyframes ms-drop{0%{transform:translateY(-110vh);animation-timing-function:cubic-bezier(.5,0,.75,0)}72%{transform:translateY(0);animation-timing-function:ease-out}84%{transform:scaleY(.84);animation-timing-function:ease-in-out}100%{transform:none}}
@keyframes ms-color{to{background:#ff633e}}
@keyframes ms-tile{from{opacity:0;transform:scale(.6)}}
@keyframes ms-fade{from{opacity:0}}
@keyframes ms-pop{from{opacity:0;transform:scale(0)}}
@keyframes ms-up{from{opacity:0;transform:translateY(24px)}}
@media(prefers-reduced-motion:reduce){#mairSplash *{animation-duration:0s!important;animation-delay:0s!important}}
</style><div class="ms-logo" role="img" aria-label="MAIRFM"><div class="ms-tile"></div>
${bars.map(([x,y,h],i)=>`<div class="ms-bar" style="left:${u(x)};top:${u(y)};width:${u(34)};height:${u(h)};animation-delay:${.1+i*.08}s,1.1s"></div>`).join('')}
<div class="ms-track"></div><div class="ms-dot"></div></div><div class="ms-name">MAIRFM</div>`;
  document.body.prepend(el);
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},2000);
})();
