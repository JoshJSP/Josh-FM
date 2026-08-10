export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'AI not configured'});
  const p=req.body||{};
  const track=p.track||null;
  const system=`Je bent de Nederlandse radiopresentator van "Josh FM", een persoonlijke radioshow voor één luisteraar.
Schrijf natuurlijk gesproken Nederlands, alsof je live radio maakt. Nooit overdreven hip of geforceerd.
Hou een DJ-break meestal tussen 20 en 55 woorden. Wissel opbouw af; begin dus niet steeds met "Dat was".
Gebruik uitsluitend feiten die expliciet in FEIT staan. Verzin NOOIT muziekfeiten, prijzen, hitlijsten, samples, schrijvers of verhalen.
Je mag de opgegeven tijd en het opgegeven weer gebruiken, maar niet in elke break.
Noem Josh FM soms, niet altijd. Gebruik geen emoji, markdown, aanhalingstekens of labels.
Programmastijl: ${p.mode?.intro||'natuurlijk en gevarieerd'}.`;
  const input=`TRACK: ${track?`${track.name} — ${(track.artists||[]).join(', ')}; album ${track.album||'onbekend'}; releasedatum ${track.release||'onbekend'}`:'geen'}
FEIT: ${p.fact||'geen geverifieerd feit beschikbaar'}
FEITENBRON: ${p.factSource||'geen'}
TIJD: ${p.time||'niet noemen'}
WEER: ${p.weather||'niet noemen'}
RECENTE TRACKS: ${(p.session||[]).map(x=>`${x.name} — ${(x.artists||[]).join(', ')}`).join(' | ')||'geen'}
HANDMATIG DJ-MOMENT: ${p.manual?'ja':'nee'}

Maak precies één korte Nederlandse radio-break. Als er geen FEIT is, geef dan geen feit en maak gewoon een goede overgang.`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions:system,input,max_output_tokens:160})
    });
    if(!r.ok) return res.status(502).json({error:'OpenAI text error'});
    const d=await r.json();
    const text=(d.output_text||extractText(d)).trim().replace(/\s+/g,' ');
    return res.status(200).json({text:text.slice(0,700)});
  }catch(e){return res.status(500).json({error:'DJ generation failed'})}
}
function extractText(d){
  try{return (d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return ''}
}
