export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'TTS not configured'});
  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Missing text'});
  const jingle=!!req.body?.jingle;
  const instructions=jingle
    ? 'Spreek in natuurlijk Nederlands als een korte, energieke maar stijlvolle radio station-ID. Helder, warm en zelfverzekerd. Geen overdreven Amerikaanse radio-intonatie.'
    : 'Spreek vloeiend Nederlands als een moderne Nederlandse radiopresentator. Warm, ontspannen, zelfverzekerd en natuurlijk. Licht tempo, geen overdreven reclame-intonatie.';
  try{
    const r=await fetch('https://api.openai.com/v1/audio/speech',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',voice:process.env.OPENAI_TTS_VOICE||'cedar',input:text,instructions,response_format:'mp3'})
    });
    if(!r.ok) return res.status(502).json({error:'OpenAI speech error'});
    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, max-age=0, no-store');
    return res.status(200).send(buf);
  }catch(e){return res.status(500).json({error:'Speech generation failed'})}
}
