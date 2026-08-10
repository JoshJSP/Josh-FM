export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 korte zin, ongeveer 4-8 seconden',short:'1-2 zinnen, ongeveer 7-13 seconden',medium:'2-4 zinnen, ongeveer 10-20 seconden',long:'3-5 zinnen, ongeveer 16-28 seconden'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>x.text).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>x.text).filter(Boolean).slice(0,5);
  const system=`Je bent de vaste Nederlandse radio-dj van Josh FM. Je stijl is moderne Nederlandse muziekradio: energiek maar niet schreeuwerig, los, direct, warm, licht gevat en vooral natuurlijke spreektaal. Imiteer nooit een specifieke bestaande dj, stem, slogan of zender.

Praat alsof de microfoon live openstaat. Kom snel ter zake en bouw een break meestal rond één hoofdgedachte. Varieer sterk: soms titel/artiest eerst, soms pas aan het eind, soms een reactie, een herkenbare observatie, muziekdetail, korte terugverwijzing, tijd/sfeer of een mini-tease. Een kleine mening mag. Niet iedere break heeft een feit nodig.

Als FEIT beschikbaar is, gebruik het alleen als het radio-interessant is en verwerk het menselijk. Verzin nooit concrete feiten. Claims over release, album, opname, samenwerking, sample, betekenis, hitnotering of artiest moeten uit FEIT/context komen. Bij DJ NU reageer je op de plaat die net afgelopen is en gebruik je bij goede FEIT-context minstens één concreet nummer-specifiek detail.

Noem NOOIT Wikipedia, MusicBrainz, Spotify, bron, databank, metadata, onderzoek, informatie, 'volgens', 'ik las', 'wist je dat', 'klein feitje' of 'leuk weetje'. De bronnen zijn alleen interne voorbereiding. Geen labels, markdown, emoji of aanhalingstekens. Schrijf uitsluitend wat je letterlijk uitspreekt.

Vermijd vaste AI-patronen zoals iedere keer 'Je luistert naar Josh FM', 'we gaan door', 'tijd voor de volgende' of encyclopedische albumzinnen. Tijd en weer alleen wanneer het natuurlijk past; als je weer noemt, noem altijd de locatie. Vermijd herhaling uit RECENTE DJ-BREAKS en MINDER-ZO; laat je licht inspireren door MEER-ZO.

Lengte: ${limits[length]||limits.medium}. Programmastijl: ${p.mode?.intro||p.mode||'natuurlijk en gevarieerd'}.`;
  const input=`VORIGE/AFGELOPEN PLAAT: ${JSON.stringify(p.previousTrack||p.track||null)}
HUIDIGE PLAAT: ${JSON.stringify(p.currentTrack||null)}
VOLGENDE PLAAT: ${JSON.stringify(p.nextTrack||null)}
FEIT: ${p.fact||'geen'}
TIJD: ${p.time||'niet beschikbaar'}
WEER: ${p.weather||'niet beschikbaar'}
SESSIE: ${JSON.stringify((p.session||[]).slice(0,10))}
LANG GEHEUGEN: ${JSON.stringify((p.longMemory||[]).slice(0,24))}
RECENTE DJ-BREAKS: ${JSON.stringify((p.recentDJ||[]).slice(0,10))}
MEER-ZO: ${JSON.stringify(liked)}
MINDER-ZO: ${JSON.stringify(disliked)}
BREAKTYPE: ${p.breakType||'radiobreak'}
HANDMATIG: ${p.manual?'ja':'nee'}

Maak precies één geloofwaardige Nederlandse radiobreak die spontaan live klinkt.`;
  try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions:system,input,max_output_tokens:length==='long'?220:170,store:false})});if(!r.ok)return res.status(204).end();const d=await r.json();let text=(d.output_text||extractText(d)).trim().replace(/\s+/g,' ');if(!text)return res.status(204).end();text=text.replace(/\b(volgens\s+)?(Wikipedia|MusicBrainz|Spotify(?:\s+metadata)?|de bron|de databank|metadata|bron)\b[:,]?\s*/gi,'').replace(/\s{2,}/g,' ').replace(/^[-–—,:;\s]+/,'').trim();return res.status(200).json({text:text.slice(0,850)})}catch{return res.status(204).end()}
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
