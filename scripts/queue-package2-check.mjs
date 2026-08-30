import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const uri=n=>'spotify:track:'+String(n).padStart(22,'0');
const track=(n,artist='Artist '+n)=>({id:String(n).padStart(22,'0'),uri:uri(n),name:'Track '+n,artists:[artist]});
class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
function storage(seed={}){const data=new Map(Object.entries(seed));return{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
function makeContext({api,queue=[],sessionStorage=storage()}={}){
  const listeners=new Map(),context={window:null,queue,api:api||(async()=>({})),localStorage:storage({jfm_music_channel_v1:'hits',jfm_spotify_device_id:'device-1'}),sessionStorage,CustomEvent:FakeCustomEvent,Date,Math,Promise,console};
  Object.assign(context,{addEventListener:(type,fn)=>{const a=listeners.get(type)||[];a.push(fn);listeners.set(type,a)},dispatchEvent:e=>{for(const fn of listeners.get(e.type)||[])fn(e);return true}});context.window=context;vm.createContext(context);vm.runInContext(read('queue-core.js'),context,{filename:'queue-core.js'});return context
}
async function testNormalizeCommit(){
  const c=makeContext(),bad={id:'bad',uri:'https://open.spotify.com/track/bad',artists:['X']};
  const result=c.JFMQueue.commit([track(1,'A'),track(2,'A'),track(3,'B'),track(1,'A'),bad,track(4,'C')],{source:'test',station:'hits',reason:'unit'});
  assert.deepEqual(Array.from(result,t=>t.id),[track(1).id,track(3).id,track(4).id,track(2).id]);assert.equal(new Set(result.map(t=>t.uri)).size,result.length);assert.equal(c.JFMQueue.state().revision,1);assert.equal(c.JFMQueue.state().source,'test')
}
async function testSerializedBuildsAndStationOwner(){
  const c=makeContext();let active=0,max=0,calls=0;
  const jobs=[1,2,3].map(n=>c.JFMQueue.build('b'+n,async()=>{active++;max=Math.max(max,active);await sleep(5);active--;return[track(n)]}));await Promise.all(jobs);assert.equal(max,1,'queue builds may never overlap');
  c.buildSet=async()=>{throw Error('protected legacy buildSet was used')};c.MAIRStationController={buildPool:async id=>{calls++;assert.equal(id,'hits');return{tracks:[track(10),track(11)]}}};
  const generated=await c.JFMQueue.buildActive('rotation');assert.equal(calls,1);assert.equal(generated.length,2)
}
async function testExactRequestInsertion(){
  const q=[track(1,'A'),track(2,'B'),track(3,'C')],request=track(9,'D'),calls=[];let remote={item:{id:q[0].id,uri:q[0].uri},device:{id:'device-1'},is_playing:true,progress_ms:42123};
  const api=async(path,opt={})=>{calls.push({path,opt});if(path==='/me/player')return structuredClone(remote);if(path.startsWith('/me/player/play?')){assert.equal(opt.body.position_ms,42123);assert.deepEqual(Array.from(opt.body.uris.slice(0,4)),[q[0].uri,request.uri,q[1].uri,q[2].uri]);return null}if(path==='/me/player/queue')return{currently_playing:remote.item,queue:[request,q[1],q[2]]};throw Error('Unexpected '+path)};
  const c=makeContext({api,queue:q});assert.equal(await c.JFMQueue.programNext(request),true);assert.equal(calls.filter(x=>x.path.startsWith('/me/player/play?')).length,1);remote.is_playing=false;await assert.rejects(()=>c.JFMQueue.programNext(track(8)),/gepauzeerd/);assert.equal(calls.filter(x=>x.path.startsWith('/me/player/play?')).length,1)
}
async function testLongSessionInvariant(){
  const c=makeContext();let authored=[];for(let round=0;round<12;round++){const block=[];for(let i=0;i<15;i++)block.push(track(round*15+i+1,'Artist '+((round*15+i)%7)));authored=c.JFMQueue.commit([...authored.slice(-8),...block],{source:'continuity',station:'hits',reason:'simulation'});assert.ok(authored.length>=15);assert.equal(new Set(authored.map(t=>t.uri)).size,authored.length);for(let i=1;i<authored.length;i++)assert.notEqual(authored[i-1].artists[0],authored[i].artists[0])}assert.equal(c.JFMQueue.state().revision,12)
}
async function testReloadPersistence(){
  const saved=storage(),first=makeContext({queue:[track(1,'A'),track(2,'B')],sessionStorage:saved});first.JFMQueue.commit(first.queue,{source:'test',station:'hits',reason:'persist'});const second=makeContext({sessionStorage:saved});assert.deepEqual(Array.from(second.queue,t=>t.id),[track(1).id,track(2).id]);assert.equal(second.JFMQueue.state().source,'bootstrap')
}
async function testRequestTransitionDeduplication(){
  const listeners=new Map(),data=storage(),queueInfo={textContent:'',style:{}},document={readyState:'complete',visibilityState:'visible',getElementById:id=>id==='queueInfo'?queueInfo:null,addEventListener:()=>{}},context={window:null,document,localStorage:data,CustomEvent:FakeCustomEvent,Date,Promise,console,Math:Object.create(Math),setInterval:()=>0,setTimeout:(fn)=>{Promise.resolve().then(fn);return 0},clearTimeout:()=>{},playback:{item:{id:track(1).id,uri:track(1).uri,name:'Current',artists:[{name:'Artist 1'}]}},trackObj:t=>({id:t.id,uri:t.uri,name:t.name,artists:(t.artists||[]).map(a=>a.name||a)}),api:async path=>path.startsWith('/tracks/')?track(9,'Request Artist'):null,JFMQueue:{programNext:async()=>{context.programCalls=(context.programCalls||0)+1;return true}}};
  context.Math.random=()=>0;Object.assign(context,{addEventListener:(type,fn)=>{const a=listeners.get(type)||[];a.push(fn);listeners.set(type,a)},dispatchEvent:e=>{for(const fn of listeners.get(e.type)||[])fn(e);return true}});context.window=context;vm.createContext(context);vm.runInContext(read('request-manager.js'),context,{filename:'request-manager.js'});
  await context.JFMRequests.add(track(9).uri);assert.equal(context.JFMRequests.list()[0].remaining,2);context.dispatchEvent(new FakeCustomEvent('jfm:trackchange'));context.dispatchEvent(new FakeCustomEvent('jfm:trackchange'));await sleep(0);assert.equal(context.JFMRequests.list()[0].remaining,2,'duplicate events for the same current track may not consume request ETA');context.playback.item={id:track(2).id,uri:track(2).uri,name:'Next',artists:[{name:'Artist 2'}]};context.dispatchEvent(new FakeCustomEvent('jfm:trackchange'));context.dispatchEvent(new FakeCustomEvent('jfm:trackchange'));await sleep(0);assert.equal(context.JFMRequests.list()[0].status,'armed');assert.equal(context.programCalls,1,'one real transition may arm a request only once')
}
async function testPlayedRequestAnnouncementMarker(){
  const data=storage();

  function boot(current){
    const listeners=new Map(),queueInfo={textContent:'',style:{}};
    const document={
      readyState:'complete',
      visibilityState:'visible',
      getElementById:id=>id==='queueInfo'?queueInfo:null,
      addEventListener:()=>{}
    };
    const context={
      window:null,
      document,
      localStorage:data,
      CustomEvent:FakeCustomEvent,
      Date,
      Promise,
      console,
      Math:Object.create(Math),
      setInterval:()=>0,
      setTimeout:(fn)=>{Promise.resolve().then(fn);return 0},
      clearTimeout:()=>{},
      playback:{item:current},
      trackObj:t=>({
        id:t.id,
        uri:t.uri,
        name:t.name,
        artists:(t.artists||[]).map(a=>a.name||a)
      }),
      api:async path=>path.startsWith('/tracks/')?track(9,'Request Artist'):null,
      JFMQueue:{programNext:async()=>true}
    };

    context.Math.random=()=>0;
    Object.assign(context,{
      addEventListener:(type,fn)=>{
        const a=listeners.get(type)||[];
        a.push(fn);
        listeners.set(type,a)
      },
      dispatchEvent:e=>{
        for(const fn of listeners.get(e.type)||[])fn(e);
        return true
      }
    });

    context.window=context;
    vm.createContext(context);
    vm.runInContext(read('request-manager.js'),context,{filename:'request-manager.js'});
    return context;
  }

  const firstTrack=track(1,'Artist 1');
  const requested=track(9,'Request Artist');
  const first=boot({
    id:firstTrack.id,
    uri:firstTrack.uri,
    name:firstTrack.name,
    artists:[{name:'Artist 1'}]
  });

  await first.JFMRequests.add(requested.uri);

  first.playback.item={
    id:requested.id,
    uri:requested.uri,
    name:requested.name,
    artists:[{name:'Request Artist'}]
  };
  first.dispatchEvent(new FakeCustomEvent('jfm:trackchange'));
  await sleep(0);

  assert.equal(first.JFMRequests.list().length,0,'played request must leave active request queue');
  assert.equal(first.JFMRequests.isRequest(requested),true,'played current request must remain identifiable');

  const marker=first.JFMRequests.currentRequest(requested);
  assert.ok(marker,'played request marker must exist');
  assert.equal(marker.uri,requested.uri);
  assert.ok(marker.requestId);
  assert.ok(marker.playedAt);

  const reloaded=boot({
    id:requested.id,
    uri:requested.uri,
    name:requested.name,
    artists:[{name:'Request Artist'}]
  });

  assert.equal(reloaded.JFMRequests.isRequest(requested),true,'played request marker must survive reload');
  assert.ok(reloaded.JFMRequests.currentRequest(requested),'marker must be readable after reload');

  const consumed=reloaded.JFMRequests.consumeCurrentRequest(requested);
  assert.ok(consumed,'marker must be consumable once');
  assert.equal(consumed.requestId,marker.requestId);
  assert.equal(reloaded.JFMRequests.consumeCurrentRequest(requested),null,'marker must not be consumable twice');
  assert.equal(reloaded.JFMRequests.isRequest(requested),false,'consumed marker must no longer identify track as request');

  data.setItem('jfm_played_request_v1',JSON.stringify({
    requestId:'stale-request',
    uri:requested.uri,
    trackId:requested.id,
    name:requested.name,
    artists:['Request Artist'],
    playedAt:Date.now()-(11*60*1000)
  }));

  const stale=boot({
    id:requested.id,
    uri:requested.uri,
    name:requested.name,
    artists:[{name:'Request Artist'}]
  });

  assert.equal(stale.JFMRequests.currentRequest(requested),null,'expired marker must be ignored');
  assert.equal(data.getItem('jfm_played_request_v1'),null,'expired marker must be deleted');
}
function testStaticContracts(){
  const suite=read('radio-suite.js'),station=read('station-queue.js'),requests=read('request-manager.js'),director=read('director.js'),truth=read('spotify-upcoming-truth.js'),sw=read('sw.js'),build7=read('build7.js'),styles=read('request-layer-fix.css');
assert.ok(suite.indexOf("'./queue-core.js'")<suite.indexOf("'./request-manager.js'"));assert.ok(suite.includes("'./spotify-upcoming-truth.js'"));assert.ok(station.includes("JFMQueue.buildActive('continuity-")&&station.includes('MAIR programmeert vooruit'));assert.ok(station.includes("'jfm:reload-context-restored'")&&station.includes('resetAfterReload'));assert.ok(!station.includes('appended.has(track.id)||remote.has'));assert.ok(requests.includes('JFMQueue.programNext')&&!requests.includes("/me/player/queue?uri="));assert.ok(requests.includes("uri===lastObservedUri")&&requests.includes("trace('duplicate-trackchange'"));assert.ok(build7.includes('window.JFMRequests.add(d.uri,b)')&&build7.includes("'mair:request-confirmed'")&&build7.includes('requestConfirmCapture'));assert.ok(suite.includes("'mair:request-confirmed'"));assert.ok(director.includes('if(window.JFMSpotifyUpcomingTruth)')&&director.includes('function renderNext(){paintNext();if(!window.JFMSpotifyUpcomingTruth)'));assert.ok(truth.includes('v2-single-authoritative-owner'));assert.ok(sw.includes('mair-v131-background-autonext-recovery-20260830')&&sw.includes("'./request-layer-fix.css'"));assert.match(styles,/\.mair-request-sheet\s*\{[^}]*z-index:\s*1300/)
}
const tests=[testNormalizeCommit,testReloadPersistence,testSerializedBuildsAndStationOwner,testExactRequestInsertion,testLongSessionInvariant,testRequestTransitionDeduplication,testPlayedRequestAnnouncementMarker,testStaticContracts];let passed=0;
for(const test of tests){try{await test();passed++;console.log('PASS',test.name)}catch(error){console.error('FAIL',test.name,'—',error?.stack||error);process.exitCode=1}}
if(process.exitCode)process.exit(1);console.log(`Queue package 2: ${passed}/${tests.length} PASS`);
