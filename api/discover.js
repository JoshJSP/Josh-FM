import {claudeText,groqText,hasClaude,hasGroq} from './_ai.js';
// Deze route doet zelf geen fetch meer: _ai.js bewaakt de deadlines.
const GROQ_MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
const RATE=new Map();
function rateLimit(req,res){const windowMs=60000,limit=20,ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80),now=Date.now(),fresh=(RATE.get(ip)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`});return false}fresh.push(now);RATE.set(ip,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!rateLimit(req,res))return;
  if(!hasClaude()&&!hasGroq())return res.status(503).json({error:'missing_ai_key'});
  const {seeds=[],count=10,mode='normal'}=req.body||{};
  const wanted=Math.max(1,Math.min(12,Number(count)||10));
  const sample=(Array.isArray(seeds)?seeds:[]).slice(0,14).map(x=>`${String(x?.name||'').slice(0,180)} — ${(Array.isArray(x?.artists)?x.artists:[]).slice(0,4).map(a=>String(a).slice(0,120)).join(', ')}${x?.liked?` | waardering ${Number(x.liked)||0}`:''}${x?.skipped?` | ${Number(x.skipped)||0}x geskipt`:''}`).join('\n').slice(0,5000);
  const instructions=`Je bent de muziekprogrammeur van MAIR. Adviseer alleen echte, officieel uitgebrachte nummers die op Spotify te vinden horen te zijn. Baseer aanbevelingen op het luisterprofiel, maar varieer bewust in artiest, periode en stijl. Antwoord uitsluitend met geldig JSON in deze vorm: {"tracks":[{"title":"titel","artist":"artiest","reason":"korte Nederlandse interne reden"}]}. Geen markdown, geen codeblok en geen extra tekst.`;
  const input=`Bedenk maximaal ${wanted} bestaande nummers die waarschijnlijk bij deze luisteraar passen maar niet letterlijk in de lijst hieronder staan. Positieve waarderingen zijn een sterk signaal; vaak geskipt is negatief. Kies een mix van logische matches en iets verrassendere ontdekkingen. Radiomodus: ${String(mode||'normal').slice(0,80)}.\n\nLuisterprofiel:\n${sample||'Geen profiel beschikbaar.'}`;
  const attempts=[];
  try{
    // Claude schrijft, Groq vangt op. Eén bruikbare tracklijst is genoeg.
    for(const call of providers({instructions,input})){
      const out=await call();
      if(!out.ok){attempts.push({provider:out.provider,model:out.model,status:out.status,error:out.error});continue}
      const data=parseDiscovery(out.text);
      if(!data){attempts.push({provider:out.provider,model:out.model,status:502,error:'AI gaf geen bruikbare tracklijst terug'});continue}
      const seen=new Set();const tracks=(Array.isArray(data.tracks)?data.tracks:[]).filter(x=>x?.title&&x?.artist).filter(x=>{const k=`${x.title}|${x.artist}`.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,wanted).map(x=>({title:String(x.title).trim().slice(0,220),artist:String(x.artist).trim().slice(0,180),reason:String(x.reason||'Past bij je luisterprofiel.').trim().slice(0,300)}));
      if(!tracks.length){attempts.push({provider:out.provider,model:out.model,status:502,error:'AI gaf een lege tracklijst terug'});continue}
      return res.status(200).json({tracks,provider:out.provider,model:out.model,attempts});
    }
  }catch(e){return res.status(500).json({error:'discovery_failed',detail:String(e?.message||e).slice(0,500),attempts})}
  const last=attempts.at(-1)||{status:502,error:'Geen enkele aanbieder gaf een tracklijst terug'};
  const status=[401,403,429].includes(last.status)?last.status:last.status===504?504:502;
  return res.status(status).json({error:status===504?'discovery_timeout':'invalid_discovery_json',detail:String(last.error||'').slice(0,500),attempts});
}
// Volgorde van aanbieders voor één discovery-verzoek: Claude eerst, dan de
// Groq-keten. Elke stap is een functie zodat een geslaagde eerste poging de
// rest nooit aanroept.
function providers({instructions,input}){
  const list=[];
  if(hasClaude())list.push(()=>claudeText({system:instructions,user:input,maxTokens:4000,effort:'medium',timeoutMs:12000}));
  if(hasGroq())for(const model of GROQ_MODELS)list.push(()=>groqText({model,system:instructions,user:input,maxCompletionTokens:1200,temperature:.7,topP:.9,timeoutMs:9000}));
  return list;
}
function parseDiscovery(text){
  try{return JSON.parse(text)}catch{}
  const cleaned=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}
  return null;
}
