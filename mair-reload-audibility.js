// MAIR reload audibility guard — confirms that the local Web Playback SDK is actually audible after reload recovery.
(()=>{
'use strict';
if(window.__mairReloadAudibilityGuard)return;window.__mairReloadAudibilityGuard=true;
const TRUTH_KEY='jfm_playback_truth_v1',TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/,wait=ms=>new Promise(r=>setTimeout(r,ms));
let checking=false,checks=0,repairs=0,last={status:'idle',reason:'boot',at:0,error:'',intentUri:'',remoteUri:'',positionMs:0,naturalAdvance:false};
function readIntent(){try{const x=JSON.parse(sessionStorage.getItem(TRUTH_KEY)||'{}'),age=Date.now()-Number(x.updatedAt||0),uri=String(x.uri||'');if(x.expectedLive&&TRACK_URI.test(uri)&&age>=0&&age<5*60*1000)return{uri,updatedAt:Number(x.updatedAt||0)}}catch{}return null}
const player=()=>{const p=window.jfmSpotifyPlayer;return p&&typeof p.getCurrentState==='function'?p:null};
const sdkUri=s=>String(s?.track_window?.current_track?.uri||'');
const apiCall=(path,opt)=>{const fn=window.api||globalThis.api;if(typeof fn!=='function')throw Error('Spotify API helper is nog niet geladen');return fn(path,opt)};
function publish(status,extra={}){last={...last,status,at:Date.now(),...extra};try{window.dispatchEvent(new CustomEvent('mair:reload-audibility',{detail:{...last,checks,repairs}}))}catch{}return status==='ok'||status==='repaired'}
async function waitRuntime(){for(let i=0;i<60;i++){const p=player();if(p&&window.JFMPlayback?.ensureDevice)return p;await wait(100)}throw Error('Web Playback SDK werd niet op tijd beschikbaar')}
async function remoteState(){try{return await apiCall('/me/player')}catch{return null}}
async function waitRemote(deviceId=''){let state=null;for(let i=0;i<14;i++){state=await remoteState();if(state?.is_playing&&state?.item?.uri&&(!deviceId||state?.device?.id===deviceId))return state;await wait(120+i*35)}return state}
async function verifyLocal(p,uri,position,tolerance=9000){for(let i=0;i<10;i++){try{const s=await p.getCurrentState();if(s&&!s.paused&&sdkUri(s)===uri&&Math.abs(Number(s.position||0)-position)<tolerance)return s}catch{}await wait(60+i*30)}return null}
async function check(reason='manual'){
  if(checking||document.visibilityState==='hidden')return false;const intent=readIntent();if(!intent)return false;
  checking=true;checks++;publish('checking',{reason,error:'',intentUri:intent.uri});
  try{
    const p=await waitRuntime();let id='';try{id=String(await window.JFMPlayback.ensureDevice()||'')}catch{}
    let remote=await waitRemote(id);
    if((!remote?.is_playing||!remote?.item?.uri||id&&remote?.device?.id!==id)&&typeof window.JFMPlayback?.recover==='function'){
      await window.JFMPlayback.recover('reload-audibility-guard').catch(()=>false);remote=await waitRemote(id)
    }
    if(!remote?.is_playing||!TRACK_URI.test(String(remote?.item?.uri||'')))throw Error('Spotify bevestigde geen live track na reload');
    const uri=String(remote.item.uri),position=Math.max(0,Number(remote.progress_ms||0)),naturalAdvance=uri!==intent.uri;
    const local=await p.getCurrentState().catch(()=>null);
    if(local&&!local.paused&&sdkUri(local)===uri&&Math.abs(Number(local.position||0)-position)<9000)return publish('ok',{reason,error:'',intentUri:intent.uri,remoteUri:uri,positionMs:position,naturalAdvance});
    try{await p.seek(position)}catch{}
    try{await p.resume()}catch{}
    let verified=await verifyLocal(p,uri,position,9000);
    if(!verified){await wait(350);try{await p.seek(Math.max(0,Number((await remoteState())?.progress_ms||position)));await p.resume()}catch{}verified=await verifyLocal(p,uri,Math.max(0,Number((await remoteState())?.progress_ms||position)),11000)}
    if(!verified)throw Error('Lokale browserplayer werd na reload niet hoorbaar bevestigd');
    repairs++;return publish('repaired',{reason,error:'',intentUri:intent.uri,remoteUri:uri,positionMs:Number(verified.position||position),naturalAdvance})
  }catch(e){return publish('error',{reason,error:String(e?.message||e).slice(0,240)})}finally{checking=false}
}
function schedule(reason,delay=900){setTimeout(()=>check(reason).catch(()=>false),delay)}
window.addEventListener('pageshow',()=>schedule('pageshow',750));
window.addEventListener('jfm:reload-context-restored',()=>schedule('primary-restored',180));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule('visible',600)});
window.MAIRReloadAudibilityGuard={version:'mair-reload-audibility-v1',check,get status(){return{...last,checks,repairs,checking}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{schedule('dom-ready',900);schedule('dom-stable',2600)},{once:true});else{schedule('boot',900);schedule('boot-stable',2600)}
})();