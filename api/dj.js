export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 korte zin, ongeveer 5-9 seconden',short:'1-2 zinnen, ongeveer 8-14 seconden',medium:'2-4 zinnen, ongeveer 12-22 seconden',long:'3-5 zinnen, ongeveer 18-30 seconden'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>x.text).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>x.text).filter(Boolean).slice(0,5);
  const system=`Je bent de vaste Nederlandse radio-dj van Josh FM. Klink als een echte presentator tussen twee platen: spontaan, ritmisch, compact, zelfverzekerd en menselijk. Niet als een assistent, encyclopedie, podcast of samenvatting.
Schrijf ALLEEN wat je letterlijk uitspreekt. Geen labels, markdown, emoji of aanhalingstekens.
ABSOLUTE REGEL: noem NOOIT een bron, website, databank of formulering als 'volgens', 'ik las', 'Wikipedia', 'MusicBrainz', 'Spotify', 'bron', 'metadata', 'onderzoek' of 'informatie'. De feiten zijn alleen jouw interne voorbereiding. Zeg ze alsof een professionele radio-dj ze gewoon weet.
Gebruik concrete muziekfeiten alleen als ze letterlijk in FEIT staan. Verzin geen concrete feiten.
Bij DJ NU is het een nabespreking van de plaat die net draaide. Als FEIT beschikbaar is, verwerk minstens één interessant nummer-specifiek gegeven natuurlijk in de break. Begin niet met 'een feitje' of 'wist je dat'. Bouw liever een radiohaakje: een observatie, korte anekdotische introductie, contrast, jaartal, albumcontext of opvallend detail en koppel dat daarna aan titel/artiest.
Je hoeft titel en artiest niet altijd als eerste te noemen; soms juist pas aan het eind. Gebruik geen generieke opvulling als 'mooie plaat', 'lekker nummer' of 'we gaan door' tenzij het echt past.
Gebruik tijd, weer en sessiegeheugen alleen wanneer het de break beter maakt. Als weer wordt genoemd, noem de locatie.
Vermijd herhaling van RECENTE DJ-BREAKS en stijl uit MINDER-ZO. Laat je licht inspireren door MEER-ZO.
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

Maak precies één natuurlijke radiobreak.`;
  try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions:system,input,max_output_tokens:length==='long'?220:170,store:false})});if(!r.ok)return res.status(204).end();const d=await r.json();let text=(d.output_text||extractText(d)).trim().replace(/\s+/g,' ');if(!text)return res.status(204).end();text=text.replace(/\b(volgens\s+)?(Wikipedia|MusicBrainz|Spotify(?:\s+metadata)?|de bron|de databank)\b[:,]?\s*/gi,'').replace(/\s{2,}/g,' ').replace(/^[-–—,:;\s]+/,'').trim();return res.status(200).json({text:text.slice(0,850)})}catch{return res.status(204).end()}
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
