async function timedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
const safe=(v,n=1200)=>String(v??'').slice(0,n);
const track=t=>t?{name:safe(t.name,180),artists:Array.isArray(t.artists)?t.artists.map(x=>typeof x==='string'?x:x?.name).filter(Boolean).slice(0,4):[],release:safe(t.release||t.album?.release_date,20),request:!!t.request}:null;
const DEFAULT_MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
const RATE=new Map();
function rateLimit(req,res){const windowMs=60000,limit=20,ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80),now=Date.now(),fresh=(RATE.get(ip)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`,provider:'groq'});return false}fresh.push(now);RATE.set(ip,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!rateLimit(req,res))return;
  const key=process.env.GROQ_API_KEY;if(!key)return res.status(503).json({error:'GROQ_API_KEY ontbreekt'});
  const p=req.body||{},explicit=safe(process.env.GROQ_DJ_MODEL||'',120),models=[...new Set([explicit,...DEFAULT_MODELS].filter(Boolean))].slice(0,3);
  const dj=safe(p.dj?.name||p.djName||'Josh',40),role=safe(p.dj?.role||'MAIR DJ',80),kind=safe(p.breakType||'normal',40);
  const previous=track(p.previousTrack),current=track(p.currentTrack),next=track(p.nextTrack);
  const system=`Je schrijft uitsluitend de gesproken tekst voor een Nederlandse muziek-radio-DJ op MAIR. Je bent de schrijver, niet de stem en niet de technicus. Schrijf natuurlijk Nederlands zoals een moderne radio-dj: kort, spontaan, warm en zelfverzekerd. Noem artiesten en titels exact zoals aangeleverd. Verzin nooit feiten. Gebruik alleen meegeleverde feiten/context. Noem nooit AI, API's, Groq, Fish Audio, Spotify, metadata, prompts of bronnen. Geen markdown, labels, emoji of regieaanwijzingen. Geen neptelefoontjes, wedstrijden, hitlijsten of persoonlijke verhalen. Wissel zinsbouw af. Niet elke break hoeft MAIR te noemen. Eindig natuurlijk richting de muziek. Maximaal 55 woorden, behalve wanneer length=long dan maximaal 85 woorden.`;
  const user=`DJ: ${dj} (${role})\nBREAK TYPE: ${kind}\nLENGTH: ${safe(p.length||'short',20)}\nVORIGE TRACK: ${JSON.stringify(previous)}\nHUIDIGE TRACK: ${JSON.stringify(current)}\nVOLGENDE TRACK: ${JSON.stringify(next)}\nTIJD: ${safe(p.time||'',80)}\nSTATION/MIX: ${safe(p.station||'',120)}\nWEER: ${safe(typeof p.weather==='string'?p.weather:JSON.stringify(p.weather||''),400)}\nFEIT: ${safe(p.fact||'',700)}\nRECENTE DJ-BREAKS: ${safe(JSON.stringify((p.recentDJ||[]).slice(0,6)),1500)}\n\nSchrijf precies één radiolink. Kies maximaal twee doelen: kort terugblikken, een relevant feit/contextpunt, een verzoek benoemen, tijd/station-id of vooruit praten naar de muziek. Return alleen wat de DJ letterlijk uitspreekt.`;
  const attempts=[];
  for(const model of models){
    try{
      const r=await timedFetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:user}],temperature:.78,max_tokens:220,top_p:.9})},5000);
      const d=await r.json().catch(()=>({}));
      if(!r.ok){const error=safe(d?.error?.message||`Groq HTTP ${r.status}`,500);attempts.push({model,status:r.status,error});if([401,403,429].includes(r.status))break;continue}
      let text=String(d?.choices?.[0]?.message?.content||'').replace(/\s+/g,' ').replace(/^['"“”]+|['"“”]+$/g,'').trim();
      if(!text){attempts.push({model,status:502,error:'Groq gaf geen DJ-tekst terug'});continue}
      if(text.length>900)text=text.slice(0,900).replace(/\s+\S*$/,'').trim();
      return res.status(200).json({text,provider:'groq',model,usage:d?.usage||null,attempts});
    }catch(e){attempts.push({model,status:e?.name==='AbortError'?504:500,error:e?.name==='AbortError'?'Groq timeout':safe(e?.message||e,500)})}
  }
  const last=attempts.at(-1)||{model:models[0],status:502,error:'Groq gaf geen DJ-tekst terug'},passthrough=[401,403,429].includes(last.status)?last.status:last.status===504?504:502;
  return res.status(passthrough).json({error:last.error,provider:'groq',model:last.model,attempts});
}
