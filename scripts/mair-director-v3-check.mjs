import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../rotation-engine.js',import.meta.url),'utf8');
const store=new Map([['jfm_music_channel_v1','mix']]);
const listeners={};
const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
const recent={lastIds:['recent-track'],lastArtists:['recent artist']};
const modeState={mode:'normal',options:{}};
const window={
  addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),
  dispatchEvent:event=>(listeners[event.type]||[]).forEach(fn=>fn(event)),
  JFMRadioSuite:{state:()=>recent},
  JFMStationClock:{current:()=>({show:{musicPattern:['Familiar','Current','Power','Discovery'],targetMomentum:.66},phase:'open'})},
  MAIRModeManager:{state:()=>modeState,timeMachineAllows:(track,target)=>{const year=Number(String(track.release||'').slice(0,4))||0;return year>=target-2&&year<=target},rotationScore:()=>0},
  MAIRRuntime:{register:()=>{}}
};
const document={addEventListener:()=>{}};
const CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail}};
const context=vm.createContext({window,document,localStorage,CustomEvent,console,Date,Math,JSON,Number,String,Array,Set,Object});
vm.runInContext(source,context,{filename:'rotation-engine.js'});
const director=window.JFMRotation;
assert.equal(director.version,'mair-director-v3-horizon');
assert.equal(director.state().horizonTracks,10);
assert.equal(director.state().strategy.length,10);

const year=new Date().getFullYear();
const tracks=Array.from({length:50},(_,i)=>({
  id:i===0?'recent-track':`track-${i}`,
  uri:`spotify:track:${String(i).padStart(22,'0')}`,
  name:`Track ${i}`,
  artists:[i===0?'Recent Artist':`Artist ${i%20}`],
  popularity:35+(i%65),
  release:`${year-(i%16)}-01-01`,
  _discovery:i%7===0
}));
const memory={likes:{'track-17':4},plays:{'track-17':8},lastPlayed:{'track-17':Date.now()-35*86400000},discoveryWins:{},discoveryLosses:{},completions:{}};
store.set('jfm_director_memory',JSON.stringify(memory));
const planned=director.plan(tracks,[]);
assert.equal(planned.length,tracks.length-1,'harde cooldown verwijdert een recente track zolang genoeg kandidaten bestaan');
assert.ok(!planned.slice(0,24).some(track=>track.id==='recent-track'),'recente track staat binnen de harde cooldown');
for(let i=1;i<Math.min(20,planned.length);i++)assert.notEqual(planned[i].artists[0],planned[i-1].artists[0],'geen directe artiestrepeat');

const beforeSkip=director.state().satisfaction;
director.noteTransition({cause:'USER_NEXT',fromTrack:{trackId:'skip-1',positionMs:8000,durationMs:200000}});
director.noteTransition({cause:'USER_NEXT',fromTrack:{trackId:'skip-2',positionMs:12000,durationMs:220000}});
const recovery=director.state();
assert.ok(recovery.satisfaction<beforeSkip,'snelle skips verlagen satisfaction');
assert.equal(recovery.recovery,true,'twee snelle skips activeren recovery');
assert.ok(recovery.discoveryBudget<=.03,'recovery verlaagt discovery sterk');
assert.ok(!recovery.strategy.includes('discovery'),'recovery-strategie gebruikt geen discovery-slot');

const beforeComplete=recovery.satisfaction;
director.noteTransition({cause:'NATURAL_END',fromTrack:{trackId:'completed-track',positionMs:199000,durationMs:200000}});
assert.ok(director.state().satisfaction>beforeComplete,'uitluisteren verhoogt satisfaction');
assert.equal(JSON.parse(store.get('jfm_director_memory')).completions['completed-track'],1,'uitgeluisterde track wordt onthouden');

for(const mode of ['mair','energy','chill','drive','party','discover','forgotten'])assert.equal(director.setMode(mode),true,`${mode} is beschikbaar`);
director.setMode('forgotten');
assert.equal(director.category(tracks.find(track=>track.id==='track-17')),'Forgotten');
assert.ok(director.plan(tracks,[]).slice(0,3).some(track=>track.id==='track-17'),'Forgotten haalt een oude favoriet vroeg naar voren');
assert.equal(director.change('more-discovery'),true);
assert.equal(director.state().adjustment.id,'more-discovery');

const queueCore=fs.readFileSync(new URL('../queue-core.js',import.meta.url),'utf8');
const intelligence=fs.readFileSync(new URL('../music-intelligence-v3.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../director.js',import.meta.url),'utf8');
assert.ok(queueCore.includes("includes('request')")&&queueCore.includes("mark?.('REQUEST'"),'Director-herplanning wordt niet als request gemarkeerd');
assert.ok(intelligence.includes('window.JFMProgramDirector?.directWithContext'),'legacy intelligence delegeert aan de centrale Director');
assert.ok(ui.includes("replan('taste',true)"),'likes/dislikes herprogrammeren ook de veilige Spotify-context');
// De knoppen Flow en Change It zijn op verzoek van het beginscherm gehaald; de
// onderliggende setMode/change blijven in rotation-engine bestaan maar hebben geen UI meer.
for(const dood of ['mairDirectorFlow','mairDirectorChange','mairDirectorSheetV3','FLOW_LABELS','CHANGE_LABELS'])assert.ok(!ui.includes(dood),`director.js verwijst nog naar ${dood}`);
console.log('MAIR Director v3: PASS — horizon, satisfaction, skip recovery, anti-repeat, modes en Forgotten');
