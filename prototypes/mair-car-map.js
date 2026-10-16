// MAIRFM Car Mode: de kaart (Mapbox GL JS, donkere navigatiestijl) onder het B2-scherm.
// - mapbox-gl komt uit vendor/mapbox-gl (CSP: script-src 'self') en wordt pas geladen als er een route is.
// - Eén kaart per Car Mode-sessie: hide() verbergt hem alleen, destroy() (Car Mode dicht) ruimt hem op.
//   Elke `new Map` telt als een betaalde kaartlading bij Mapbox, dus nooit opnieuw opbouwen tijdens het rijden.
// - Valt de kaart uit (geen token, geen netwerk, geen WebGL), dan blijft de rest van Car Mode gewoon werken.
(()=>{
'use strict';
if(window.MAIRCarMap)return;
const BASE='vendor/mapbox-gl/',STYLE='mapbox://styles/mapbox/navigation-night-v1',PITCH=55;
let libP=null,creating=null,map=null,host=null,puck=null,ready=false,failed='',loads=0,route=null,cam=null,shown=false;
function loadLib(){
  if(libP)return libP;
  libP=new Promise((ok,no)=>{
    if(window.mapboxgl)return ok(window.mapboxgl);
    const l=document.createElement('link');l.rel='stylesheet';l.href=BASE+'mapbox-gl.css';document.head.appendChild(l);
    const s=document.createElement('script');s.src=BASE+'mapbox-gl-csp.js';
    s.onload=()=>{try{window.mapboxgl.workerUrl=new URL(BASE+'mapbox-gl-csp-worker.js',location.href).href;ok(window.mapboxgl)}catch(e){no(e)}};
    s.onerror=()=>no(Error('Kaartbestand niet geladen'));
    document.head.appendChild(s)
  }).catch(e=>{libP=null;throw e});
  return libP
}
// De pijl staat vast op het punt waar de camera naartoe kijkt (padding), de kaart draait eromheen.
const PUCK='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 54 54 32 44 10 54z" fill="#fff" stroke="#9b4dff" stroke-width="4" stroke-linejoin="round"/></svg>';
const pad=()=>{const w=host.clientWidth,h=host.clientHeight;return{left:Math.round(w*.34),top:Math.round(h*.46),bottom:Math.round(h*.26),right:0}};
function placePuck(){if(!host||!puck)return;const w=host.clientWidth,h=host.clientHeight,p=pad();puck.style.left=(p.left+(w-p.left-p.right)/2)+'px';puck.style.top=(p.top+(h-p.top-p.bottom)/2)+'px'}
function addLayers(){
  if(!map||map.getSource('car-route'))return;
  map.addSource('car-route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:route||[]}}});
  const before=(map.getStyle().layers||[]).find(l=>l.type==='symbol')?.id;
  map.addLayer({id:'car-route-glow',type:'line',source:'car-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#9b4dff','line-width':24,'line-blur':10,'line-opacity':.4}},before);
  map.addLayer({id:'car-route-casing',type:'line',source:'car-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#1c0d36','line-width':15}},before);
  map.addLayer({id:'car-route-line',type:'line',source:'car-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#a35bff','line-width':10}},before);
}
async function show({el,token,center,coords}){
  const was=shown;shown=true;if(Array.isArray(coords)){route=coords;setRoute(route)}
  if(map){if(ready&&!was){map.resize();placePuck()}return true}
  if(!el||!token||failed)return false;
  if(creating)return creating;
  host=el;
  creating=create(el,token,center).finally(()=>{creating=null});
  return creating
}
async function create(el,token,center){
  try{
    const gl=await loadLib();if(!shown)return false;
    if(map)return true;
    gl.accessToken=token;loads++;
    map=new gl.Map({container:el,style:STYLE,center:center||[5.1,52.1],zoom:15,pitch:PITCH,bearing:0,interactive:false,attributionControl:false,fadeDuration:0,maxPitch:60,localIdeographFontFamily:false});
    map.addControl(new gl.AttributionControl({compact:true}),'bottom-right');
    puck=document.createElement('div');puck.className='car-map-puck';puck.innerHTML=PUCK;el.appendChild(puck);placePuck();
    map.on('style.load',()=>{ready=true;map.resize();addLayers();if(cam)follow(cam);placePuck()});
    map.on('error',e=>{const m=String(e?.error?.message||e?.message||'');if(!ready&&/style|401|403|access token|webgl/i.test(m))failed=m.slice(0,120)||'kaartfout'});
    window.addEventListener('resize',()=>{if(map&&ready){map.resize();placePuck()}});
    return true
  }catch(e){failed=String(e?.message||e).slice(0,120);return false}
}
function setRoute(coords){
  if(Array.isArray(coords))route=coords;
  if(!map||!ready)return;addLayers();
  map.getSource('car-route')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:route||[]}})
}
const zoomFor=kmh=>!Number.isFinite(kmh)||kmh<25?16.2:kmh<60?15.6:kmh<95?15:14.4;
function follow({lon,lat,bearing,kmh}){
  cam={lon,lat,bearing,kmh};
  if(!map||!ready||!shown||!Number.isFinite(lon)||!Number.isFinite(lat))return;
  map.easeTo({center:[lon,lat],bearing:Number.isFinite(bearing)?bearing:map.getBearing(),zoom:zoomFor(kmh),pitch:PITCH,padding:pad(),duration:900,easing:t=>t,essential:true})
}
function hide(){shown=false;try{map?.stop?.()}catch{/* kaart al weg: onschuldig */}}
function destroy(){shown=false;ready=false;cam=null;route=null;try{map?.remove?.()}catch{/* kaart al weg: onschuldig */}map=null;puck=null;if(host)host.textContent='';host=null}
window.MAIRCarMap={show,hide,destroy,follow,setRoute,project:(lon,lat)=>{try{return map&&ready?map.project([lon,lat]):null}catch{return null}},puckAt:()=>puck?{x:puck.offsetLeft+puck.offsetWidth/2,y:puck.offsetTop+puck.offsetHeight/2}:null,status:()=>({created:!!map,ready,shown,failed,loads,bearing:map&&ready?map.getBearing():null,zoom:map&&ready?map.getZoom():null,hasRoute:!!(route&&route.length)})};
})();
