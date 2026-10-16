// Car Mode: aankomst, tussenstops, afstandsnotatie (15-10-2026, uitgebreid 16-10-2026).
// Draait de aankomstlogica uit prototypes/mair-car-mode-wave.js los in een vm; de volledige route-rit staat in scripts/e2e/carmode.e2e.mjs.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../prototypes/mair-car-mode-wave.js',import.meta.url),'utf8');
const grab=(re,what)=>{const m=re.exec(src);assert.ok(m,what+' gevonden');return m[0]};
const a=src.indexOf('const ARRIVE_M='),b=src.indexOf('// Resterende afstand');assert.ok(a>0&&b>a,'aankomstblok gevonden');
const havSrc=grab(/const hav=[^\n]*/,'hav'),mpointSrc=grab(/const mpoint=[^\n]*/,'mpoint'),distSrc=grab(/const dist=[^\n]*/,'dist');
const MX=111320*Math.cos(52*Math.PI/180);
const pt=m=>({latitude:52,longitude:5+m/MX});
function run({along,stops=[],legs,dist=0,acc=10,at=0,lastM=25000}){
  const ctx={s:{proj:{along,distance:dist},pos:{...pt(at),accuracy:acc},stops:stops.map(name=>({name,...pt(10000)})),destination:{name:'Eind',...pt(lastM)},routeActive:true,route:{legs:[{steps:[{maneuver:{location:[5+10000/MX,52]}}]}]}},
    legAlong:legs,geom:[pt(0),pt(lastM)],toasts:[],routes:0,
    toast:t=>ctx.toasts.push(t),publish(){},render(){},unwatch(){},stopRefresh(){},recalcAfterStops:async()=>{ctx.routes++}};
  vm.runInNewContext([havSrc,mpointSrc,src.slice(a,b)].join(';').replace(/^(const|let) /gm,'var ')+';globalThis.checkArrival=checkArrival;globalThis.offLimit=offLimit',ctx);return ctx}
const times=(c,n)=>{for(let i=0;i<n;i++)c.checkArrival()};

// valse aankomst: net na de eerste rotonde, 25 km te gaan
{const c=run({along:480,legs:[25000],at:480});times(c,10);assert.equal(c.s.routeActive,true,'geen aankomst na de rotonde');assert.equal(c.toasts.length,0)}
// de oude fout: along dicht bij het einde van de leg zonder in de buurt van de bestemming te zijn
{const c=run({along:24980,legs:[25000],at:2000});times(c,10);assert.equal(c.s.routeActive,true,'along alleen is geen aankomst')}
// vlak langs de bestemming rijden op een weg die nog 3 km route kent: geen aankomst
{const c=run({along:21800,legs:[25000],at:24900});times(c,10);assert.equal(c.s.routeActive,true,'dichtbij maar nog 3 km route: geen aankomst')}
// dichtbij in de lucht, maar niet op de route (andere weg)
{const c=run({along:24900,legs:[25000],at:24900,dist:120});times(c,10);assert.equal(c.s.routeActive,true,'niet op de route: geen aankomst')}
// echte aankomst: 3 geaccepteerde metingen
{const c=run({along:24930,legs:[25000],at:24930,dist:5});times(c,2);assert.equal(c.s.routeActive,true,'pas na drie metingen');c.checkArrival();assert.equal(c.s.routeActive,false,'aankomst bevestigd');assert.match(c.toasts[0],/Je bent bij Eind/)}
// nauwkeurigheid telt mee: 70 m ernaast bij 60 m nauwkeurigheid is nog "op de route"
{const c=run({along:24930,legs:[25000],at:24930,dist:70,acc:60});times(c,3);assert.equal(c.s.routeActive,false,'drempel 1,5x nauwkeurigheid')}
assert.equal(run({along:0,legs:[1],acc:10}).offLimit({accuracy:10}),40);assert.equal(run({along:0,legs:[1]}).offLimit({accuracy:60}),90);
// tussenstop gepasseerd (>50 m voorbij langs de route): weg en route opnieuw
{const c=run({along:10060,stops:['A'],legs:[10000,25000],at:10060});c.checkArrival();assert.deepEqual(c.s.stops.map(x=>x.name),[],'stop A is gepasseerd en weg');assert.equal(c.routes,1,'route opnieuw berekend');assert.equal(c.s.origin.name,'Huidige locatie');times(c,5);assert.equal(c.routes,1,'tot de nieuwe route er is beoordeelt niets de aankomst')}
// onderweg naar de stop: niets
{const c=run({along:5000,stops:['A'],legs:[10000,25000],at:5000});times(c,5);assert.equal(c.s.stops.length,1);assert.equal(c.routes,0)}
// aankomst bij de stop
{const c=run({along:9960,stops:['A'],legs:[10000,25000],at:9960,dist:3});times(c,3);assert.deepEqual(c.s.stops,[],'aangekomen bij A: weg');assert.match(c.toasts[0],/Je bent bij A/);assert.equal(c.s.routeActive,true)}

// afstandsnotatie: één functie, afronden vóór de keuze M/KM
const d=vm.runInNewContext(distSrc.replace(/^const /,'var ')+';dist');
for(const [m,want] of [[0,'0 M'],[4,'0 M'],[230,'230 M'],[994,'990 M'],[995,'1.0 KM'],[1000,'1.0 KM'],[1449,'1.4 KM'],[9949,'9.9 KM'],[9950,'10 KM'],[12400,'12 KM'],[25000,'25 KM'],[NaN,'—'],[-5,'0 M']])assert.equal(d(m),want,`dist(${m})`);
assert.equal((src.match(/const dist=/g)||[]).length,1,'één dist-functie in Car Mode');
assert.ok(!/Math\.max\(10,Math\.round/.test(fs.readFileSync(new URL('../mair-car-stop-metrics.js',import.meta.url),'utf8')),'stop-metrics heeft geen eigen afronding meer');
// stop-metrics doet geen eigen GPS of Mapbox meer
const sm=fs.readFileSync(new URL('../mair-car-stop-metrics.js',import.meta.url),'utf8');
assert.ok(!/getCurrentPosition|mapbox\.com|setInterval/.test(sm),'stop-metrics: geen eigen locatie, Mapbox of timer');
console.log('PASS Car Mode aankomst, tussenstops en afstanden');
