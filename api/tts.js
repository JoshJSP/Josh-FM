export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'TTS not configured'});

  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Missing text'});

  const jingle=!!req.body?.jingle;
  const instructions=jingle
    ? `Spreek dit als een korte Nederlandse FM-radio station-ID. Klink energiek maar stijlvol, warm en geloofwaardig. Geen Amerikaanse announcer-stem, geen overdreven bas, geen reclame-intonatie. Houd het compact, helder en natuurlijk.`
    : `Spreek vloeiend Nederlands als een ervaren Nederlandse FM-radiopresentator van ongeveer 25 tot 35 jaar. Klink warm, ontspannen, zelfverzekerd en menselijk, alsof je live vanuit een radiostudio tegen één luisteraar praat.

Gebruik een licht lage, rustige spreekstem met subtiele natuurlijke variatie. Spreek niet te snel. Laat kleine natuurlijke pauzes vallen tussen gedachten en zinnen. Leg alleen nadruk waar een echte presentator dat zou doen. Vermijd perfecte, vlakke AI-cadans, overdreven articulatie, reclame-intonatie, voice-overstijl en overdreven enthousiasme.

Artiest- en songtitels mogen iets losser en natuurlijker uitgesproken worden. Houd Nederlandse woorden duidelijk Nederlands; probeer Engelse namen niet onnatuurlijk te vernederlandsen. Klink spontaan, licht droog en professioneel, alsof dit een echte late-night of daytime radioshow is. Geen hoorbare lijstjes, geen opgewekte klantenservice-stem en geen toneelstem.`;

  try{
    const r=await fetch('https://api.openai.com/v1/audio/speech',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${key}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',
        voice:process.env.OPENAI_TTS_VOICE||'cedar',
        input:text,
        instructions,
        response_format:'mp3',
        speed:jingle?1.0:0.94
      })
    });

    if(!r.ok){
      const detail=await r.text();
      return res.status(502).json({error:'OpenAI speech error',detail:detail.slice(0,400)});
    }

    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Cache-Control','private, max-age=0, no-store');
    return res.status(200).send(buf);
  }catch(e){
    return res.status(500).json({error:'Speech generation failed'});
  }
}
