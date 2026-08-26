import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../transition-controller.js',import.meta.url),'utf8');
class Bus{constructor(){this.listeners=new Map()}addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn)}dispatchEvent(e){for(const fn of this.listeners.get(e.type)||[])fn(e);return true}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
function harness(){const bus=new Bus(),out=[];const window={addEventListener:(...a)=>bus.addEventListener(...a),dispatchEvent:e=>{if(e.type==='mair:track-transition')out.push(e.detail);return bus.dispatchEvent(e)},JFMPlaybackState:{get:()=>({trackId:'A',sequence:1})}};const context={window,CustomEvent,Date};vm.createContext(context);vm.runInContext(source,context);const state=(id,sequence)=>bus.dispatchEvent(new CustomEvent('jfm:playback-state',{detail:{state:{trackId:id,sequence,source:'test'}}}));return{window,bus,out,state}}

{
  const h=harness();h.window.MAIRTransitionController.mark('NEXT',{fromTrackId:'A'});h.state('B',2);
  assert.equal(h.out.length,1);assert.equal(h.out[0].cause,'USER_NEXT');assert.equal(h.out[0].confidence,1);assert.ok(h.out[0].transitionId);assert.ok(h.out[0].userActionId);assert.equal(h.out[0].fromTrack.trackId,'A');assert.equal(h.out[0].toTrack.trackId,'B')
}
{
  const h=harness();h.bus.dispatchEvent(new CustomEvent('jfm:natural-track-end',{detail:{trackId:'A',positionMs:199000,durationMs:200000}}));h.state('B',2);h.state('B',2);
  assert.equal(h.out.length,1,'dezelfde snapshot mag geen dubbele transition geven');assert.equal(h.out[0].cause,'NATURAL_END')
}
{
  const h=harness();h.state('B',2);assert.equal(h.out[0].cause,'EXTERNAL_CHANGE','geen eigen actie en geen end-evidence is extern, niet natuurlijk')
}
{
  const h=harness();for(let i=0;i<10;i++){const from=i?`T${i}`:'A',to=`T${i+1}`;h.window.MAIRTransitionController.mark('NEXT',{fromTrackId:from});h.state(to,i+2)}assert.equal(h.out.length,10);assert.ok(h.out.every(x=>x.cause==='USER_NEXT'),'10 snelle next-acties blijven expliciete user transitions')
}
{
  const h=harness(),id=h.window.MAIRTransitionController.mark('STATION_CHANGE',{fromTrackId:'A',expectedTrackId:'B'});assert.equal(h.window.MAIRTransitionController.cancel(id,'failed'),true);h.state('B',2);assert.equal(h.out[0].cause,'EXTERNAL_CHANGE')
}
{
  const h=harness();h.window.MAIRTransitionController.mark('REQUEST',{fromTrackId:'A',expectedTrackId:'C',ttlMs:600000});h.window.MAIRTransitionController.mark('NEXT',{fromTrackId:'A'});h.state('B',2);h.state('C',3);assert.deepEqual(h.out.map(x=>x.cause),['USER_NEXT','REQUEST'])
}
{
  const h=harness();h.window.MAIRTransitionController.mark('PREVIOUS',{fromTrackId:'A'});h.state('Z',2);assert.equal(h.out[0].cause,'USER_PREVIOUS')
}
{
  const h=harness();h.window.MAIRTransitionController.mark('NEXT',{fromTrackId:'A'});h.state('B',2);h.window.MAIRTransitionController.mark('PREVIOUS',{fromTrackId:'B'});h.state('A',3);assert.deepEqual(h.out.map(x=>x.cause),['USER_NEXT','USER_PREVIOUS'])
}
{
  const h=harness();h.window.MAIRTransitionController.mark('STATION_CHANGE',{fromTrackId:'A'});h.state('S',2);assert.equal(h.out[0].cause,'STATION_CHANGE')
}
{
  const h=harness();h.window.MAIRTransitionController.mark('RECOVERY',{fromTrackId:'A'});h.state('R',2);assert.equal(h.out[0].cause,'RECOVERY')
}
{
  const h=harness();h.window.MAIRTransitionController.natural({trackId:'A',positionMs:1000,durationMs:200000,source:'bad-evidence'});h.state('B',2);assert.equal(h.out[0].cause,'EXTERNAL_CHANGE','zwakke eind-evidence mag nooit natural worden')
}
{
  const h=harness(),t=h.window.MAIRTransitionController.accept({trackId:'B',sequence:2},{source:''});assert.equal(t.cause,'UNKNOWN');assert.notEqual(t.cause,'NATURAL_END')
}
{
  const h=harness();h.state('B',2);h.state('B',3);assert.equal(h.out.length,1,'SDK + polling van dezelfde track levert maximaal één canonical transition')
}
console.log('MAIR transition controller: 13/13 PASS');
