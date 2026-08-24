async function timedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
const RATE=new Map();
function rateLimit(req,res){const windowMs=60000,limit=20,ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80),now=Date.now(),fresh=(RATE.get(ip)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`});return false}fresh.push(now);RATE.set(ip,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!rateLimit(req,res))return;
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'missing_openai_key'});
  const {seeds=[],count=10,mode='normal'}=req.body||{};
  const wanted=Math.max(1,Math.min(12,Number(count)||10));
  const sample=(Array.isArray(seeds)?seeds:[]).slice(0,14).map(x=>`${String(x?.name||'').slice(0,180)} — ${(Array.isArray(x?.artists)?x.artists:[]).slice(0,4).map(a=>String(a).slice(0,120)).join(', ')}${x?.liked?` | waardering ${Number(x.liked)||0}`:''}${x?.skipped?` | ${Number(x.skipped)||0}x geskipt`:''}`).join('\n').slice(0,5000);
  const instructions=`Je bent de muziekprogrammeur van Josh FM. Adviseer alleen echte, officieel uitgebrachte nummers die op Spotify te vinden horen te zijn. Baseer aanbevelingen op het luisterprofiel, maar varieer bewust in artiest, periode en stijl. Antwoord uitsluitend met geldig JSON in deze vorm: {"tracks":[{"title":"titel","artist":"artiest","reason":"korte Nederlandse interne reden"}]}. Geen markdown, geen codeblok en geen extra tekst.`;
  const input=`Bedenk maximaal ${wanted} bestaande nummers die waarschijnlijk bij deze luisteraar passen maar niet letterlijk in de lijst hieronder staan. Positieve waarderingen zijn een sterk signaal; vaak geskipt is negatief. Kies een mix van logische matches en iets verrassendere ontdekkingen. Radiomodus: ${String(mode||'normal').slice(0,80)}.\n\nLuisterprofiel:\n${sample||'Geen profiel beschikbaar.'}`;
  try{
    const r=await timedFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions,input,max_output_tokens:1200,store:false})},12000);
    const raw=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:'openai_error',detail:String(raw?.error?.message||'OpenAI discovery request failed').slice(0,500)});
    const text=(raw.output_text||extractText(raw)).trim();
    const data=parseDiscovery(text);if(!data)return res.status(502).json({error:'invalid_discovery_json',detail:'AI gaf geen bruikbare tracklijst terug'});
    const seen=new Set();const tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(x=>x?.title&&x?.artist).filter(x=>{const k=`${x.title}|${x.artist}`.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,wanted).map(x=>({title:String(x.title).trim().slice(0,220),artist:String(x.artist).trim().slice(0,180),reason:String(x.reason||'Past bij je luisterprofiel.').trim().slice(0,300)}));
    return res.status(200).json({tracks});
  }catch(e){return res.status(e?.name==='AbortError'?504:500).json({error:e?.name==='AbortError'?'discovery_timeout':'discovery_failed',detail:String(e?.name==='AbortError'?'Discovery AI timed out':e?.message||e).slice(0,500)})}
}
function parseDiscovery(text){
  try{return JSON.parse(text)}catch{}
  const cleaned=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}
  return null;
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('')}catch{return''}}
