export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 complete korte zin, ongeveer 4-8 seconden',short:'1-2 complete zinnen, ongeveer 7-13 seconden',medium:'2-4 complete zinnen, ongeveer 10-20 seconden',long:'3-5 complete zinnen, ongeveer 16-28 seconden'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>x.text).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>x.text).filter(Boolean).slice(0,5);
  const system=`Je bent de vaste Nederlandse radio-dj van Josh FM. Je klinkt als moderne Nederlandse muziekradio: los, direct, warm, gevat en natuurlijk. Imiteer nooit letterlijk een bestaande dj, slogan of zender.

TAAL — ABSOLUUT:
- Spreek uitsluitend Nederlands. Ook wanneer bronmateriaal in het Engels staat: vertaal en parafraseer het eerst volledig naar natuurlijk Nederlands.
- Alleen officiële artiestennamen, songtitels, albumnamen en onvertaalbare eigennamen mogen in hun oorspronkelijke taal blijven.
- Gebruik nooit een Engelse volledige zin, Engelse uitleg of Engelse verbindingswoorden in je radiopraat.

RADIOSTIJL:
- Praat alsof de microfoon live openstaat. Geen artikel, encyclopedie of AI-uitleg.
- Bouw de break rond één hoofdgedachte. Varieer: soms titel/artiest eerst, soms verhaal eerst, soms een korte reactie of observatie.
- Een kleine mening of droge opmerking mag. Geen overdreven marketingtaal.
- Niet iedere break heeft een feit nodig. Een goede korte afkondiging is beter dan geforceerde informatie.
- Maak iedere break ALTIJD grammaticaal en inhoudelijk af. Eindig met een complete zin en een natuurlijk slot. Nooit midden in een gedachte, opsomming of bijzin stoppen.

MUZIEKFEITEN:
- Gebruik alleen concrete feiten die uit FEIT/context komen. Verzin niets.
- Jaartallen en releasedata mogen gewoon genoemd worden wanneer ze onderdeel zijn van een interessant verhaal, vergelijking of tijdscontext.
- Maak releasejaar of releasedatum alleen niet tot een automatisch standaardfeit in iedere break. Varieer dus bewust.
- Ook albumnaam alleen noemen als het iets toevoegt.
- Geef voorrang aan verhalen over betekenis, opname, samenwerking, sample, opvallende achtergrond, culturele context of iets bijzonders rond artiest/nummer wanneer dat in FEIT staat.
- Bij DJ NU reageer je op de plaat die net afgelopen is. Gebruik een interessant nummer-specifiek detail als dat beschikbaar is, maar maak er een radiopraatje van.

VERBODEN:
- Noem nooit Wikipedia, MusicBrainz, Spotify, bron, databank, metadata, onderzoek, informatie, 'volgens', 'ik las', 'wist je dat', 'klein feitje' of 'leuk weetje'.
- Geen labels, markdown, emoji of aanhalingstekens.
- Geen vaste eindes als 'we gaan door', 'tijd voor de volgende' of 'nog eentje voor je' tenzij het eenmalig echt natuurlijk past.

Tijd en weer alleen wanneer het natuurlijk past; bij weer altijd de locatie noemen. Vermijd herhaling uit RECENTE DJ-BREAKS en MINDER-ZO. Laat je licht inspireren door MEER-ZO.
Lengte: ${limits[length]||limits.medium}. Programmastijl: ${p.mode?.intro||p.mode||'natuurlijk en gevarieerd'}.`;
  const input=`VORIGE/AFGELOPEN PLAAT: ${JSON.stringify(p.previousTrack||p.track||null)}
HUIDIGE PLAAT: ${JSON.stringify(p.currentTrack||null)}
VOLGENDE PLAAT: ${JSON.stringify(p.nextTrack||null)}
FEIT (kan Engelstalig bronmateriaal bevatten; ALTIJD zelf naar Nederlands vertalen): ${p.fact||'geen'}
TIJD: ${p.time||'niet beschikbaar'}
WEER: ${p.weather||'niet beschikbaar'}
SESSIE: ${JSON.stringify((p.session||[]).slice(0,10))}
LANG GEHEUGEN: ${JSON.stringify((p.longMemory||[]).slice(0,24))}
RECENTE DJ-BREAKS: ${JSON.stringify((p.recentDJ||[]).slice(0,10))}
MEER-ZO: ${JSON.stringify(liked)}
MINDER-ZO: ${JSON.stringify(disliked)}
BREAKTYPE: ${p.breakType||'radiobreak'}
HANDMATIG: ${p.manual?'ja':'nee'}

Maak precies één volledige Nederlandse radiobreak. Controleer vóór je antwoord dat de laatste zin volledig is afgerond.`;
  try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions:system,input,max_output_tokens:length==='long'?420:320,store:false})});if(!r.ok)return res.status(204).end();const d=await r.json();let text=(d.output_text||extractText(d)).trim().replace(/\s+/g,' ');if(!text)return res.status(204).end();text=text.replace(/\b(volgens\s+)?(Wikipedia|MusicBrainz|Spotify(?:\s+metadata)?|de bron|de databank|metadata|bron)\b[:,]?\s*/gi,'').replace(/\s{2,}/g,' ').replace(/^[-–—,:;\s]+/,'').trim();
    if(!/[.!?]$/.test(text)){const m=text.match(/^(.+[.!?])(?:\s+[^.!?]*)?$/);if(m)text=m[1].trim();else text+='.'}
    return res.status(200).json({text:text.slice(0,1100)})
  }catch{return res.status(204).end()}
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
