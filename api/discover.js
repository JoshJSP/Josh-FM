export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'missing_openai_key'});
  const {seeds=[],count=10,mode='normal'}=req.body||{};
  const wanted=Math.max(1,Math.min(24,Number(count)||10));
  const sample=seeds.slice(0,20).map(x=>`${x.name} — ${(x.artists||[]).join(', ')}${x.liked?` | waardering ${x.liked}`:''}${x.skipped?` | ${x.skipped}x geskipt`:''}`).join('\n');
  const instructions=`Je bent de muziekprogrammeur van Josh FM. Adviseer alleen echte, officieel uitgebrachte nummers die op Spotify te vinden horen te zijn. Baseer aanbevelingen op het luisterprofiel, maar varieer bewust in artiest, periode en stijl. Antwoord uitsluitend met geldig JSON in deze vorm: {"tracks":[{"title":"titel","artist":"artiest","reason":"korte Nederlandse interne reden"}]}. Geen markdown, geen codeblok en geen extra tekst.`;
  const input=`Bedenk maximaal ${wanted} bestaande nummers die waarschijnlijk bij deze luisteraar passen maar niet letterlijk in de lijst hieronder staan. Positieve waarderingen zijn een sterk signaal; vaak geskipt is negatief. Kies een mix van logische matches en iets verrassendere ontdekkingen. Radiomodus: ${mode}.\n\nLuisterprofiel:\n${sample||'Geen profiel beschikbaar.'}`;
  try{
    // Keep this endpoint deliberately simple. Structured-output schema support can differ between
    // configured Responses API models; plain JSON instructions work across the models Josh FM uses.
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions,input,max_output_tokens:1800,store:false})});
    const raw=await r.json();if(!r.ok)return res.status(r.status).json({error:'openai_error',detail:raw?.error?.message||'OpenAI discovery request failed'});
    const text=(raw.output_text||extractText(raw)).trim();
    const data=parseDiscovery(text);if(!data)return res.status(502).json({error:'invalid_discovery_json',detail:'AI gaf geen bruikbare tracklijst terug'});
    const seen=new Set();const tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(x=>x?.title&&x?.artist).filter(x=>{const k=`${x.title}|${x.artist}`.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,wanted).map(x=>({title:String(x.title).trim(),artist:String(x.artist).trim(),reason:String(x.reason||'Past bij je luisterprofiel.').trim()}));
    return res.status(200).json({tracks});
  }catch(e){return res.status(500).json({error:'discovery_failed',detail:String(e?.message||e)})}
}
function parseDiscovery(text){
  try{return JSON.parse(text)}catch{}
  // Recover if a model wrapped otherwise-valid JSON in prose/code fences.
  const cleaned=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}
  return null;
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('')}catch{return''}}
