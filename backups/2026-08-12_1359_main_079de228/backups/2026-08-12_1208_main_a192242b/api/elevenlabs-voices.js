function normalizeVoice(v){
  const labels=v.labels||{};
  return {
    voice_id:v.voice_id,
    name:v.name||'Onbekende stem',
    category:String(v.category||'').toLowerCase(),
    description:v.description||labels.description||'',
    gender:String(labels.gender||'').toLowerCase(),
    age:String(labels.age||'').toLowerCase(),
    accent:String(labels.accent||'').toLowerCase(),
    use_case:String(labels.use_case||labels['use case']||'').toLowerCase(),
    preview_url:v.preview_url||'',
    tiers:Array.isArray(v.available_for_tiers)?v.available_for_tiers.map(x=>String(x).toLowerCase()):[]
  };
}

function scoreVoice(v){
  const hay=[v.name,v.description,v.gender,v.age,v.accent,v.use_case].join(' ').toLowerCase();
  let score=0;
  if(v.gender==='male') score+=18;
  if(/warm|grounded|conversational|calm|natural|casual|friendly|confident|storyteller/.test(hay)) score+=10;
  if(/young|middle.?aged|adult/.test(hay)) score+=5;
  if(/narrat|social|convers|podcast|story/.test(hay)) score+=5;
  if(/dutch|netherlands|european/.test(hay)) score+=7;
  if(/energetic|dynamic/.test(hay)) score+=2;
  if(/child|old|elder|whisper|cartoon|character|dramatic|audiobook/.test(hay)) score-=8;
  return score;
}

async function fetchVoices(key){
  const headers={'xi-api-key':key};
  let r=await fetch('https://api.elevenlabs.io/v2/voices',{headers});
  if(r.ok){const d=await r.json();return d.voices||[];}
  r=await fetch('https://api.elevenlabs.io/v1/voices?show_legacy=false',{headers});
  if(!r.ok){const detail=(await r.text()).slice(0,400);throw new Error(`ElevenLabs voices ${r.status}: ${detail}`);}
  const d=await r.json();return d.voices||[];
}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key) return res.status(503).json({error:'ElevenLabs niet geconfigureerd'});
  try{
    const raw=await fetchVoices(key);
    const voices=raw.map(normalizeVoice)
      .filter(v=>v.voice_id)
      .filter(v=>['premade','default'].includes(v.category))
      .filter(v=>!v.tiers.length||v.tiers.includes('free'))
      .map(v=>({...v,score:scoreVoice(v)}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,4)
      .map(({score,...v})=>v);
    if(!voices.length) return res.status(404).json({error:'Geen gratis default ElevenLabs-stemmen gevonden'});
    res.setHeader('Cache-Control','private, max-age=300');
    return res.status(200).json({voices});
  }catch(e){
    return res.status(502).json({error:'Kon ElevenLabs-stemmen niet ophalen',detail:String(e?.message||e).slice(0,500)});
  }
}
