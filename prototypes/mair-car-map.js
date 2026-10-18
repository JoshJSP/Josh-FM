// MAIRFM Car Mode: de kaart (Mapbox GL JS, donkere navigatiestijl) in het kaartvak links van het C2-scherm.
// - mapbox-gl komt uit vendor/mapbox-gl (CSP: script-src 'self') en wordt pas geladen als het rijscherm open is.
// - Eén kaart per Car Mode-sessie: hide() verbergt hem alleen, destroy() (Car Mode dicht) ruimt hem op.
//   Elke `new Map` telt als een betaalde kaartlading bij Mapbox, dus nooit opnieuw opbouwen tijdens het rijden.
//   Eén uitzondering: de WebGL-context is kwijt en komt niet terug (iOS in de achtergrond). Dan is de kaart zwart
//   en is opnieuw opbouwen de enige weg terug.
// - Valt de kaart uit (geen token, geen netwerk, geen WebGL), dan blijft de rest van Car Mode gewoon werken.
(()=>{
'use strict';
if(window.MAIRCarMap)return;
const BASE='vendor/mapbox-gl/',STYLE='mapbox://styles/mapbox/navigation-night-v1',PITCH=55,FREE_MS=6000,LOST_MS=3000,MIN_ZOOM=3;
let libP=null,creating=null,map=null,host=null,puck=null,back=null,ready=false,failed='',loads=0,route=null,cam=null,shown=false,tok='';
let camData={type:'FeatureCollection',features:[]};
let free=false,freeTimer=null,lost=false,lostTimer=null,rebuilds=0,tileReloads=0,reloadTimer=null,reloadAt=0,hiddenAt=0;
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
// In volgmodus staat de pijl vast op het punt waar de camera naartoe kijkt (padding), de kaart draait eromheen.
const PUCK='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 54 54 32 44 10 54z" fill="#fff" stroke="#9b4dff" stroke-width="4" stroke-linejoin="round"/></svg>';
// Volgt de kaart, dan staat de pijl vast midden onder in het kaartvak (75% van de hoogte), zodat je vooral de weg vóór je ziet.
// Schuift of zoomt Josh zelf, dan staat de pijl op de echte positie (en draait mee met de rijrichting), of is hij weg als die buiten beeld is.
const pad=()=>{const h=host.clientHeight;return{left:0,top:Math.round(h*.55),bottom:Math.round(h*.05),right:0}};
function placePuck(){
  if(!host||!puck)return;const w=host.clientWidth,h=host.clientHeight;let x,y,turn=0;
  if(free&&cam&&map&&ready){const q=map.project([cam.lon,cam.lat]);x=q.x;y=q.y;if(Number.isFinite(cam.bearing))turn=cam.bearing-map.getBearing()}
  else{const p=pad();x=p.left+(w-p.left-p.right)/2;y=p.top+(h-p.top-p.bottom)/2}
  puck.hidden=!(x>=0&&y>=0&&x<=w&&y<=h);puck.style.left=x+'px';puck.style.top=y+'px';puck.style.transform=turn?`rotate(${turn}deg)`:''
}
// De kaart tekent alleen de wereld zelf (Mercator, tot 85° noord). Schuin bekeken en ver uitgezoomd kijk je voorbij die rand
// en blijft een stuk zwart. Daarom wordt de kaart bij uitzoomen platter (zoom 11 schuin, zoom 6 en verder plat).
const pitchFor=z=>Math.max(0,Math.min(PITCH,(z-6)/5*PITCH));
// setPitch stopt een lopende wiel- of knijpzoom (jumpTo -> _stop), dus tijdens het zoomen de kanteling direct op de camera zetten.
// ponytail: interne transform van mapbox-gl 3.33 (vendored); bestaat hij na een update niet meer, dan setPitch als terugval.
function flatten(){
  if(!free||!map)return;const p=pitchFor(map.getZoom());if(Math.abs(map.getPitch()-p)<=.5)return;
  const tr=map.transform;if(tr&&'pitch' in tr){tr.pitch=p;map.triggerRepaint()}else map.setPitch(p);
  placePuck()
}
// De route ligt boven alle wegen, ook bruggen en kruisingen; alleen tekst en iconen mogen erboven. De stijl heeft
// al vroeg symbol-lagen (eenrichtingspijlen) met daarna nog weg- en bruglagen, dus: na de laatste niet-symbol-laag.
function labelsFrom(){
  const ls=map.getStyle().layers||[];let last=-1;
  ls.forEach((l,i)=>{if(l.type!=='symbol'&&!/^car-route/.test(l.id))last=i});
  return ls.slice(last+1).find(l=>l.type==='symbol')?.id
}
function addLayers(){
  if(!map||map.getSource('car-route'))return;
  map.addSource('car-route',{type:'geojson',lineMetrics:true,data:{type:'Feature',geometry:{type:'LineString',coordinates:route||[]}}});
  const before=labelsFrom();
  // Route: dikke lichtpaarse lijn met donkere rand, de enige gekleurde lijn op de kaart. De verkeerslagen van de
  // navigatiestijl kleuren elke weg groen/oranje en verstopten de route, dus die gaan uit. Het gereden stuk vervaagt.
  for(const l of map.getStyle().layers||[])if(/traffic|congestion/i.test(l.id))map.setLayoutProperty(l.id,'visibility','none');
  const L={'line-cap':'round','line-join':'round'},W=(a,b)=>['interpolate',['linear'],['zoom'],12,a,17,b];
  map.addLayer({id:'car-route-done',type:'line',source:'car-route',layout:L,paint:{'line-color':'#8d84a0','line-width':W(5,10),'line-opacity':.35}},before);
  map.addLayer({id:'car-route-glow',type:'line',source:'car-route',layout:L,paint:{'line-color':'#b56dff','line-width':W(20,34),'line-blur':12,'line-opacity':.45}},before);
  map.addLayer({id:'car-route-casing',type:'line',source:'car-route',layout:L,paint:{'line-color':'#2a0d52','line-width':W(12,22)}},before);
  map.addLayer({id:'car-route-line',type:'line',source:'car-route',layout:L,paint:{'line-color':'#c98bff','line-width':W(8,15)}},before);
  setProgress(progressNow);
}
// Flitsers (mair-car-cams.js): een klein rood icoon per vaste flitser of begin/einde van een trajectcontrole, boven de route.
function camImage(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.fillStyle='#d62f3a';x.strokeStyle='#fff';x.lineWidth=5;x.beginPath();x.roundRect(5,5,54,54,15);x.fill();x.stroke();
  x.strokeStyle='#fff';x.lineWidth=4.5;x.lineJoin='round';x.beginPath();x.moveTo(15,25);x.lineTo(24,25);x.lineTo(27,19);x.lineTo(37,19);x.lineTo(40,25);x.lineTo(49,25);x.lineTo(49,47);x.lineTo(15,47);x.closePath();x.stroke();
  x.beginPath();x.arc(32,36,6.5,0,7);x.stroke();
  return x.getImageData(0,0,64,64)
}
function addCams(){
  if(!map||!ready||map.getSource('car-cams'))return;
  try{
    if(!map.hasImage('car-cam'))map.addImage('car-cam',camImage(),{pixelRatio:2});
    map.addSource('car-cams',{type:'geojson',data:camData});
    map.addLayer({id:'car-cams',type:'symbol',source:'car-cams',layout:{'icon-image':'car-cam','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-pitch-alignment':'viewport','icon-size':['interpolate',['linear'],['zoom'],11,['case',['==',['get','on'],1],.75,.55],17,['case',['==',['get','on'],1],1.35,1]]}})
  }catch(e){try{window.MAIRRuntime?.caught?.('carmode.cams-layer',e)}catch{/* log kapot: onschuldig */}/* de kaart zelf blijft werken */}
}
function setCams(f){
  camData={type:'FeatureCollection',features:Array.isArray(f)?f:[]};
  if(!map||!ready)return;addCams();map.getSource('car-cams')?.setData(camData)
}
async function show({el,token,center,coords}){
  const was=shown;shown=true;if(Array.isArray(coords)){route=coords;setRoute(route)}
  if(map){if(ready&&!was){map.resize();placePuck()}return true}
  if(!el||!token||failed)return false;
  if(creating)return creating;
  host=el;tok=token;
  creating=create(el,token,center).finally(()=>{creating=null});
  return creating
}
// Wegschuiven en zoomen mag. Dan volgt de kaart even niet, verschijnt "Terug" en na FREE_MS gaat hij vanzelf terug.
function release(e){if(!e?.originalEvent)return;free=true;if(back)back.hidden=false;clearTimeout(freeTimer);freeTimer=setTimeout(recenter,FREE_MS);placePuck()}
function recenter(){clearTimeout(freeTimer);free=false;if(back)back.hidden=true;placePuck();if(cam)follow(cam)}
async function create(el,token,center){
  try{
    const gl=await loadLib();if(!shown)return false;
    if(map)return true;
    gl.accessToken=token;loads++;
    map=new gl.Map({container:el,style:STYLE,center:center||[5.1,52.1],zoom:15,pitch:PITCH,bearing:0,interactive:true,dragRotate:false,pitchWithRotate:false,keyboard:false,doubleClickZoom:false,touchPitch:false,attributionControl:false,fadeDuration:0,maxPitch:60,minZoom:MIN_ZOOM,localIdeographFontFamily:false});
    map.touchZoomRotate.disableRotation();
    map.addControl(new gl.AttributionControl({compact:true}),'bottom-right');
    puck=document.createElement('div');puck.className='car-map-puck';puck.innerHTML=PUCK;el.appendChild(puck);placePuck();
    back=document.createElement('button');back.type='button';back.className='car-map-back';back.hidden=true;back.textContent='⌖ Terug';back.setAttribute('aria-label','Kaart terug naar je positie');
    back.addEventListener('click',e=>{e.stopPropagation();recenter()});el.appendChild(back);
    for(const n of ['dragstart','drag','zoomstart','zoom','dragend','zoomend'])map.on(n,release);
    map.on('zoom',flatten);map.on('move',()=>{if(free)placePuck()});
    map.on('style.load',()=>{ready=true;map.resize();addLayers();addCams();if(cam)follow(cam);placePuck()});
    map.on('error',e=>{const m=String(e?.error?.message||e?.message||'');if(!ready&&/style|401|403|access token|webgl/i.test(m))failed=m.slice(0,120)||'kaartfout';else if(ready&&e?.sourceId&&!/^car-/.test(e.sourceId))reloadTiles()});
    // Mapbox herstelt een teruggegeven context zelf. Komt hij niet terug, dan blijft de kaart zwart: opnieuw opbouwen.
    map.on('webglcontextlost',()=>{lost=true;clearTimeout(lostTimer);lostTimer=setTimeout(()=>{if(lost&&document.visibilityState==='visible')rebuild()},LOST_MS)});
    map.on('webglcontextrestored',()=>{lost=false;clearTimeout(lostTimer);try{map.triggerRepaint()}catch{/* kaart al weg: onschuldig */}});
    // Het kaartvak wordt groter of kleiner (bovenbalk weg/terug, draaien): kaart en pijl lopen mee.
    new ResizeObserver(()=>{if(map&&ready){map.resize();placePuck();if(cam&&!free)follow(cam)}}).observe(el);
    return true
  }catch(e){failed=String(e?.message||e).slice(0,120);return false}
}
// Zwarte kaart: alles weg en opnieuw, met dezelfde route, voortgang en camera.
function rebuild(){
  if(!host||!tok||!shown)return;
  const el=host;clearTimeout(lostTimer);lost=false;rebuilds++;
  try{map?.remove?.()}catch{/* context al weg: onschuldig */}
  map=null;ready=false;puck=null;back=null;free=false;el.textContent='';
  creating=create(el,tok,cam?[cam.lon,cam.lat]:undefined).finally(()=>{creating=null})
}
// Tegels die mislukten (geen bereik) blijven anders leeg. Even later alle tegels opnieuw ophalen, hooguit eens per 15 s.
function reloadTiles(){
  if(reloadTimer)return;
  reloadTimer=setTimeout(()=>{
    reloadTimer=null;if(!map||!ready)return;
    if(!navigator.onLine)return void window.addEventListener('online',reloadTiles,{once:true});
    if(Date.now()-reloadAt<15000)return void reloadTiles();
    reloadAt=Date.now();tileReloads++;
    for(const id of Object.keys(map.getStyle().sources||{}))if(!/^car-/.test(id))try{map.getSource(id)?.reload?.()}catch{/* bron zonder reload: onschuldig */}
  },4000)
}
const glLost=()=>{try{const c=map?.getCanvas?.(),g=c&&(c.getContext('webgl2')||c.getContext('webgl'));return!!g&&g.isContextLost()}catch{return false}};
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'){hiddenAt=Date.now();return}
  if(!map||!shown)return;
  if(lost||glLost()){lost=true;clearTimeout(lostTimer);lostTimer=setTimeout(()=>{if(lost)rebuild()},1000);return}
  try{map.resize();map.triggerRepaint()}catch{/* kaart al weg: onschuldig */}
  if(hiddenAt&&Date.now()-hiddenAt>60000)reloadTiles()
});
let progressNow=0;
function setProgress(f){
  progressNow=Math.max(0,Math.min(.999,Number(f)||0));
  if(!map||!ready||!map.getLayer('car-route-line'))return;
  for(const id of ['car-route-glow','car-route-casing','car-route-line'])map.setPaintProperty(id,'line-trim-offset',[0,progressNow])
}
function setRoute(coords){
  if(Array.isArray(coords))route=coords;
  if(!map||!ready)return;addLayers();
  map.getSource('car-route')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:route||[]}})
}
const zoomFor=kmh=>!Number.isFinite(kmh)||kmh<25?16.2:kmh<60?15.6:kmh<95?15:14.4;
function follow({lon,lat,bearing,kmh}){
  cam={lon,lat,bearing,kmh};
  if(free)placePuck();
  if(free||!map||!ready||!shown||!Number.isFinite(lon)||!Number.isFinite(lat))return;
  map.easeTo({center:[lon,lat],bearing:Number.isFinite(bearing)?bearing:map.getBearing(),zoom:zoomFor(kmh),pitch:PITCH,padding:pad(),duration:900,easing:t=>t,essential:true})
}
function hide(){shown=false;try{map?.stop?.()}catch{/* kaart al weg: onschuldig */}}
function destroy(){shown=false;progressNow=0;ready=false;cam=null;route=null;free=false;lost=false;clearTimeout(freeTimer);clearTimeout(lostTimer);clearTimeout(reloadTimer);reloadTimer=null;try{map?.remove?.()}catch{/* kaart al weg: onschuldig */}map=null;puck=null;back=null;if(host)host.textContent='';host=null}
window.MAIRCarMap={show,hide,destroy,follow,setRoute,setProgress,setCams,recenter,project:(lon,lat)=>{try{return map&&ready?map.project([lon,lat]):null}catch{return null}},puckAt:()=>puck?{x:puck.offsetLeft+puck.offsetWidth/2,y:puck.offsetTop+puck.offsetHeight/2}:null,status:()=>({created:!!map,ready,shown,failed,loads,free,lost,rebuilds,tileReloads,tilesLoaded:map&&ready?map.areTilesLoaded():null,bearing:map&&ready?map.getBearing():null,zoom:map&&ready?map.getZoom():null,pitch:map&&ready?map.getPitch():null,hasRoute:!!(route&&route.length),layers:map&&ready?(map.getStyle().layers||[]).map(l=>l.id):[],camLayer:!!(map&&ready&&map.getLayer('car-cams')),camCount:camData.features.length,routeLayers:map&&ready?['car-route-done','car-route-glow','car-route-casing','car-route-line'].filter(id=>map.getLayer(id)).length:0})};
})();
