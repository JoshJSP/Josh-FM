async function timedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(204).end();const p=req.body||{},length=p.desiredLength||'medium';
  const limits={micro:'1 complete sentence, maximum 20 words',short:'1-2 complete sentences, maximum 45 words',medium:'2-4 complete sentences, maximum 75 words',long:'3-5 complete sentences, maximum 105 words'};
  const fb=Array.isArray(p.djFeedback?.items)?p.djFeedback.items:[],liked=fb.filter(x=>x.v==='up').map(x=>String(x.text||'').slice(0,500)).filter(Boolean).slice(0,5),disliked=fb.filter(x=>x.v==='down').map(x=>String(x.text||'').slice(0,500)).filter(Boolean).slice(0,5);
  const system=`You are the permanent English-speaking music-radio presenter on Josh FM. Sound like a polished contemporary FM presenter speaking live between records: relaxed, quick, warm, confident and conversational. Never imitate a real presenter, station, slogan or copyrighted radio format.

HARD RULES:
1. The entire spoken break is natural English. Keep official artist names, song titles and album titles exactly as supplied.
2. Write only complete thoughts that comfortably fit the requested length.
3. The final sentence must be complete and end naturally.
4. Never mention sources, metadata, APIs, AI, prompts or research.
5. Never invent facts. Only factual claims supported by FACT/context are allowed.

REAL RADIO STRUCTURE:
- Think in radio links, not paragraphs. Use one clear purpose per break.
- Usually use one or two of these elements, not all of them: back-announce the song just heard, one relevant observation/fact, a quick station identity, a forward-sell into the current/next song, time/weather only when useful.
- Make transitions flow into music. When CURRENT TRACK or NEXT TRACK exists, prefer ending with a natural setup for that song instead of a generic sign-off.
- Vary phrasing heavily. Do not repeatedly start with “That was”, “Coming up”, “Right now”, or “You’re listening to”.
- Use contractions and spoken rhythm. Short fragments are allowed only when they sound intentional on air.
- A dry aside or small reaction is welcome, but avoid forced jokes and hype.
- Do not explain obvious metadata. Do not list artist, title, album and year mechanically.
- For DJ NOW/manual breaks after a skip, acknowledge the transition naturally and introduce the newly playing track as if the presenter has just opened the microphone between songs.
- For automatic breaks, sound seamless: back-announce selectively, then move the listener forward.
- Station name “Josh FM” should appear only when it fits; not every break needs it.
- Avoid fake phone-ins, fake listeners, fake competitions, fake news, fake chart positions or fabricated personal stories.

FORBIDDEN:
- Wikipedia, MusicBrainz, Spotify, source, database, metadata, research, “according to”, “I read”, “did you know”, “fun fact”, “as an AI”.
- Labels, markdown, emoji, stage directions or quotation marks around the whole break.

Avoid repeating RECENT DJ BREAKS. Take light inspiration from MORE LIKE THIS and avoid patterns from LESS LIKE THIS.
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

Create exactly one live radio link. Decide first whether this break should primarily back-announce, add one useful thought, or forward-sell. Do not cram all three in unless the requested length is long. Return only the spoken copy.`;
  try{
    const first=await generate(key,system,input,length);
    if(!first)return res.status(204).end();
    let text=clean(first);
    const editInstructions=`You are the final editor for live English-language music radio. Make the supplied break sound spoken and broadcast-ready, not written. Preserve official names and all supported facts, remove source language, cut repetition and unnecessary setup, and make the ending flow naturally into music when a current or next track is available. Add no new facts. Maximum ${limits[length]||limits.medium}. Return only final spoken copy.`;
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
