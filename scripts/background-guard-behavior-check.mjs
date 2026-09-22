import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Bus{constructor(){this.listeners=new Map()}addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list)}dispatch(name,detail={}){const event={type:name,detail,stopped:false,stopImmediatePropagation(){this.stopped=true}};for(const fn of this.listeners.get(name)||[]){fn(event);if(event.stopped)break}}}
class FakeCustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
const source=fs.readFileSync(new URL('../mair-background-guard.js',import.meta.url),'utf8');

function harness({expectedLive=true,isPlaying=true,remotePlaying=false,recoverResult=true}={}){
  const winBus=new Bus(),docBus=new Bus(),events=[],metrics={recover:0,ingest:0,expected:0},body=(()=>{const attrs=new Map();return{setAttribute(k,v){attrs.set(k,String(v))},removeAttribute(k){attrs.delete(k)},getAttribute:k=>attrs.has(k)?attrs.get(k):null}})(),state={expectedLive,isPlaying,trackId:'track-a'};
  const document={visibilityState:'visible',body,addEventListener:(...args)=>docBus.addEventListener(...args)};
  const window={addEventListener:(...args)=>winBus.addEventListener(...args),dispatchEvent:event=>{events.push(event.detail);winBus.dispatch(event.type,event.detail);return true},JFMPlaybackState:{get:()=>({...state}),setExpectedLive:on=>{metrics.expected++;state.expectedLive=!!on},ingest:live=>{metrics.ingest++;state.isPlaying=!!live.is_playing}},JFMPlayback:{recover:async()=>{metrics.recover++;return recoverResult}},JFMPWA:{reassertMediaSession(){}},navigator:{mediaSession:{}},document};
  const context={window,document,navigator:window.navigator,CustomEvent:FakeCustomEvent,api:async()=>({item:{id:'track-a'},is_playing:remotePlaying}),setTimeout,clearTimeout,Promise,Date,console};Object.assign(context,window);vm.createContext(context);vm.runInContext(source,context,{filename:'mair-background-guard.js'});
  return{window,document,events,metrics,hide(){document.visibilityState='hidden';docBus.dispatch('visibilitychange')},show(){document.visibilityState='visible';docBus.dispatch('visibilitychange')},pagehide(){winBus.dispatch('pagehide')},naturalEnd(detail={trackId:'track-a'}){winBus.dispatch('jfm:natural-track-end',detail)}}
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stillPlayingNeedsNoRecovery(){const h=harness({remotePlaying:true});h.hide();h.show();await sleep(240);assert.equal(h.metrics.recover,0);assert.equal(h.metrics.ingest,1);assert.ok(h.events.some(x=>x.reason==='visible-still-playing'))}
async function pausedForegroundRecoversOnce(){const h=harness({remotePlaying:false});h.hide();h.show();h.show();await sleep(260);assert.equal(h.metrics.recover,1,'concurrent foreground events may trigger one recovery only');assert.ok(h.events.some(x=>x.reason==='visible-recovered'))}
async function inactiveSessionDoesNotAutostart(){const h=harness({expectedLive:false,isPlaying:false});h.hide();h.show();await sleep(230);assert.equal(h.metrics.recover,0);assert.ok(h.events.some(x=>x.reason==='visible-no-recovery'))}
async function hiddenNaturalEndReachesCentralOwner(){const h=harness();let received=0;h.window.addEventListener('jfm:natural-track-end',()=>{received++});h.hide();h.naturalEnd();assert.equal(received,1,'background guard must never swallow the central natural-end event');assert.ok(h.events.some(x=>x.reason==='hidden-natural-observed'))}

// --- Wake-protocol (ontwerp 2026-09-22, paragraaf 5.2 en 8) -----------------
// Vier van de vijf punten die zonder telefoon aantoonbaar zijn. Het vijfde -
// "de DJ praat door met het scherm uit" - kan hier niet bewezen worden en staat
// bewust niet tussen deze tests.

// 1. De eigenaar is de enige die visibilitychange bindt.
function onlyOwnerBindsVisibility(){
  const owner='mair-background-guard.js';
  const handedIn=['playback-primary.js','progress-clock-v226.js','director.js','mair-dj-break-owed-guard.js','pwa-platform.js','live-ui.js'];
  const bindings=file=>(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').match(/addEventListener\(\s*['"]visibilitychange['"]/g)||[]).length;
  assert.equal(bindings(owner),1,`${owner} hoort precies een visibilitychange te binden`);
  for(const file of handedIn)assert.equal(bindings(file),0,`${file} bindt nog zelf visibilitychange in plaats van op mair:wake te wachten`);
  for(const file of handedIn)assert.ok(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').includes("addEventListener('mair:wake'"),`${file} luistert niet naar mair:wake`);
}

// 2. mair:wake vuurt de drie fases in volgorde, na de reconciliatie.
async function wakeFiresThreePhasesInOrder(){
  const h=harness({remotePlaying:true});const seen=[];
  h.window.addEventListener('mair:wake',e=>seen.push(e.detail.phase));
  h.hide();h.show();await sleep(300);
  assert.deepEqual(seen,['reconcile','refresh','paint'],'wake-fases moeten in deze volgorde komen');
}

