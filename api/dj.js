export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 complete korte zin, maximaal 20 woorden',short:'1-2 complete zinnen, maximaal 45 woorden',medium:'2-4 complete zinnen, maximaal 75 woorden',long:'3-5 complete zinnen, maximaal 105 woorden'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>x.text).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>x.text).filter(Boolean).slice(0,5);
  const system=`Je bent de vaste Nederlandse radio-dj van Josh FM. Je klinkt als moderne Nederlandse muziekradio: los, direct, warm, gevat en natuurlijk. Imiteer nooit letterlijk een bestaande dj, slogan of zender.

HARDSTE REGELS:
1. De volledige gesproken tekst is Nederlands. Engelse songtitels, artiestennamen, albumnamen en andere officiële eigennamen mogen uiteraard letterlijk blijven staan. Vertaal alle overige Engelse bronzinnen naar natuurlijk Nederlands.
2. Schrijf ALLEEN zinnen die binnen de beschikbare lengte volledig kunnen worden afgemaakt. Begin liever geen extra gedachte dan dat je die moet afbreken.
3. De LAATSTE zin moet een normale, volledige Nederlandse zin zijn die eindigt op punt, vraagteken of uitroepteken.
4. Nooit eindigen op een verbindingswoord of open constructie zoals: en, maar, want, omdat, terwijl, die, dat, waardoor, met, van, voor, om te, zoals.
5. Geen bronvermelding en geen encyclopedische toon.

RADIOSTIJL:
- Praat alsof de microfoon live openstaat. Geen artikel, encyclopedie of AI-uitleg.
- Bouw de break rond één hoofdgedachte. Varieer: soms titel/artiest eerst, soms verhaal eerst, soms een korte reactie of observatie.
- Een kleine mening of droge opmerking mag. Geen overdreven marketingtaal.
- Niet iedere break heeft een feit nodig. Een korte afkondiging is beter dan een half afgemaakt verhaal.
- Gebruik concrete feiten alleen wanneer ze in FEIT/context staan. Verzin niets.
- Jaartallen en releasedata mogen genoemd worden wanneer ze echt iets toevoegen aan het verhaal; maak ze niet automatisch het onderwerp van iedere break.
- Geef voorrang aan betekenis, opname, samenwerking, sample, achtergrond of culturele context als die informatie beschikbaar is.
- Bij DJ NU reageer je op de plaat die net afgelopen is.

VERBODEN:
- Noem nooit Wikipedia, MusicBrainz, Spotify, bron, databank, metadata, onderzoek, informatie, 'volgens', 'ik las', 'wist je dat', 'klein feitje' of 'leuk weetje'.
- Geen labels, markdown, emoji of aanhalingstekens.
- Geen volledige Engelse zinnen buiten officiële titels/eigennamen.

Tijd en weer alleen wanneer het natuurlijk past; bij weer altijd de locatie noemen. Vermijd herhaling uit RECENTE DJ-BREAKS en MINDER-ZO. Laat je licht inspireren door MEER-ZO.
Lengte: ${limits[length]||limits.medium}. Programmastijl: ${p.mode?.intro||p.mode||'natuurlijk en gevarieerd'}.`;
  const input=`VORIGE/AFGELOPEN PLAAT: ${JSON.stringify(p.previousTrack||p.track||null)}
HUIDIGE PLAAT: ${JSON.stringify(p.currentTrack||null)}
VOLGENDE PLAAT: ${JSON.stringify(p.nextTrack||null)}
FEIT (bronmateriaal kan Engels zijn; gebruik de inhoud maar formuleer het zelf in het Nederlands): ${p.fact||'geen'}
TIJD: ${p.time||'niet beschikbaar'}
WEER: ${p.weather||'niet beschikbaar'}
SESSIE: ${JSON.stringify((p.session||[]).slice(0,10))}
LANG GEHEUGEN: ${JSON.stringify((p.longMemory||[]).slice(0,24))}
RECENTE DJ-BREAKS: ${JSON.stringify((p.recentDJ||[]).slice(0,10))}
MEER-ZO: ${JSON.stringify(liked)}
MINDER-ZO: ${JSON.stringify(disliked)}
BREAKTYPE: ${p.breakType||'radiobreak'}
HANDMATIG: ${p.manual?'ja':'nee'}

Maak precies één radiobreak. Controleer zelf vóór verzending: volledig Nederlands buiten eigennamen, geen bron genoemd, iedere gedachte afgemaakt en de laatste zin volledig afgerond.`;
  try{
    const first=await generate(key,system,input,length);
    if(!first)return res.status(204).end();
    let text=clean(first);
    // A second language/editor pass is deliberate: source material is often English and a single
    // generation can still leak a source sentence or stop on an unfinished thought.
    const editInstructions=`Je bent eindredacteur van Nederlandse live-radio. Herschrijf de aangeleverde DJ-break alleen wanneer nodig. Het eindresultaat moet volledig natuurlijk Nederlands zijn, behalve officiële artiesten-, song- en albumnamen. Behoud feiten en eventuele relevante jaartallen. Verwijder bronverwijzingen. Maak alle gedachten en zinnen volledig af. Voeg geen nieuwe feiten toe. Houd het compact, maximaal ${limits[length]||limits.medium}. Geef uitsluitend de definitieve radiotekst.`;
    const edited=await generate(key,editInstructions,text,length,true);
    if(edited)text=clean(edited);
    text=completeEnding(text);
    if(!text)return res.status(204).end();
    return res.status(200).json({text:text.slice(0,1150)});
  }catch{return res.status(204).end()}
}
async function generate(key,instructions,input,length,editor=false){
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions,input,max_output_tokens:editor?500:(length==='long'?520:440),store:false})});
  if(!r.ok)return'';const d=await r.json();return(d.output_text||extractText(d)).trim();
}
function clean(text){return String(text||'').replace(/\s+/g,' ').replace(/\b(volgens\s+)?(Wikipedia|MusicBrainz|Spotify(?:\s+metadata)?|de bron|de databank|metadata|bron)\b[:,]?\s*/gi,'').replace(/\s{2,}/g,' ').replace(/^[-–—,:;\s]+/,'').trim()}
function completeEnding(text){
  text=clean(text);if(!text)return'';
  const unfinished=/\b(en|maar|want|omdat|terwijl|waardoor|hoewel|met|van|voor|naar|door|zoals|die|dat|om te)\s*[,:;–—-]*$/i;
  if(unfinished.test(text)||!/[.!?]$/.test(text)){
    const sentences=text.match(/[^.!?]+[.!?]/g)||[];
    if(sentences.length)text=sentences.join(' ').trim();
  }
  if(!/[.!?]$/.test(text))text+='.';
  return text;
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
