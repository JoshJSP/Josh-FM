export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'missing_openai_key'});
  const {seeds=[],count=10,mode='normal'}=req.body||{};
  const wanted=Math.max(1,Math.min(24,Number(count)||10));
  const sample=seeds.slice(0,24).map(x=>`${x.name} — ${(x.artists||[]).join(', ')}${x.liked?` | waardering ${x.liked}`:''}${x.skipped?` | ${x.skipped}x geskipt`:''}`).join('\n');
  const instructions=`Je bent de muziekprogrammeur van Josh FM. Adviseer alleen echte, officieel uitgebrachte nummers. Baseer aanbevelingen op het luisterprofiel, maar varieer bewust in artiest, periode en stijl. Geef uitsluitend JSON met exact deze vorm: {"tracks":[{"title":"titel","artist":"artiest","reason":"korte Nederlandse interne reden"}]}. Geen markdown en geen extra tekst.`;
  const input=`Bedenk maximaal ${wanted} bestaande nummers die waarschijnlijk bij deze luisteraar passen maar niet letterlijk in de lijst hieronder staan. Positieve waarderingen zijn een sterk signaal; vaak geskipt is negatief. Kies niet alleen dezelfde artiesten of de allergrootste hits. Radiomodus: ${mode}.\n\nLuisterprofiel:\n${sample||'Geen profiel beschikbaar.'}`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions,input,max_output_tokens:1200,store:false,text:{format:{type:'json_schema',name:'music_discovery',strict:true,schema:{type:'object',properties:{tracks:{type:'array',items:{type:'object',properties:{title:{type:'string'},artist:{type:'string'},reason:{type:'string'}},required:['title','artist','reason'],additionalProperties:false}}},required:['tracks'],additionalProperties:false}}}})});
    const raw=await r.json();if(!r.ok)return res.status(r.status).json({error:'openai_error',detail:raw?.error?.message||'Unknown error'});
    const text=(raw.output_text||extractText(raw)).trim();let data={tracks:[]};try{data=JSON.parse(text)}catch{return res.status(502).json({error:'invalid_discovery_json'})}
    const tracks=Array.isArray(data.tracks)?data.tracks.filter(x=>x?.title&&x?.artist).slice(0,wanted):[];
    return res.status(200).json({tracks});
  }catch(e){return res.status(500).json({error:'discovery_failed',detail:String(e?.message||e)})}
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('')}catch{return''}}