// 3. Fase 1 faalt: fase 2 en 3 gaan door (fail-open, paragraaf 6).
async function failingReconcileDoesNotBlockLaterPhases(){
  const h=harness({remotePlaying:true});const seen=[];
  h.window.addEventListener('mair:wake',e=>{
    seen.push(e.detail.phase);
    if(e.detail.phase==='reconcile')e.detail.tasks.push(Promise.reject(Error('gesimuleerde reconcile-fout')));
  });
  h.hide();h.show();await sleep(320);
  assert.deepEqual(seen,['reconcile','refresh','paint'],'een falende fase 1 mag fase 2 en 3 niet tegenhouden');
  assert.ok(h.events.some(x=>x.reason==='wake-phase-failed'&&x.phase==='reconcile'),'een falende fase hoort zichtbaar te zijn in de diagnostiek');
}

// 4. Een slapend scherm meldt zich een keer, op een plek.
async function hiddenAnnouncesSleepOnce(){
  const h=harness();const sleeps=[];
  h.window.addEventListener('mair:sleep',e=>sleeps.push(e.detail));
  h.hide();
  assert.equal(sleeps.length,1,'mair:sleep hoort precies een keer te komen bij het uitgaan van het scherm');
}

// 5. Contract van de keep-alive in debug-tts.js. Het gedrag zelf vraagt een echte
// audiosessie en staat daarom in het testrapport, niet hier; dit bewaakt dat de
// koppelingen blijven staan waar ze horen.
function keepAliveContract(){
  const tts=fs.readFileSync(new URL('../debug-tts.js',import.meta.url),'utf8');
  assert.ok(tts.includes("window.Capacitor?.isNativePlatform?.()"),'keep-alive moet op de native shell zijn gegrendeld');
  assert.ok(/keepAliveStart[\s\S]{0,200}if\(!nativeShell\(\)\)return false/.test(tts),'keep-alive mag buiten de native shell niet starten');
  assert.ok(tts.includes("addEventListener('jfm:playback-state'")&&tts.includes('expectedLive'),'keep-alive moet aan expectedLive hangen');
  assert.ok(/keepAliveStop[\s\S]{0,400}finally\{/.test(tts),'keep-alive moet gegarandeerd stoppen, ook bij een fout');
  assert.ok(tts.includes('audio.loop=true'),'keep-alive moet een lus zijn, geen los fragment');
  assert.ok(tts.includes('silentWavUrl(10)'),'keep-alive gebruikt een fragment van tien seconden, zodat de lus niet duizenden keren per seconde herstart');
  assert.ok(!tts.includes("addEventListener('mair:sleep'"),'keep-alive hoort juist door te lopen als het scherm uitgaat');
  assert.ok(tts.includes('audio.native-shell-probe'),'de Capacitor-aanname hoort in de diagnostiek te staan');
}

// 6. De achtergronduitzondering voor de DJ is fail-closed.
function backgroundVoiceIsFailClosed(){
  const guard=fs.readFileSync(new URL('../mair-background-guard.js',import.meta.url),'utf8');
  const dj=fs.readFileSync(new URL('../mair-dj-v2.js',import.meta.url),'utf8');
  for(const[name,src]of[['mair-background-guard.js',guard],['mair-dj-v2.js',dj]]){
    assert.ok(src.includes('a?.nativeShell')&&src.includes('a?.keepAlive?.running'),`${name} moet de achtergronduitzondering aan een lopende keep-alive in de native shell koppelen`);
    assert.ok(/catch\{return false\}/.test(src.slice(src.indexOf('backgroundVoiceAllowed'))),`${name} moet bij twijfel false teruggeven`);
  }
  assert.ok(guard.includes("if(backgroundVoiceAllowed())emit('hidden-dj-allowed'"),'de wacht moet vastleggen wanneer hij een break laat staan');
}

const tests=[['background return keeps live playback',stillPlayingNeedsNoRecovery],['foreground recovery is single-flight',pausedForegroundRecoversOnce],['inactive session never autostarts',inactiveSessionDoesNotAutostart],['hidden natural end reaches central playback owner',hiddenNaturalEndReachesCentralOwner],['only the owner binds visibilitychange',onlyOwnerBindsVisibility],['mair:wake fires reconcile, refresh, paint in order',wakeFiresThreePhasesInOrder],['a failing reconcile does not block refresh and paint',failingReconcileDoesNotBlockLaterPhases],['hidden announces mair:sleep exactly once',hiddenAnnouncesSleepOnce],['keep-alive stays bound to native shell and expectedLive',keepAliveContract],['background DJ exception is fail-closed',backgroundVoiceIsFailClosed]];
let passed=0;for(const[name,test]of tests){try{await test();passed++;console.log('PASS',name)}catch(error){console.error('FAIL',name,'—',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`MAIR background/foreground behavior: ${passed}/${tests.length} PASS`);
