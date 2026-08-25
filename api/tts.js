const DEFAULT_VOICE='9324023ff6ec48fb9c4b2b236e9146c4';
const DEFAULT_VOICES={
  // Main/daytime: the most natural Dutch benchmark voice.
  josh:'9324023ff6ec48fb9c4b2b236e9146c4',
  // Warm, conversational female voice for Maya.
  maya:'f47a8dcf789144028f7bc2752ae00451',
  // High-energy radio host voice for Max.
  max:'c7ab1ccc330c467c9e72663573a202f1',
  // Calm Dutch male voice for Noah / late-night delivery.
  noah:'a57e1031ac5a473cb9bdcc8ac032efe7'
};
const VOICE_CAST={
  josh:{label:'Dutch natural radio',role:'main / daytime',voiceId:DEFAULT_VOICES.josh},
  maya:{label:'Warm Storyteller',role:'evening / warm',voiceId:DEFAULT_VOICES.maya},
  max:{label:'Energetic Radio Host',role:'drive / party',voiceId:DEFAULT_VOICES.max},
  noah:{label:'Rustige Mannelijke Stem',role:'late night / calm',voiceId:DEFAULT_VOICES.noah}
};
const RESERVE_VOICE={label:'Energetic Female DJ',voiceId:'43e2ca8a2091441dbf4489b9d2e0e4ab'};
const DEFAULT_MODELS=['s2.1-pro-free','s2-pro'];
const FISH='https://api.fish.audio';
const RATE=new Map();
const DJ_ENV={josh:'FISH_AUDIO_VOICE_JOSH',maya:'FISH_AUDIO_VOICE_MAYA',max:'FISH_AUDIO_VOICE_MAX',noah:'FISH_AUDIO_VOICE_NOAH'};
const NON_DUTCH_VOICES=new Set(['802e3bc2b27e49c2995d23ef70e6ac89']);
const DJ_STYLE={
  // Natural and confident: not announcer-like.
  josh:{speed:1.01,temperature:.70,topP:.70},
  // Slightly slower and warmer, with room for phrasing.
  maya:{speed:.97,temperature:.72,topP:.70},
  // Faster and more expressive for drive-time / party breaks.
  max:{speed:1.06,temperature:.78,topP:.74},
  // Deliberately relaxed for late-night listening.
  noah:{speed:.92,temperature:.64,topP:.66}
};
function normalizeProfile(profile='josh'){const id=String(profile||'josh').trim().toLowerCase();return Object.hasOwn(DJ_ENV,id)?id:'josh'}
function rateLimit(req,res){const method=String(req.method||'GET').toUpperCase(),limit=method==='POST'?20:60,windowMs=60000,ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80),key=`${method}:${ip}`,now=Date.now(),fresh=(RATE.get(key)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`});return false}fresh.push(now);RATE.set(key,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}
function voiceFor(profile='josh'){const id=String(profile||'josh').toLowerCase(),fallback=DEFAULT_VOICES[id]||DEFAULT_VOICE;if(process.env.MAIR_TTS_ALLOW_VOICE_OVERRIDE!=='1')return fallback;const env=DJ_ENV[id]||DJ_ENV.josh,candidate=String(process.env[env]||process.env.FISH_AUDIO_VOICE_ID||fallback).trim();return NON_DUTCH_VOICES.has(candidate)?fallback:candidate}
function styleFor(profile='josh'){return DJ_STYLE[String(profile||'').toLowerCase()]||DJ_STYLE.josh}
function config(profile='josh'){const explicit=String(process.env.FISH_AUDIO_MODEL||'').trim();return{key:process.env.FISH_AUDIO_API_KEY||'',voiceId:voiceFor(profile),models:explicit?[explicit]:DEFAULT_MODELS,style:styleFor(profile)}}
function safeDetail(raw=''){try{const d=JSON.parse(raw);return String(d?.message||d?.error?.message||d?.detail||raw).slice(0,500)}catch{return String(raw||'Unknown Fish Audio error').slice(0,500)}}
async function withTimeout(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
async function inspectVoice(key,voiceId){try{const r=await withTimeout(`${FISH}/model/${encodeURIComponent(voiceId)}`,{headers:{Authorization:`Bearer ${key}`}},7000);const raw=await r.text();let d={};try{d=JSON.parse(raw)}catch{}return r.ok?{ok:true,status:r.status,id:d?._id||voiceId,title:d?.title||'',state:d?.state||'',type:d?.type||'',visibility:d?.visibility||'',languages:Array.isArray(d?.languages)?d.languages:[]}:{ok:false,status:r.status,detail:safeDetail(raw)}}catch(e){return{ok:false,status:0,detail:e?.name==='AbortError'?'Fish Audio voice check timed out':String(e?.message||e)}}}
async function synthesize(key,voiceId,model,text,jingle,style){const started=Date.now();try{const r=await withTimeout(`${FISH}/v1/tts`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',model},body:JSON.stringify({text,reference_id:voiceId,format:'mp3',sample_rate:44100,mp3_bitrate:128,normalize:true,temperature:jingle?Math.max(.76,style.temperature):style.temperature,top_p:style.topP,prosody:{speed:jingle?Math.max(1.03,style.speed):style.speed,volume:0,normalize_loudness:true},chunk_length:300,latency:'balanced',repetition_penalty:1.2,condition_on_previous_chunks:true})},14000);if(!r.ok){const raw=await r.text();return{ok:false,status:r.status,detail:safeDetail(raw),model,ms:Date.now()-started}}const type=String(r.headers.get('content-type')||'').toLowerCase(),buf=Buffer.from(await r.arrayBuffer());if(!buf.length)return{ok:false,status:502,detail:'Fish Audio returned empty audio',model,ms:Date.now()-started};if(type.includes('json')||(!type.startsWith('audio/')&&!type.includes('octet-stream')))return{ok:false,status:502,detail:`Fish Audio returned ${type||'an unknown content type'} instead of audio`,model,ms:Date.now()-started};if(buf.length>12*1024*1024)return{ok:false,status:502,detail:'Fish Audio response exceeded the safe audio size limit',model,ms:Date.now()-started};return{ok:true,status:200,buf,model,type:type||'audio/mpeg',ms:Date.now()-started}}catch(e){return{ok:false,status:e?.name==='AbortError'?504:500,detail:e?.name==='AbortError'?'Fish Audio generation timed out':String(e?.message||e),model,ms:Date.now()-started}}}
export default async function handler(req,res){if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});if(!rateLimit(req,res))return;const profile=normalizeProfile(req.method==='POST'?req.body?.djProfile:req.query?.djProfile);const{key,voiceId,models,style}=config(profile);if(!key)return res.status(503).json({error:'fish_key_missing',detail:'FISH_AUDIO_API_KEY is missing in Vercel'});if(req.method==='GET'){const voice=await inspectVoice(key,voiceId),languages=Array.isArray(voice.languages)?voice.languages.map(x=>String(x).toLowerCase()):[],dutchReady=voice.ok&&languages.includes('nl'),detail=!dutchReady&&voice.ok?'De geconfigureerde stem meldt geen Nederlandse taalondersteuning.':voice.detail;return res.status(dutchReady?200:(voice.ok?422:(voice.status||502))).json({provider:'fish-audio',configured:true,djProfile:profile,voiceId,models,style,cast:VOICE_CAST[profile],reserve:RESERVE_VOICE,voiceOverrideEnabled:process.env.MAIR_TTS_ALLOW_VOICE_OVERRIDE==='1',voice:{...voice,dutchReady,detail}})}const text=String(req.body?.text||'').trim().slice(0,1200);if(!text)return res.status(400).json({error:'Missing text'});const jingle=!!req.body?.jingle,attempts=[];for(const model of models){const out=await synthesize(key,voiceId,model,text,jingle,style);if(out.ok){res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','private, max-age=0, no-store');res.setHeader('X-JoshFM-TTS','fish-audio');res.setHeader('X-JoshFM-Voice',voiceId);res.setHeader('X-MAIR-DJ',profile);res.setHeader('X-JoshFM-Fish-Model',model);res.setHeader('X-JoshFM-TTS-MS',String(out.ms));return res.status(200).send(out.buf)}attempts.push({model,status:out.status,detail:out.detail,ms:out.ms});if([401,403,404].includes(out.status))break}const primary=attempts[0]||{status:500,detail:'Unknown Fish Audio error'};return res.status(primary.status>=400&&primary.status<600?primary.status:502).json({error:'fish_tts_failed',detail:primary.detail,djProfile:profile,voiceId,attempts})}
