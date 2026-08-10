function normalizeVoice(v){
  return {
    voice_id:v.voice_id,
    category:String(v.category||'').toLowerCase(),
    tiers:Array.isArray(v.available_for_tiers)?v.available_for_tiers.map(x=>String(x).toLowerCase()):[]
  };
}

async function getAllowedVoices(key){
  const headers={'xi-api-key':key};
  let r=await fetch('https://api.elevenlabs.io/v2/voices',{headers});
  if(r.ok){const d=await r.json();return (d.voices||[]).map(normalizeVoice);}
  r=await fetch('https://api.elevenlabs.io/v1/voices?show_legacy=false',{headers});
  if(!r.ok) return [];
  const d=await r.json();return (d.voices||[]).map(normalizeVoice);
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key) return res.status(503).json({error:'ElevenLabs niet geconfigureerd',code:'missing_elevenlabs_key'});
  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Tekst ontbreekt'});

  try{
    const voices=await getAllowedVoices(key);
    const freeDefaults=voices.filter(v=>v.voice_id&&['premade','default'].includes(v.category)&&(!v.tiers.length||v.tiers.includes('free')));
    if(!freeDefaults.length) return res.status(404).json({error:'Geen gratis ElevenLabs default voices gevonden'});

    const requested=String(req.body?.voiceId||'');
    const chosen=freeDefaults.find(v=>v.voice_id===requested)||freeDefaults[0];
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(chosen.voice_id)}?output_format=mp3_44100_128`,{
      method:'POST',
      headers:{'xi-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({
        text,
        model_id:process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2',
        voice_settings:{
          stability:req.body?.jingle?0.42:0.34,
          similarity_boost:0.78,
          style:req.body?.jingle?0.24:0.16,
          use_speaker_boost:true,
          speed:req.body?.jingle?1.01:0.96
        }
      })
    });
    if(!r.ok){let detail='';try{detail=(await r.text()).slice(0,500)}catch{};return res.status(r.status).json({error:'ElevenLabs TTS geweigerd',detail});}
    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Josh-FM-Voice','ElevenLabs');
    res.setHeader('X-Josh-FM-Voice-Id',chosen.voice_id);
    return res.status(200).send(buf);
  }catch(e){
    return res.status(500).json({error:'ElevenLabs verbinding mislukt',detail:String(e?.message||e).slice(0,300)});
  }
}
