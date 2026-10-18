// In-page nep-Spotify voor de e2e-tests: Web API (fetch) én Web Playback SDK, zonder netwerk of echt account.
// Wordt als init-script geladen, dus vóór de app. Gedraagt zich als de echte SDK waar het ertoe doet:
// player_state_changed komt alleen bij echte toestandswisselingen (play, pauze, seek, trackwissel), niet per seconde.
(()=>{
const CAT=[];for(let i=1;i<=600;i++)CAT.push({id:'Tt'+String(i).padStart(20,'0'),name:`Testnummer ${i}`,artists:[{id:'art'+(i%12),name:`Testartiest ${i%12}`}],dur:Number(localStorage.getItem('__mock_dur')||20000)});
const toTrack=c=>({id:c.id,uri:'spotify:track:'+c.id,name:c.name,artists:c.artists.map(a=>({id:a.id,name:a.name,uri:'spotify:artist:'+a.id})),album:{id:'alb'+c.id,name:'Album '+c.name,release_date:'2024-01-01',images:[{url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',height:640,width:640}]},duration_ms:c.dur,explicit:false,popularity:70,is_playable:true,external_urls:{spotify:'https://open.spotify.com/track/'+c.id},type:'track'});
const byUri=u=>{const id=String(u).split(':').pop();const c=CAT.find(x=>x.id===id);return c?toTrack(c):null};
const S={deviceId:'mock-device-1',deviceName:'MAIRFM',active:false,uris:[],idx:0,pos:0,playing:false,since:0,volume:1,shuffle:false,repeat:'off',userQueue:[],calls:[],listeners:{},ended:0,failNext:null,delayMs:0};
window.__mock=S;
try{const saved=JSON.parse(sessionStorage.getItem('__mock_state')||'null');if(saved&&saved.uris?.length){S.uris=saved.uris;S.idx=saved.idx;S.pos=saved.pos;S.userQueue=saved.userQueue||[];S.volume=saved.volume??1;S.restored=true}}catch{}
const persist=()=>{try{sessionStorage.setItem('__mock_state',JSON.stringify({uris:S.uris,idx:S.idx,pos:position(),userQueue:S.userQueue,volume:S.volume}))}catch{}};
setInterval(persist,300);
const now=()=>Date.now();
const cur=()=>S.uris.length?byUri(S.uris[S.idx]):null;
const position=()=>{if(!S.playing)return S.pos;const p=S.pos+(now()-S.since);const c=cur();return c?Math.min(p,c.duration_ms):p};
const sdkTrack=t=>t&&({id:t.id,uri:t.uri,name:t.name,type:'track',media_type:'audio',is_playable:true,duration_ms:t.duration_ms,artists:t.artists,album:{uri:'spotify:album:'+t.album.id,name:t.album.name,images:t.album.images}});
function sdkState(){const t=cur();if(!t)return null;const next=[...S.userQueue.map(byUri),...S.uris.slice(S.idx+1).map(byUri)].filter(Boolean).slice(0,2);return{paused:!S.playing,position:position(),duration:t.duration_ms,timestamp:now(),loading:false,shuffle:S.shuffle,repeat_mode:0,track_window:{current_track:sdkTrack(t),previous_tracks:S.uris.slice(Math.max(0,S.idx-2),S.idx).map(byUri).filter(Boolean).map(sdkTrack),next_tracks:next.map(sdkTrack)},context:{uri:null,metadata:{}},disallows:{},playback_id:'pb'+S.idx,playback_quality:'HIGH'}}
function emit(){const st=sdkState();(S.listeners.player_state_changed||[]).forEach(f=>{try{f(st)}catch(e){console.error('mock listener',e)}})}
function setPos(p){S.pos=p;S.since=now()}
function advance(){S.ended++;if(S.userQueue.length){const u=S.userQueue.shift();S.uris.splice(S.idx+1,0,u)}if(S.idx<S.uris.length-1){S.idx++;setPos(0);S.playing=true;schedule();emit()}else{/* einde van de lijst: Spotify blijft 'geparkeerd' op het einde van het laatste nummer */S.playing=false;const c=cur();setPos(c?c.duration_ms:0);emit()}}
let timer=0;
function schedule(){clearTimeout(timer);if(!S.playing)return;const c=cur();if(!c)return;timer=setTimeout(()=>{if(S.playing&&position()>=c.duration_ms-5)advance();else schedule()},Math.max(5,c.duration_ms-position()))}
S.finishTrack=(leftMs=300)=>{const c=cur();if(c){setPos(Math.max(0,c.duration_ms-leftMs));schedule();emit()}};
S.state=()=>({disconnects:S.disconnects||0,active:S.active,playing:S.playing,idx:S.idx,uri:S.uris[S.idx]||'',position:position(),volume:S.volume,uris:S.uris.length,ended:S.ended,calls:S.calls.length});
S.callLog=()=>S.calls.map(c=>c.m+' '+c.p);
function startPlay(body,q){const uris=Array.isArray(body?.uris)?body.uris:null;if(uris){S.uris=uris.slice();S.idx=Math.max(0,Number.isInteger(body?.offset?.position)?body.offset.position:0);if(body?.offset?.uri){const k=S.uris.indexOf(body.offset.uri);if(k>=0)S.idx=k}}else if(body?.context_uri){S.uris=CAT.slice(0,30).map(c=>'spotify:track:'+c.id);S.idx=0}
  setPos(Number(body?.position_ms)||0);S.playing=true;S.active=true;schedule();emit()}
const json=(o,s=200,extra={})=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json',...extra}});
const empty=(s=204)=>new Response(null,{status:s});
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const url=new URL(typeof input==='string'?input:String(input?.url||input),location.href),method=String(init?.method||(input?.method)||'GET').toUpperCase();
  if(url.hostname==='accounts.spotify.com'){S.calls.push({m:method,p:url.pathname});
    // Token-endpoint-gedrag per test: localStorage.__mock_token_mode = ok | neterr | 503 | invalid_grant; __mock_valid_refresh = enige geldige refresh-token (rest krijgt invalid_grant).
    const mode=localStorage.getItem('__mock_token_mode')||'ok',valid=localStorage.getItem('__mock_valid_refresh'),sent=new URLSearchParams(String(init?.body||'')).get('refresh_token');
    if(mode==='neterr')throw new TypeError('Failed to fetch');
    if(mode==='503')return json({error:'server_error'},503);
    if(mode==='invalid_grant'||(valid&&sent!==valid))return json({error:'invalid_grant',error_description:'Refresh token revoked'},400);
    return json({access_token:'mock-token-'+now(),token_type:'Bearer',expires_in:3600,refresh_token:'mock-refresh',scope:'streaming'})}
  if(url.hostname!=='api.spotify.com')return nativeFetch(input,init);
  const p=url.pathname.replace(/^\/v1/,''),q=url.searchParams;let body=null;try{body=init?.body?JSON.parse(init.body):null}catch{}
  S.calls.push({m:method,p:p+(url.search||'')});
  if(S.delayMs)await new Promise(r=>setTimeout(r,S.delayMs));
  if(p==='/search'&&S.searchDelayMs)await new Promise(r=>setTimeout(r,S.searchDelayMs));
  if(S.failNext&&S.failNext.test(method+' '+p)){const f=S.failNext;S.failNext=null;return json({error:{status:f.status||429,message:f.message||'mock failure'}},f.status||429,f.retryAfter?{'Retry-After':String(f.retryAfter)}:{})}
  if(p==='/me'&&method==='GET')return json({id:'mock-user',display_name:'Test',product:'premium',country:'NL',email:'test@example.invalid'});
  if(p==='/me/player/devices')return json({devices:S.deviceId&&S.registered?[{id:S.deviceId,name:S.deviceName,type:'Computer',is_active:S.active,is_restricted:false,volume_percent:Math.round(S.volume*100)}]:[]});
  if(p==='/me/player'&&method==='GET'){const t=cur();if(!S.active||!t)return empty();return json({device:{id:S.deviceId,name:S.deviceName,type:'Computer',is_active:true,volume_percent:Math.round(S.volume*100)},is_playing:S.playing,progress_ms:Math.round(position()),item:t,shuffle_state:S.shuffle,repeat_state:S.repeat,timestamp:now(),currently_playing_type:'track',actions:{}})}
  if(p==='/me/player'&&method==='PUT'){S.active=true;if(body?.play)S.playing=true;if(S.playing){setPos(position());schedule()}emit();return empty()}
  if(p==='/me/player/play'){startPlay(body,q);return empty()}
  if(p==='/me/player/pause'){setPos(position());S.playing=false;clearTimeout(timer);emit();return empty()}
  if(p==='/me/player/next'){advance();return empty()}
  if(p==='/me/player/previous'){if(position()>3000||S.idx===0){setPos(0)}else S.idx--;S.playing=true;schedule();emit();return empty()}
  if(p==='/me/player/seek'){setPos(Number(q.get('position_ms'))||0);schedule();emit();return empty()}
  if(p==='/me/player/volume'){S.volume=Number(q.get('volume_percent'))/100;(S.volLog=S.volLog||[]).push([Date.now(),S.volume]);return empty()}
  if(p==='/me/player/shuffle'){S.shuffle=q.get('state')==='true';return empty()}
  if(p==='/me/player/repeat'){S.repeat=q.get('state')||'off';return empty()}
  if(p==='/me/player/queue'&&method==='POST'){S.userQueue.push(q.get('uri'));return empty()}
  if(p==='/me/player/queue'){const t=cur();return json({currently_playing:t,queue:[...S.userQueue.map(byUri),...S.uris.slice(S.idx+1).map(byUri)].filter(Boolean).slice(0,20)})}
  if(p==='/search'){const term=(q.get('q')||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim(),limit=Number(q.get('limit'))||20;const off=Number(q.get('offset'))||0;let list=CAT;if(term&&/testnummer|testartiest|\d/.test(term))list=CAT.filter(c=>(c.name+' '+c.artists[0].name).toLowerCase().includes(term.split(' ').pop()));if(!list.length)list=CAT;/* Per zoekterm een andere plak van de catalogus, zoals echte zoekresultaten verschillen per query. */let h=0;for(const ch of term)h=(h*31+ch.charCodeAt(0))>>>0;S.searches=(S.searches||0)+1;const start=(off+(term?h%Math.max(1,list.length-limit):0)+(S.rolling?S.searches*7:0))%Math.max(1,list.length);const items=[];for(let i=0;i<Math.min(limit,list.length);i++)items.push(list[(start+i)%list.length]);return json({tracks:{items:items.map(toTrack),total:list.length,limit,offset:off}})}
  if(p.startsWith('/tracks/')){const t=byUri(p.split('/').pop());return t?json(t):json({error:{status:404}},404)}
  if(p==='/tracks'){return json({tracks:(q.get('ids')||'').split(',').map(id=>byUri(id)).filter(Boolean)})}
  if(p==='/me/player/recently-played')return json({items:CAT.slice(0,10).map(c=>({track:toTrack(c),played_at:new Date().toISOString()}))});
  if(p.startsWith('/me/top/'))return json({items:CAT.slice(0,20).map(toTrack)});
  if(p==='/me/tracks')return json({items:CAT.slice(20,40).map(c=>({track:toTrack(c),added_at:new Date().toISOString()})),total:20});
  if(p==='/me/playlists'||p==='/browse/new-releases'||p.startsWith('/playlists'))return json({items:[],total:0});
  return json({});
};
// Web Playback SDK
class Player{
  constructor(o){this.o=o;this.id=S.deviceId;S.player=this;S.registered=false;S.listeners={};S.getToken=o.getOAuthToken}
  addListener(n,f){(S.listeners[n]=S.listeners[n]||[]).push(f);return true}
  removeListener(n,f){S.listeners[n]=(S.listeners[n]||[]).filter(x=>x!==f);return true}
  async connect(){await new Promise(r=>S.getToken(r));setTimeout(()=>{S.registered=true;(S.listeners.ready||[]).forEach(f=>f({device_id:S.deviceId}))},30);return true}
  disconnect(){S.disconnects=(S.disconnects||0)+1;S.registered=false;S.active=false;S.playing=false;clearTimeout(timer);(S.listeners.not_ready||[]).forEach(f=>f({device_id:S.deviceId}))}
  async getCurrentState(){return sdkState()}
  async setVolume(v){if(S.failVolume>0){S.failVolume--;throw new Error('mock: setVolume mislukt')}S.volume=v;(S.volLog=S.volLog||[]).push([Date.now(),Math.round(v*100)/100])}
  async getVolume(){return S.volume}
  async pause(){setPos(position());S.playing=false;clearTimeout(timer);emit()}
  async resume(){S.playing=true;setPos(S.pos);schedule();emit()}
  async togglePlay(){return S.playing?this.pause():this.resume()}
  async seek(p){setPos(p);schedule();emit()}
  async previousTrack(){if(S.idx>0)S.idx--;setPos(0);schedule();emit()}
  async nextTrack(){advance()}
  async activateElement(){}
  async setName(){}
}
window.Spotify={Player};
// De app wacht op deze callback; de echte SDK roept hem aan zodra het script geladen is.
const defineReady=()=>{queueMicrotask(()=>{try{window.onSpotifyWebPlaybackSDKReady?.()}catch(e){console.error(e)}})};
window.__mockSdkReady=defineReady;
})();
