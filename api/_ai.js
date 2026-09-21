// Gedeelde AI-laag voor MAIRFM.
//
// Claude schrijft, Groq vangt op. De radio mag nooit stilvallen omdat één
// aanbieder eruit ligt, dus iedere aanroep geeft óf tekst óf een nette fout
// waar de beller op door kan vallen.
//
// Bewust geen SDK: de rest van api/ praat ook met kale fetch tegen Groq, Fish
// Audio, Spotify en MusicBrainz. Een extra dependency per Vercel-functie kost
// meer dan de regels hieronder.

export const CLAUDE_DEFAULT_MODEL='claude-opus-5';
const CLAUDE_URL='https://api.anthropic.com/v1/messages';
const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';
const clip=(v,n)=>String(v??'').slice(0,n);

export async function timedFetch(url,opt={},ms=12000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal})}finally{clearTimeout(timer)}}

export function claudeModel(){return String(process.env.ANTHROPIC_TEXT_MODEL||'').trim()||CLAUDE_DEFAULT_MODEL}
export function hasClaude(){return !!String(process.env.ANTHROPIC_API_KEY||'').trim()}
export function hasGroq(){return !!String(process.env.GROQ_API_KEY||'').trim()}

// effort stuurt hoe diep Claude nadenkt voor hij schrijft: 'low' waar de
// deadline hard is (DJ-break, nieuws), 'medium' waar precisie telt (classificatie).
// maxTokens moet ruim boven de gewenste tekstlengte liggen, want het nadenken
// telt mee in datzelfde budget.
export async function claudeText({system,user,maxTokens=2000,effort='low',timeoutMs=12000,requestId=''}={}){
  const key=String(process.env.ANTHROPIC_API_KEY||'').trim(),model=claudeModel();
  if(!key)return{ok:false,provider:'claude',model,status:503,error:'ANTHROPIC_API_KEY ontbreekt'};
  const headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'};
  if(requestId)headers['X-MAIR-Request-ID']=requestId;
  const body={model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}],output_config:{effort}};
  try{
    const r=await timedFetch(CLAUDE_URL,{method:'POST',headers,body:JSON.stringify(body)},timeoutMs);
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return{ok:false,provider:'claude',model,status:r.status,error:clip(d?.error?.message||`Claude HTTP ${r.status}`,500)};
    // Een weigering komt terug als HTTP 200 met stop_reason 'refusal'. Zonder
    // deze check lees je een lege content-array en val je nooit door naar Groq.
    if(d?.stop_reason==='refusal')return{ok:false,provider:'claude',model,status:502,error:clip(`Claude weigerde (${d?.stop_details?.category||'onbekend'})`,500)};
    const text=(Array.isArray(d?.content)?d.content:[]).filter(b=>b?.type==='text').map(b=>String(b?.text||'')).join('').trim();
    if(!text)return{ok:false,provider:'claude',model,status:502,error:d?.stop_reason==='max_tokens'?'Claude raakte max_tokens voor er tekst was':'Claude gaf geen tekst terug'};
    return{ok:true,provider:'claude',model,text,usage:d?.usage||null};
  }catch(e){const aborted=e?.name==='AbortError';return{ok:false,provider:'claude',model,status:aborted?504:500,error:aborted?'Claude timeout':clip(e?.message||e,500)}}
}

// Groq-vangnet voor de routes die er nog geen hadden. dj-writer.js en
// news-bulletin.js houden hun eigen lus: die is met tests vastgelegd.
export async function groqText({model,system,user,timeoutMs=9000,requestId='',temperature=.5,topP=.9,maxCompletionTokens=1200}={}){
  const key=String(process.env.GROQ_API_KEY||'').trim();
  if(!key)return{ok:false,provider:'groq',model,status:503,error:'GROQ_API_KEY ontbreekt'};
  const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  if(requestId)headers['X-MAIR-Request-ID']=requestId;
  try{
    const r=await timedFetch(GROQ_URL,{method:'POST',headers,body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:user}],temperature,top_p:topP,max_completion_tokens:maxCompletionTokens,reasoning_effort:'low',include_reasoning:false})},timeoutMs);
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return{ok:false,provider:'groq',model,status:r.status,error:clip(d?.error?.message||`Groq HTTP ${r.status}`,500)};
    const text=String(d?.choices?.[0]?.message?.content||'').trim();
    if(!text)return{ok:false,provider:'groq',model,status:502,error:'Groq gaf geen tekst terug'};
    return{ok:true,provider:'groq',model,text,usage:d?.usage||null};
  }catch(e){const aborted=e?.name==='AbortError';return{ok:false,provider:'groq',model,status:aborted?504:500,error:aborted?'Groq timeout':clip(e?.message||e,500)}}
}
