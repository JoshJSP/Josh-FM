const DEFAULT_PIPER='https://josh-fm.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const base=String(process.env.PIPER_TTS_URL||DEFAULT_PIPER).replace(/\/+$/,'');
  const text=String(req.body?.text||'').trim().slice(0,1200);
  if(!text)return res.status(400).json({error:'Tekst ontbreekt'});
  const jingle=!!req.body?.jingle;
  const body={text,length_scale:jingle?0.96:1.03,noise_scale:jingle?0.62:0.58,noise_w_scale:jingle?0.82:0.78};

  let lastDetail='',lastStatus=0,lastType='';
  try{
    // Render Free may answer with a temporary HTML/spin-up page while the service wakes.
    // Do not treat HTTP 200 as success until Piper actually returns audio.
    for(let attempt=1;attempt<=5;attempt++){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),30000);
      let r;
      try{
        r=await fetch(base+'/synthesize',{
          method:'POST',
          headers:{'Content-Type':'application/json','Accept':'audio/wav,audio/*'},
          body:JSON.stringify(body),
          signal:controller.signal
        });
      }finally{clearTimeout(timeout)}

      lastStatus=r.status;
      lastType=(r.headers.get('content-type')||'').toLowerCase();
      if(r.ok&&lastType.includes('audio')){
        const buf=Buffer.from(await r.arrayBuffer());
        if(buf.length){
          res.setHeader('Content-Type',lastType||'audio/wav');
          res.setHeader('Cache-Control','private, no-store');
          res.setHeader('X-JoshFM-TTS','piper');
          res.setHeader('X-JoshFM-Piper-Attempt',String(attempt));
          return res.status(200).send(buf);
        }
        lastDetail='Piper gaf een leeg audiobestand terug.';
      }else{
        try{lastDetail=(await r.text()).replace(/\s+/g,' ').trim().slice(0,300)}catch{lastDetail=''}
      }

      if(attempt<5)await sleep(attempt===1?1500:2500);
    }

    return res.status(502).json({
      error:'Piper gaf na meerdere pogingen geen audio terug',
      detail:lastDetail||`content-type: ${lastType||'onbekend'}`,
      upstream_status:lastStatus,
      upstream_type:lastType,
      host:base
    });
  }catch(e){
    const timedOut=e?.name==='AbortError';
    return res.status(502).json({
      error:timedOut?'Piper werd niet op tijd wakker':'Piper is niet bereikbaar',
      detail:String(e?.message||e).slice(0,300),
      upstream_status:lastStatus,
      upstream_type:lastType,
      host:base
    });
  }
}
