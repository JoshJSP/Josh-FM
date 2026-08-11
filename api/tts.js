export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const key=process.env.FISH_AUDIO_API_KEY;
  if(!key) return res.status(503).json({error:'FISH_AUDIO_API_KEY is missing in Vercel'});

  const text=String(req.body?.text||'').trim().slice(0,1200);
  if(!text) return res.status(400).json({error:'Missing text'});

  const jingle=!!req.body?.jingle;
  const voiceId=process.env.FISH_AUDIO_VOICE_ID||'b347db033a6549378b48d00acb0d06cd';
  const model=process.env.FISH_AUDIO_MODEL||'s2-pro';

  try{
    const r=await fetch('https://api.fish.audio/v1/tts',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${key}`,
        'Content-Type':'application/json',
        model
      },
      body:JSON.stringify({
        text,
        reference_id:voiceId,
        format:'mp3',
        normalize:true,
        temperature:jingle?0.78:0.72,
        top_p:0.7,
        prosody:{
          speed:jingle?1.02:0.96,
          volume:0,
          normalize_loudness:true
        },
        latency:'balanced'
      })
    });

    if(!r.ok){
      let detail='Unknown Fish Audio error';
      try{
        const raw=await r.text();
        try{
          const parsed=JSON.parse(raw);
          detail=parsed?.message||parsed?.error?.message||raw;
        }catch{detail=raw||detail}
      }catch{}
      return res.status(r.status).json({
        error:'Fish Audio TTS rejected the request',
        status:r.status,
        detail:String(detail).slice(0,500),
        model,
        voiceId
      });
    }

    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, max-age=0, no-store');
    res.setHeader('X-JoshFM-TTS','fish-audio');
    res.setHeader('X-JoshFM-Voice',voiceId);
    return res.status(200).send(buf);
  }catch(e){
    return res.status(500).json({
      error:'Speech generation failed',
      detail:String(e?.message||e).slice(0,300),
      model,
      voiceId
    });
  }
}
