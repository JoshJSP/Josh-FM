export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const base=String(process.env.PIPER_TTS_URL||'').replace(/\/+$/,'');
  if(!base)return res.status(503).json({error:'PIPER_TTS_URL ontbreekt in Vercel'});
  const text=String(req.body?.text||'').trim().slice(0,1200);
  if(!text)return res.status(400).json({error:'Tekst ontbreekt'});
  const jingle=!!req.body?.jingle;
  const body={text,length_scale:jingle?0.96:1.03,noise_scale:jingle?0.62:0.58,noise_w_scale:jingle?0.82:0.78};
  try{
    const r=await fetch(base+'/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){let detail='';try{detail=(await r.text()).slice(0,400)}catch{};return res.status(r.status).json({error:'Piper TTS geweigerd',detail})}
    const buf=Buffer.from(await r.arrayBuffer());
    if(!buf.length)return res.status(502).json({error:'Piper gaf lege audio terug'});
    res.setHeader('Content-Type',r.headers.get('content-type')||'audio/wav');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-JoshFM-TTS','piper');
    return res.status(200).send(buf);
  }catch(e){return res.status(502).json({error:'Piper is niet bereikbaar',detail:String(e?.message||e).slice(0,300)})}
}
