export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.ELEVENLABS_API_KEY;
  const voice=process.env.ELEVENLABS_VOICE_ID;
  if(!key) return res.status(503).json({error:'ElevenLabs niet geconfigureerd',code:'missing_elevenlabs_key'});
  if(!voice) return res.status(503).json({error:'ElevenLabs Voice ID ontbreekt',code:'missing_elevenlabs_voice'});
  const text=String(req.body?.text||'').slice(0,1200);
  if(!text) return res.status(400).json({error:'Tekst ontbreekt'});
  try{
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,{
      method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({text,model_id:process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2',voice_settings:{stability:0.38,similarity_boost:0.78,style:0.18,use_speaker_boost:true,speed:req.body?.jingle?1.02:0.96}})
    });
    if(!r.ok){let detail='';try{detail=(await r.text()).slice(0,500)}catch{};return res.status(r.status).json({error:'ElevenLabs TTS geweigerd',detail});}
    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Josh-FM-Voice','ElevenLabs');return res.status(200).send(buf);
  }catch(e){return res.status(500).json({error:'ElevenLabs verbinding mislukt',detail:String(e?.message||e).slice(0,300)})}
}
