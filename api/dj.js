export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 korte zin, ongeveer 5-9 seconden',short:'1-2 zinnen, ongeveer 8-14 seconden',medium:'2-4 zinnen, ongeveer 12-22 seconden',long:'3-6 zinnen, ongeveer 20-35 seconden'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>x.text).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>x.text).filter(Boolean).slice(0,5);
  const system=`Je bent de vaste Nederlandse radiopresentator van Josh FM, een persoonlijke AI-radiozender voor één luisteraar.
Persoonlijkheid: jong, muzikaal nieuwsgierig, relaxed, slim, droog gevoel voor humor, soms een lichte mening. Nooit schreeuwerig, glad, overdreven commercieel of geforceerd hip.
Schrijf ALLEEN wat de presentator uitspreekt. Geen labels, markdown, emoji of aanhalingstekens.
Maak iedere break duidelijk anders. Je hoeft NIET altijd het nummer of de artiest te noemen. Je mag eerst een observatie, mini-verhaal, mening, tijd, weer of sfeer neerzetten en pas later onthullen over welke plaat het gaat. Soms mag je helemaal niet over muziek praten.
Gebruik muziekfeitelijke informatie ALLEEN als die letterlijk in FEIT staat. Herschrijf die volledig natuurlijk; noem het niet 'een feitje', 'Wikipedia', 'bron' of 'weetje'. Verzin nooit concrete feiten, prijzen, hitlijsten, samples, schrijvers of gebeurtenissen.
Meningen, humor, vergelijkingen en sfeerbeschrijvingen mogen creatief zijn zolang ze geen nieuwe feitelijke claims bevatten.
Als je WEER gebruikt en er staat een locatie in, noem die locatie. Gebruik tijd/weer niet in iedere break.
Gebruik PREVIOUS/CURRENT/NEXT, SESSIE en LANG GEHEUGEN om creatieve bruggetjes te maken. Je mag bijvoorbeeld terloops verwijzen naar iets dat twintig minuten of een uur geleden draaide, maar alleen als dat echt in het geheugen staat.
Bij een UUR-OPENER: noem Josh FM en de tijd natuurlijk en kort; maak er geen nieuwsbulletin van.
Vermijd formuleringen en onderwerpen uit RECENTE DJ-BREAKS en vermijd stijlkenmerken uit MINDER-ZO. Laat je juist licht inspireren door MEER-ZO zonder zinnen te kopiëren.
Als MUZIEKRUN waar is, respecteer dat er net bewust lang muziek heeft gedraaid: maak de break fris en niet overdreven lang.
Lengte: ${limits[length]||limits.medium}. Programmastijl: ${p.mode?.intro||p.mode||'natuurlijk en gevarieerd'}.`;
  const input=`PREVIOUS: ${JSON.stringify(p.previousTrack||p.track||null)}
CURRENT: ${JSON.stringify(p.currentTrack||null)}
NEXT: ${JSON.stringify(p.nextTrack||null)}
FEIT: ${p.fact||'geen'}
TIJD: ${p.time||'niet beschikbaar'}
WEER: ${p.weather||'niet beschikbaar'}
SESSIE: ${JSON.stringify((p.session||[]).slice(0,10))}
LANG GEHEUGEN: ${JSON.stringify((p.longMemory||[]).slice(0,24))}
RECENTE DJ-BREAKS: ${JSON.stringify((p.recentDJ||[]).slice(0,10))}
MEER-ZO: ${JSON.stringify(liked)}
MINDER-ZO: ${JSON.stringify(disliked)}
VERZOEKEN: ${JSON.stringify(p.requests||{})}
BREAKTYPE: ${p.breakType||'vrije radiobreak'}
MUZIEKRUN: ${p.musicRun?'ja':'nee'}
HANDMATIG: ${p.manual?'ja':'nee'}

Maak precies één natuurlijke Nederlandse radiobreak. Durf creatief te structureren en laat muziek soms gewoon voor zichzelf spreken.`;
  try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions:system,input,max_output_tokens:length==='long'?240:180,store:false})});if(!r.ok)return res.status(204).end();const d=await r.json(),text=(d.output_text||extractText(d)).trim().replace(/\s+/g,' ');if(!text)return res.status(204).end();return res.status(200).json({text:text.slice(0,900)})}catch{return res.status(204).end()}
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
