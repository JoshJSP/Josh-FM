export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'missing_openai_key'});
  const {seeds=[],count=10,mode='normal'}=req.body||{};
  const sample=seeds.slice(0,24).map(x=>`${x.name} — ${(x.artists||[]).join(', ')}${x.liked?` | waardering ${x.liked}`:''}${x.skipped?` | ${x.skipped}x geskipt`:''}`).join('\n');
  const prompt=`Je bent de muziekprogrammeur van Josh FM, een persoonlijke Nederlandse radiozender. Bedenk ${Math.max(1,Math.min(24,count))} BESTAANDE Spotify-nummers die waarschijnlijk passen bij de luisteraar maar niet letterlijk in de lijst staan.
Gebruik positieve waarderingen als sterk signaal. Vermijd stijlen die duidelijk vaak worden geskipt. Zoek niet alleen dezelfde artiesten of de grootste hits: combineer verwante artiesten, genres, landen, tijdperken, productiestijlen en energie. Zorg dat ontdekkingen logisch tussen bekende tracks kunnen draaien. Radiomodus: ${mode}.

Luisterprofiel:\n${sample}\n
Geef uitsluitend geldige JSON: {"tracks":[{"title":"...","artist":"...","reason":"korte interne reden"}]}. Verzin nooit niet-bestaande nummers.`;
  try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:'Return only valid JSON. Recommend only real released songs; never invent tracks.'},{role:'user',content:prompt}],temperature:.82,response_format:{type:'json_object'}})});const raw=await r.json();if(!r.ok)return res.status(r.status).json({error:'openai_error',detail:raw?.error?.message||'Unknown error'});let data={tracks:[]};try{data=JSON.parse(raw.choices?.[0]?.message?.content||'{}')}catch{}const tracks=Array.isArray(data.tracks)?data.tracks.filter(x=>x?.title&&x?.artist).slice(0,24):[];return res.status(200).json({tracks})}catch(e){return res.status(500).json({error:'discovery_failed',detail:String(e?.message||e)})}
}
