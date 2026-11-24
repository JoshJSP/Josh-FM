// Busradio-logica: overstap gehaald/krap/gemist, volgende 502, instappen, halverwege starten (Josh 25-11).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../mair-bus-core.js',import.meta.url),'utf8'),ctx);
const B=ctx.MAIRBusCore;
const T=hm=>`2026-11-25T${String(+hm.slice(0,2)-1).padStart(2,'0')}:${hm.slice(3)}:00Z`;// Nederlandse tijd > UTC
const LEK={lat:51.9909,lon:5.0826},GOR={lat:51.85,lon:4.98},TOLW={lat:51.813,lon:4.953},TOLW2={lat:51.8131,lon:4.9533},MID={lat:51.70,lon:4.87},CLA={lat:51.5866,lon:4.7926};
const leg=(lijn,from,to,via,s,e,x={})=>({mode:'BUS',lijn,from:{name:'X, '+lijn+'-van',...from},to:{name:lijn==='500'?'Sleeuwijk, Tol West':'Breda, Claudius Prinsenlaan',...to},stops:[{...via,arrival:x.via||s}],start:T(s),end:T(e),scheduledStart:T(x.ss||s),scheduledEnd:T(x.se||e),tripId:lijn+s,polyline:'',cancelled:!!x.cancelled});
const rit=(s1,e1,s2,e2,x={})=>({legs:[leg('500',LEK,TOLW,GOR,s1,e1,x.a),{mode:'WALK'},leg('502',TOLW2,CLA,MID,s2,e2,x.b)]});
const r1=rit('07:51','08:15','08:17','08:48'),r2=rit('08:21','08:45','08:47','09:18'),ritten=[r1,r2];
r1.legs[0].stops[0].arrival=T('08:03');r1.legs[2].stops[0].arrival=T('08:32');r2.legs[0].stops[0].arrival=T('08:33');r2.legs[2].stops[0].arrival=T('09:02');
const at=hm=>Date.parse(T(hm));
// overstap
assert.equal(B.transfer(r1).status,'krap');assert.equal(B.transfer(r1).margin,0);
assert.equal(B.transfer(rit('07:51','08:12','08:17','08:48')).status,'gehaald');
assert.equal(B.transfer(rit('07:51','08:18','08:17','08:48')).status,'gemist');
assert.equal(B.transfer(rit('07:51','08:10','08:17','08:48',{b:{cancelled:true}})).status,'gemist');
const late=rit('07:51','08:18','08:17','08:48');
assert.equal(B.nextConnection([late,r2],late).start,T('08:47'),'volgende 502 na de gemiste');
assert.equal(B.nextConnection([late],late),null);
// rit kiezen
assert.equal(B.pick(ritten,at('07:45')),r1);assert.equal(B.pick(ritten,at('07:53')),r2);
// instappen en fases
const P=(p,speed=0)=>({...p,speed});
assert.equal(B.phase(null,r1,P(LEK),at('07:45')),'wachten');
assert.equal(B.phase('wachten',r1,P(LEK,1),at('07:51')),'wachten','stilstaan bij de halte is nog wachten');
assert.equal(B.phase('wachten',r1,P(LEK,9),at('07:51')),'in-1','sneller dan lopen rond vertrektijd = ingestapt');
assert.equal(B.phase('wachten',r1,P(LEK,9),at('07:20')),'wachten','auto langs de halte ver voor vertrek telt niet');
assert.equal(B.phase('wachten',r1,P(GOR,15),at('08:03')),'in-1');
assert.equal(B.phase('in-1',r1,P(TOLW2,12),at('08:14')),'in-1','met de 500 de overstaphalte inrijden is nog geen 502');
assert.equal(B.phase('in-1',r1,P(TOLW,0),at('08:15')),'overstap');
assert.equal(B.phase('overstap',r1,P(MID,20),at('08:32')),'in-2');
assert.equal(B.phase('in-2',r1,P(CLA,0),at('08:48')),'aangekomen');
assert.equal(B.phase('in-2',r1,P(LEK,0),at('08:40')),'in-2','fases gaan nooit terug');
assert.equal(B.phase(null,r1,P(CLA,0),at('07:40')),'wachten','bij school openen is geen aankomst');
assert.equal(B.phase('in-1',r1,P({lat:52.3,lon:4.9}),at('08:00')),'in-1','GPS van de route af: fase blijft');
assert.equal(B.phase(null,r1,null,at('08:20')),'in-2','zonder GPS: op de klok');
// halverwege starten
const loc=B.locate(ritten,P(MID,20),at('08:32'));assert.equal(loc.rit,r1);assert.equal(loc.phase,'in-2');
assert.equal(B.locate(ritten,P({lat:52.3,lon:4.9}),at('08:32')),null);
const bp=B.busPos(r1.legs[0],at('07:57'));assert.ok(Math.abs(bp.lat-(LEK.lat+GOR.lat)/2)<1e-6,'bus halverwege tussen twee haltes');
// teksten
assert.equal(B.startLine(r1,'in-1','heen'),'Je zit in de 500, overstap om 08:17, je bent om 08:48 op school.');
assert.equal(B.startLine(r1,'in-2','terug'),'Je zit in de 502, je bent om 08:48 in Vianen.');
assert.equal(B.missedLine(late,B.nextConnection([late,r2],late),'heen'),'Je haalt de 502 van 08:17 niet. De volgende gaat om 08:47, dan ben je om 09:18 op school.');
assert.equal(B.soonLine(r1),'Zo overstappen in Tol West. De 502 gaat om 08:17. Het wordt krap.');
const d=rit('07:51','08:15','08:17','08:52',{b:{se:'08:48'}});assert.equal(B.delayLine(d.legs[2],'heen'),'De 502 heeft 4 minuten vertraging. Je bent om 08:52 op school.');
// samenvatting, met de zin van Car Mode
const sum=B.summary(r1,at('07:51'),at('08:50'));assert.deepEqual({...sum},{min:59,diff:2});
const c2={addEventListener(){},setTimeout,clearTimeout,localStorage:{getItem:()=>null},document:{visibilityState:'visible'}};c2.window=c2;vm.createContext(c2);vm.runInContext(fs.readFileSync(new URL('../mair-car-ride-dj.js',import.meta.url),'utf8'),c2);
assert.equal(c2.MAIRCarRideDJ.arrivalLine(sum),'Je bent er. 59 minuten onderweg, 2 minuten langer dan gedacht.');
// terugval: oude dienstregeling naar vandaag
const sh=B.shiftToToday(ritten,Date.parse('2026-11-27T06:00:00Z'));assert.equal(sh[0].legs[0].start,'2026-11-27T06:51:00.000Z');assert.equal(sh[0].legs[0].realTime,false);
assert.equal(B.shiftToToday(ritten,at('07:00')),ritten);
// polyline
const pl=B.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@',5);assert.equal(pl.length,3);assert.ok(Math.abs(pl[2].lat-43.252)<1e-9&&Math.abs(pl[2].lon+126.453)<1e-9);
console.log('MAIR bus-logica: PASS');
