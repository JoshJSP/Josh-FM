// MAIR busradio: pure logica (geen DOM, geen netwerk). Rit = antwoord van /api/bus: {start,end,legs:[...]}.
// Fases lopen alleen vooruit: wachten > in-1 (eerste bus) > overstap > in-2 (tweede bus) > aangekomen.
(()=>{
'use strict';
const root=typeof window!=='undefined'?window:globalThis;
if(root.MAIRBusCore)return;
const ORDER=['wachten','in-1','overstap','in-2','aangekomen'];
const WALK_MIN=2,BUS_MS=4;// sneller dan 4 m/s (14 km/h) is geen lopen meer
const ms=t=>Date.parse(t);
const mins=(a,b)=>Math.round((ms(a)-ms(b))/60000);
const hm=t=>new Date(t).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'});
const buses=rit=>(rit?.legs||[]).filter(l=>l.mode!=='WALK');
function dist(a,b){const R=6371000,r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lon-a.lon),h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
// Google-polyline, Transitous gebruikt precisie 7 (zie api/bus.js precision).
function decode(str,precision=7){const f=10**(precision??7),out=[];let i=0,lat=0,lon=0;const next=()=>{let r=0,s=0,b;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5}while(b>=32&&i<=str.length);return r&1?~(r>>1):r>>1};while(i<(str||'').length){lat+=next();lon+=next();out.push({lat:lat/f,lon:lon/f})}return out}
// Afstand tot een lijn: vlakke benadering per segment, ruim goed genoeg op 100 m schaal.
function distToLine(p,line){let best=Infinity;const k=Math.cos(p.lat*Math.PI/180)*111320,m=111320;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],ax=(a.lon-p.lon)*k,ay=(a.lat-p.lat)*m,bx=(b.lon-p.lon)*k,by=(b.lat-p.lat)*m,dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l)):0;best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy))}return line.length===1?dist(p,line[0]):best}
const lineOf=leg=>leg._line||(leg._line=leg.polyline?decode(leg.polyline,leg.precision):[leg.from,...(leg.stops||[]),leg.to]);
// Overstap: tijd tussen aankomst van bus 1 en vertrek van bus 2, min 2 minuten lopen (Tol West en Tol Oost hebben een perronwissel).
function transfer(rit){const[b1,b2]=buses(rit);if(!b1||!b2)return null;const margin=mins(b2.start,b1.end)-WALK_MIN;return{margin,status:b2.cancelled||margin<0?'gemist':margin<2?'krap':'gehaald',at:b2.start,lijn:b2.lijn}}
// De volgende tweede bus die je nog haalt na aankomst van jouw eerste bus.
function nextConnection(ritten,rit){const[b1,b2]=buses(rit);if(!b1)return null;const after=ms(b1.end)+WALK_MIN*60000;return(ritten||[]).map(r=>buses(r)[1]).filter(l=>l&&!l.cancelled&&l.tripId!==b2?.tripId&&ms(l.start)>=after).sort((a,b)=>ms(a.start)-ms(b.start))[0]||null}
// Rit kiezen terwijl je wacht: de eerste die nog niet weg is (1 minuut speling).
function pick(ritten,now){return(ritten||[]).filter(r=>buses(r).length===2&&!buses(r)[0].cancelled).find(r=>ms(buses(r)[0].start)>=now-60000)||null}
// Waar is de bus nu? Lineair tussen de haltes op basis van de verwachte tijden.
function busPos(leg,now){const pts=[{...leg.from,t:ms(leg.start)},...(leg.stops||[]).map(s=>({...s,t:ms(s.arrival||s.departure)})),{...leg.to,t:ms(leg.end)}].filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.lat));if(!pts.length)return null;if(now<=pts[0].t)return{lat:pts[0].lat,lon:pts[0].lon};for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(now<=b.t){const f=b.t>a.t?(now-a.t)/(b.t-a.t):1;return{lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f}}}const z=pts[pts.length-1];return{lat:z.lat,lon:z.lon}}
// Waar zit Josh? Met GPS: op de route en sneller dan lopen. Zonder GPS: volgens de klok.
function detect(rit,pos,now){
  const[b1,b2]=buses(rit);if(!b1||!b2)return null;
  if(pos&&Number.isFinite(pos.lat)){
    const fast=Number(pos.speed)>BUS_MS;
    if(dist(pos,b2.to)<150)return'aangekomen';
    // Bij de overstap liggen beide routes over elkaar: pas in-2 als je 250 m van de overstaphalte weg bent.
    if(distToLine(pos,lineOf(b2))<120&&dist(pos,b1.to)>250&&(fast||dist(pos,b2.from)>400))return'in-2';
    if(dist(pos,b1.to)<200)return fast?null:'overstap';
    if(distToLine(pos,lineOf(b1))<120&&(fast&&now>=ms(b1.start)-180000||dist(pos,b1.from)>400))return'in-1';
    if(dist(pos,b1.from)<300)return'wachten';
    return null
  }
  if(now>=ms(b2.end))return'aangekomen';if(now>=ms(b2.start))return'in-2';if(now>=ms(b1.end))return'overstap';if(now>=ms(b1.start))return'in-1';return'wachten'
}
const later=(a,b)=>ORDER.indexOf(b)>ORDER.indexOf(a)?b:a;
// Aankomen telt alleen als je eerst in de bus zat: bij school de app openen is geen rit.
function phase(prev,rit,pos,now){const d=detect(rit,pos,now);if(!d||d==='aangekomen'&&(!prev||prev==='wachten'))return prev||'wachten';return prev?later(prev,d):d}
// Halverwege starten: welke rit rijdt nu het dichtst bij Josh?
function locate(ritten,pos,now){let best=null;for(const r of ritten||[]){const[b1,b2]=buses(r);if(!b2)continue;for(const[leg,ph]of[[b1,'in-1'],[b2,'in-2']]){if(now<ms(leg.start)-120000||now>ms(leg.end)+120000)continue;const bp=busPos(leg,now),d=bp&&pos?dist(pos,bp):Infinity;if(distToLine(pos,lineOf(leg))<150&&(!best||d<best.d))best={rit:r,phase:ph,d}}}return best}
const delay=leg=>leg?Math.max(0,mins(leg.end,leg.scheduledEnd||leg.end)):0;
const place=dir=>dir==='terug'?'in Vianen':'op school';
const where=leg=>String(leg?.to?.name||'').replace(/^[^,]*,\s*/,'');
// DJ-teksten, kort (Josh 25-11): "Je zit in de 500, overstap om 08:12, je bent om 08:30 op school".
function startLine(rit,ph,dir){const[b1,b2]=buses(rit);if(ph==='in-2'||ph==='overstap')return`Je zit in de ${b2.lijn}, je bent om ${hm(b2.end)} ${place(dir)}.`;return`Je zit in de ${b1.lijn}, overstap om ${hm(b2.start)}, je bent om ${hm(b2.end)} ${place(dir)}.`}
function soonLine(rit){const[b1,b2]=buses(rit),t=transfer(rit);const krap=t?.status==='krap'?` Het wordt krap.`:'';return`Zo overstappen in ${where(b1)}. De ${b2.lijn} gaat om ${hm(b2.start)}.${krap}`}
function delayLine(leg,dir,final=leg){const d=delay(leg);return`De ${leg.lijn} heeft ${d} ${d===1?'minuut':'minuten'} vertraging. Je bent om ${hm(final.end)} ${place(dir)}.`}
function missedLine(rit,next,dir){const b2=buses(rit)[1];const head=`Je haalt de ${b2.lijn} van ${hm(b2.start)} niet.`;return next?`${head} De volgende gaat om ${hm(next.start)}, dan ben je om ${hm(next.end)} ${place(dir)}.`:`${head} Ik zie nog geen volgende ${b2.lijn}.`}
// Bij aankomst: zelfde vorm als Car Mode (mair_car_rides_v1, arrivalLine). diff = later dan gepland.
function summary(rit,boardedAt,arrivedAt){const b2=buses(rit)[1];return{min:Math.max(1,Math.round((arrivedAt-boardedAt)/60000)),diff:b2?.scheduledEnd?Math.round((arrivedAt-ms(b2.scheduledEnd))/60000):null}}
// Terugval: oude ritten naar vandaag schuiven (vaste dienstregeling, zelfde tijd van de dag).
function shiftToToday(ritten,now){const day=86400000,first=ms(buses(ritten?.[0])[0]?.start);if(!Number.isFinite(first))return ritten||[];const off=Math.floor((now+3600000)/day)-Math.floor((first+3600000)/day);if(!off)return ritten;const sh=t=>t&&new Date(ms(t)+off*day).toISOString();const leg=l=>({...l,_line:undefined,start:sh(l.start),end:sh(l.end),scheduledStart:sh(l.scheduledStart),scheduledEnd:sh(l.scheduledEnd),realTime:false,stops:(l.stops||[]).map(s=>({...s,arrival:sh(s.arrival),departure:sh(s.departure),scheduledArrival:sh(s.scheduledArrival),scheduledDeparture:sh(s.scheduledDeparture),alerts:[]}))});return ritten.map(r=>({...r,start:sh(r.start),end:sh(r.end),legs:r.legs.map(leg)}))}
const alerts=rit=>[...new Set(buses(rit).flatMap(l=>[...(l.from?.alerts||[]),...(l.stops||[]).flatMap(s=>s.alerts||[])]))];
root.MAIRBusCore={ORDER,buses,decode,dist,distToLine,lineOf,transfer,nextConnection,pick,busPos,detect,phase,locate,delay,hm,mins,startLine,soonLine,delayLine,missedLine,summary,shiftToToday,alerts,place};
})();
