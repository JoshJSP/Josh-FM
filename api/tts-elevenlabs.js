export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key) return res.status(503).json({error:'ElevenLabs niet geconfigureerd',code:'missing_elevenlabs_key'});

  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Tekst ontbreekt'});

  try{
    const voice=await resolveVoice(key);
    if(!voice?.voice_id){
      return res.status(503).json({error:'Geen gratis ElevenLabs default voice beschikbaar',code:'no_free_default_voice'});
    }

    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voice_id)}?output_format=mp3_44100_128`,{
      method:'POST',
      headers:{'xi-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({
        text,
        model_id:process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2',
        voice_settings:{
          stability:req.body?.jingle?0.48:0.34,
          similarity_boost:0.76,
          style:req.body?.jingle?0.24:0.16,
          use_speaker_boost:true,
          speed:req.body?.jingle?1.02:0.96
        }
      })
    });

    if(!r.ok){
      let detail='';
      try{detail=(await r.text()).slice(0,700)}catch{}
      return res.status(r.status).json({error:'ElevenLabs TTS geweigerd',detail,voice:voice.name,voice_id:voice.voice_id});
    }

    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Josh-FM-Voice','ElevenLabs');
    res.setHeader('X-Josh-FM-Voice-Name',encodeURIComponent(voice.name||'Default'));
    return res.status(200).send(buf);
  }catch(e){
    return res.status(500).json({error:'ElevenLabs verbinding mislukt',detail:String(e?.message||e).slice(0,400)});
  }
}

async function resolveVoice(key){
  const forced=process.env.ELEVENLABS_VOICE_ID;
  if(forced){
    const check=await getVoice(key,forced).catch(()=>null);
    if(check && isLikelyDefault(check)) return check;
  }

  const r=await fetch('https://api.elevenlabs.io/v2/voices?voice_type=default&page_size=100&include_total_count=false',{
    headers:{'xi-api-key':key}
  });
  if(!r.ok) throw new Error(`Default voices ophalen mislukt: HTTP ${r.status}`);
  const d=await r.json();
  const voices=Array.isArray(d.voices)?d.voices:[];
  if(!voices.length) return null;

  const preferred=voices.find(v=>String(v.labels?.gender||'').toLowerCase()==='male' && /warm|convers|narrat|story|grounded|calm|casual/i.test(`${v.name||''} ${v.description||''} ${v.labels?.description||''}`))
    || voices.find(v=>String(v.labels?.gender||'').toLowerCase()==='male')
    || voices[0];
  return preferred;
}

async function getVoice(key,id){
  const r=await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`,{headers:{'xi-api-key':key}});
  if(!r.ok) return null;
  return r.json();
}

function isLikelyDefault(v){
  const c=String(v?.category||'').toLowerCase();
  return c==='premade' || c==='default';
}
