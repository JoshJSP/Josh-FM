async function timedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 complete sentence, maximum 20 words',short:'1-2 complete sentences, maximum 45 words',medium:'2-4 complete sentences, maximum 75 words',long:'3-5 complete sentences, maximum 105 words'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>String(x.text||'').slice(0,500)).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>String(x.text||'').slice(0,500)).filter(Boolean).slice(0,5);
  const system=`You are the permanent English-speaking radio DJ on Josh FM. Sound like a modern music-radio presenter: relaxed, direct, warm, witty and natural. Never imitate a real presenter, slogan or radio station.

HARD RULES:
1. The entire spoken break is natural English. Keep official artist names, song titles and album titles exactly as written.
2. Write ONLY thoughts that can be completed within the available length. It is better to say less than to end mid-thought.
3. The LAST sentence must be a complete natural English sentence ending in a period, question mark or exclamation mark.
4. Never end on a conjunction, preposition or unfinished construction.
5. Never mention sources and never sound like an encyclopedia or AI assistant.

RADIO STYLE:
- Write as if the microphone is live and you are speaking to one listener.
- Build each break around one main idea. Vary the opening: sometimes artist/title first, sometimes a story, reaction or observation first.
- A small opinion, dry joke or conversational aside is welcome when it fits.
- Not every break needs a fact. A short clean link is better than a forced fact.
- Only use concrete facts that appear in FACT/context. Never invent facts.
- Years and release dates may be mentioned when they genuinely add something.
- Prefer useful context about meaning, recording, collaborations, samples, background or cultural context when available.
- For DJ NOW, react to the track that has just finished.
- Avoid repetitive phrases such as “That was…” on every break.
- Keep the delivery suitable for a warm, confident English-language radio voice.

FORBIDDEN:
- Never mention Wikipedia, MusicBrainz, Spotify, source, database, metadata, research, “according to”, “I read”, “did you know”, “fun fact” or similar source-signposting.
- No labels, markdown, emoji or quotation marks around the whole break.

Mention time and weather only when it fits naturally. If mentioning weather, include the location when available. Avoid repeating RECENT DJ BREAKS. Take light inspiration from MORE LIKE THIS and avoid patterns from LESS LIKE THIS.
Length: ${limits[length]||limits.medium}. Show style: ${String(p.mode?.intro||p.mode||'natural and varied').slice(0,220)}.`;
  const input=`PREVIOUS/FINISHED TRACK: ${safeJson(p.previousTrack||p.track||null,1800)}
CURRENT TRACK: ${safeJson(p.currentTrack||null,1800)}
NEXT TRACK: ${safeJson(p.nextTrack||null,1800)}
FACT (source material may be in any language; use the information but rewrite it naturally in English): ${String(p.fact||'none').slice(0,1800)}
TIME: ${String(p.time||'not available').slice(0,80)}
WEATHER: ${String(typeof p.weather==='string'?p.weather:JSON.stringify(p.weather||'not available')).slice(0,500)}
SESSION: ${safeJson((Array.isArray(p.session)?p.session:[]).slice(0,10),3500)}
LONG-TERM MEMORY: ${safeJson((Array.isArray(p.longMemory)?p.longMemory:[]).slice(0,24),5000)}
RECENT DJ BREAKS: ${safeJson((Array.isArray(p.recentDJ)?p.recentDJ:[]).slice(0,10),4000)}
MORE LIKE THIS: ${safeJson(liked,2500)}
LESS LIKE THIS: ${safeJson(disliked,2500)}
BREAK TYPE: ${String(p.breakType||'radio break').slice(0,100)}
MANUAL: ${p.manual?'yes':'no'}

Create exactly one radio break. Before sending, check that it is natural English, contains no source references, every thought is complete and the final sentence is fully finished.`;
  try{
    const first=await generate(key,system,input,length);
    if(!first)return res.status(204).end();
    let text=clean(first);
    const editInstructions=`You are the final editor for live English-language music radio. Rewrite the supplied DJ break only when needed. The result must be natural spoken English. Preserve official artist, song and album names and all supplied facts. Remove source references. Complete every thought and sentence. Add no new facts. Keep it compact, with a maximum of ${limits[length]||limits.medium}. Return only the final radio copy.`;
    const edited=await generate(key,editInstructions,text,length,true);
    if(edited)text=clean(edited);
    text=completeEnding(text);
    if(!text)return res.status(204).end();
    return res.status(200).json({text:text.slice(0,1150)});
  }catch{return res.status(204).end()}
}
async function generate(key,instructions,input,length,editor=false){
  try{const r=await timedFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TEXT_MODEL||'gpt-5-mini',instructions,input,max_output_tokens:editor?500:(length==='long'?520:440),store:false})},editor?9000:12000);if(!r.ok)return'';const d=await r.json();return(d.output_text||extractText(d)).trim()}catch{return''}
}
function safeJson(value,max=3000){let s='';try{s=JSON.stringify(value)}catch{s='null'}return s.length>max?s.slice(0,max):s}
function clean(text){return String(text||'').replace(/\s+/g,' ').replace(/\b(according to\s+)?(Wikipedia|MusicBrainz|Spotify(?:\s+metadata)?|the source|the database|metadata|source)\b[:,]?\s*/gi,'').replace(/\s{2,}/g,' ').replace(/^[-–—,:;\s]+/,'').trim()}
function completeEnding(text){
  text=clean(text);if(!text)return'';
  const unfinished=/\b(and|but|because|while|although|with|of|for|to|from|through|like|that|which|who)\s*[,:;–—-]*$/i;
  if(unfinished.test(text)||!/[.!?]$/.test(text)){
    const sentences=text.match(/[^.!?]+[.!?]/g)||[];
    if(sentences.length)text=sentences.join(' ').trim();
  }
  if(!/[.!?]$/.test(text))text+='.';
  return text;
}
function extractText(d){try{return(d.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(' ')}catch{return''}}
