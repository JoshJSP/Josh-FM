export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'OPENAI_API_KEY ontbreekt in Vercel'});

  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Missing text'});

  const jingle=!!req.body?.jingle;
  const instructions=jingle
    ? `Spreek dit als een korte Nederlandse FM-radio station-ID. Klink energiek maar stijlvol, warm en geloofwaardig. Geen Amerikaanse announcer-stem, geen overdreven bas, geen reclame-intonatie.`
    : `Spreek vloeiend Nederlands als een ervaren Nederlandse FM-radiopresentator van ongeveer 25 tot 35 jaar. Klink warm, ontspannen, zelfverzekerd en menselijk, alsof je live vanuit een radiostudio tegen één luisteraar praat. Gebruik een licht lage, rustige spreekstem, kleine natuurlijke pauzes en subtiele variatie. Vermijd vlakke AI-cadans, overdreven articulatie, reclame-intonatie en klantenservice-stem.`;

  const model=process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts';
  const voice=process.env.OPENAI_TTS_VOICE||'cedar';
  try{
    const r=await fetch('https://api.openai.com/v1/audio/speech',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,voice,input:text,instructions,response_format:'mp3',speed:jingle?1.0:0.94})
    });

    if(!r.ok){
      let detail='';
      try{
        const raw=await r.text();
        const parsed=JSON.parse(raw);
        detail=parsed?.error?.message||raw;
      }catch(e){ detail='Onbekende OpenAI-fout'; }
      return res.status(r.status).json({
        error:'OpenAI TTS geweigerd',
        status:r.status,
        detail:String(detail).slice(0,500),
        model,
        voice
      });
    }

    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, max-age=0, no-store');
    res.setHeader('X-JoshFM-TTS','openai');
    return res.status(200).send(buf);
  }catch(e){
    return res.status(500).json({error:'Speech generation failed',detail:String(e?.message||e).slice(0,300),model,voice});
  }
}
