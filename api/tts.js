const DEFAULT_VOICE='b347db033a6549378b48d00acb0d06cd';
const DEFAULT_MODELS=['s2.1-pro-free','s2-pro'];
const FISH='https://api.fish.audio';

function config(){
  const explicit=String(process.env.FISH_AUDIO_MODEL||'').trim();
  return{
    key:process.env.FISH_AUDIO_API_KEY||'',
    voiceId:process.env.FISH_AUDIO_VOICE_ID||DEFAULT_VOICE,
    models:explicit?[explicit]:DEFAULT_MODELS
  };
}

function safeDetail(raw=''){
  try{const d=JSON.parse(raw);return String(d?.message||d?.error?.message||d?.detail||raw).slice(0,500)}catch{return String(raw||'Unknown Fish Audio error').slice(0,500)}
}

async function withTimeout(url,opt={},ms=12000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
  try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}
}

async function inspectVoice(key,voiceId){
  try{
    const r=await withTimeout(`${FISH}/model/${encodeURIComponent(voiceId)}`,{headers:{Authorization:`Bearer ${key}`}},7000);
    const raw=await r.text();let d={};try{d=JSON.parse(raw)}catch{}
    return r.ok?{ok:true,status:r.status,id:d?._id||voiceId,title:d?.title||'',state:d?.state||'',type:d?.type||'',visibility:d?.visibility||'',languages:Array.isArray(d?.languages)?d.languages:[]}:{ok:false,status:r.status,detail:safeDetail(raw)};
  }catch(e){return{ok:false,status:0,detail:e?.name==='AbortError'?'Fish Audio voice check timed out':String(e?.message||e)}}
}

async function synthesize(key,voiceId,model,text,jingle){
  const started=Date.now();
  try{
    const r=await withTimeout(`${FISH}/v1/tts`,{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',model},
      body:JSON.stringify({
        text,
        reference_id:voiceId,
        format:'mp3',
        sample_rate:44100,
        mp3_bitrate:128,
        normalize:true,
        temperature:jingle?0.76:0.7,
        top_p:0.7,
        prosody:{speed:jingle?1.02:0.96,volume:0,normalize_loudness:true},
        chunk_length:300,
        latency:'balanced',
        repetition_penalty:1.2,
        condition_on_previous_chunks:true
      })
    },14000);
    if(!r.ok){const raw=await r.text();return{ok:false,status:r.status,detail:safeDetail(raw),model,ms:Date.now()-started}}
    const type=String(r.headers.get('content-type')||'').toLowerCase();
    const buf=Buffer.from(await r.arrayBuffer());
    if(!buf.length)return{ok:false,status:502,detail:'Fish Audio returned empty audio',model,ms:Date.now()-started};
    if(type.includes('json'))return{ok:false,status:502,detail:'Fish Audio returned JSON instead of audio',model,ms:Date.now()-started};
    return{ok:true,status:200,buf,model,type:type||'audio/mpeg',ms:Date.now()-started};
  }catch(e){return{ok:false,status:e?.name==='AbortError'?504:500,detail:e?.name==='AbortError'?'Fish Audio generation timed out':String(e?.message||e),model,ms:Date.now()-started}}
}

export default async function handler(req,res){
  const{key,voiceId,models}=config();
  if(!key)return res.status(503).json({error:'fish_key_missing',detail:'FISH_AUDIO_API_KEY is missing in Vercel'});

  if(req.method==='GET'){
    const voice=await inspectVoice(key,voiceId);
    return res.status(voice.ok?200:(voice.status||502)).json({provider:'fish-audio',configured:true,voiceId,models,voice});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const text=String(req.body?.text||'').trim().slice(0,1200);
  if(!text)return res.status(400).json({error:'Missing text'});
  const jingle=!!req.body?.jingle,attempts=[];

  for(const model of models){
    const out=await synthesize(key,voiceId,model,text,jingle);
    if(out.ok){
      res.setHeader('Content-Type','audio/mpeg');
      res.setHeader('Cache-Control','private, max-age=0, no-store');
      res.setHeader('X-JoshFM-TTS','fish-audio');
      res.setHeader('X-JoshFM-Voice',voiceId);
      res.setHeader('X-JoshFM-Fish-Model',model);
      res.setHeader('X-JoshFM-TTS-MS',String(out.ms));
      return res.status(200).send(out.buf);
    }
    attempts.push({model,status:out.status,detail:out.detail,ms:out.ms});
    // Authentication/voice errors will not improve by trying a second paid model.
    if([401,403,404].includes(out.status))break;
  }

  const primary=attempts[0]||{status:500,detail:'Unknown Fish Audio error'};
  return res.status(primary.status>=400&&primary.status<600?primary.status:502).json({
    error:'fish_tts_failed',
    detail:primary.detail,
    voiceId,
    attempts
  });
}
