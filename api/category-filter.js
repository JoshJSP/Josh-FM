import {claudeText,groqText,hasClaude,hasGroq} from './_ai.js';
// Deze route doet zelf geen fetch meer: _ai.js bewaakt de deadlines.
const GROQ_MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
const RATE=new Map();
function rateLimit(req,res){const windowMs=60000,limit=20,ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80),now=Date.now(),fresh=(RATE.get(ip)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`});return false}fresh.push(now);RATE.set(ip,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}

const RULES={
  nl:'Accepteer alleen als de gezongen tekst echt hoofdzakelijk Nederlands is: als strenge richtlijn minstens ongeveer 90% van de hoorbare songtekst Nederlands, inclusief het grootste deel van refrein en coupletten. Een paar Nederlandse woorden, een Nederlandstalige intro, een tweetalig nummer met veel Engels, of een Nederlandse/Vlaamse artiest met een Engelstalig nummer is NIET genoeg. Instrumentale tracks, volledig Engelstalige tracks en ieder twijfelgeval afwijzen.',
  party:'Accepteer alleen als dit duidelijk een energieke, dansbare feesttrack is die logisch werkt op een feestje of dansvloer. Ballads, rustige akoestische tracks, ambient en andere lage-energie tracks afwijzen.',
  chill:'Accepteer alleen als dit duidelijk rustig, ontspannen en warm/soft is. Harde dance, agressieve rock/rap, zeer hoge energie en uitgesproken feesttracks afwijzen.',
  sleep:'Accepteer alleen als dit overtuigend geschikt is om bij in slaap te vallen EN een echt liedje of duidelijke song-arrangement is. Voorkeur: rustige akoestische covers, unplugged pop, zachte singer-songwriter, kalme piano/vocal-covers, slow indie en zeer zachte vocalen. Een herkenbare instrumentale piano- of akoestische cover mag ook. Wijs ALTIJD af: white noise, brown noise, pink noise, regen/oceaan/natuurgeluiden, ASMR, binaural beats, delta/theta waves, meditatie-audio, drones, ambient soundscapes, generieke sleep music en lange sfeertracks zonder normale songstructuur. Ook gewone midtempo pop, chill-dance, harde drums, drops, schreeuwerige vocalen en feestelijke drive afwijzen. Dit kanaal moet klinken als een rustige akoestische radio-playlist, niet als een noise- of meditatie-app.',
  summer:'Accepteer alleen als dit duidelijk een zonnige, feelgood of zomerse sfeer heeft. Een gewone poptrack zonder duidelijke zomer/feelgood-associatie bij twijfel afwijzen.'
};
const MIN_CONFIDENCE={nl:.95,party:.90,chill:.90,sleep:.94,summer:.90};
const SLEEP_NOISE=/\b(white noise|brown noise|pink noise|rain sounds?|ocean sounds?|nature sounds?|sleep sounds?|asmr|binaural|delta waves?|theta waves?|meditation|soundscape|drone|ambient sleep|deep sleep)\b/i;

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!rateLimit(req,res))return;
  if(!hasClaude()&&!hasGroq())return res.status(503).json({error:'missing_ai_key'});
  const channel=String(req.body?.channel||'');
  if(!RULES[channel])return res.status(400).json({error:'unsupported_channel'});
  const floor=MIN_CONFIDENCE[channel]||.90,requested=Number(req.body?.minConfidence),threshold=Math.max(floor,Number.isFinite(requested)?Math.min(.99,requested):floor);
  const tracks=(Array.isArray(req.body?.tracks)?req.body.tracks:[]).slice(0,50).map((t,i)=>({
    i,
    id:String(t?.id||'').slice(0,100),
    title:String(t?.name||'').slice(0,220),
    artists:(Array.isArray(t?.artists)?t.artists:[]).slice(0,5).map(a=>String(a).slice(0,140)),
    album:String(t?.album||'').slice(0,180),
    release:String(t?.release||'').slice(0,30),
    popularity:Math.max(0,Math.min(100,Number(t?.popularity)||0))
  })).filter(t=>t.id&&t.title&&t.artists.length).filter(t=>channel!=='sleep'||!SLEEP_NOISE.test(`${t.title} ${t.artists.join(' ')} ${t.album}`));
  if(!tracks.length)return res.status(200).json({accepted:[],threshold});

  const instructions=`Je bent een extreem strenge muziekclassificator voor een radiokanaal. ${RULES[channel]} Gebruik je kennis van het specifieke nummer, niet alleen artiest, land, genre of titel. Als je het nummer niet betrouwbaar kent of twijfelt, accepteer het NIET. Geef per invoer exact één oordeel. Confidence is 0.00-1.00 en moet >=${threshold.toFixed(2)} zijn om accept=true te mogen geven. Antwoord uitsluitend met geldig JSON: {"items":[{"i":0,"accept":true,"confidence":0.97,"reason":"kort"}]}. Geen markdown of extra tekst.`;
  const input=JSON.stringify({channel,tracks});
  const attempts=[];
  try{
    // Claude classificeert, Groq vangt op. Eén bruikbaar oordeel is genoeg.
    for(const call of providers({instructions,input})){
      const out=await call();
      if(!out.ok){attempts.push({provider:out.provider,model:out.model,status:out.status,error:out.error});continue}
      const data=parseJson(out.text);
      if(!data){attempts.push({provider:out.provider,model:out.model,status:502,error:'invalid_classifier_json'});continue}
      const verdicts=new Map((Array.isArray(data.items)?data.items:[]).map(x=>[Number(x?.i),x]));
      const accepted=[];
      for(const t of tracks){const v=verdicts.get(t.i),confidence=Number(v?.confidence||0);if(v?.accept===true&&confidence>=threshold)accepted.push({id:t.id,confidence,reason:String(v?.reason||'').slice(0,220)})}
      return res.status(200).json({accepted,threshold,provider:out.provider,model:out.model,attempts});
    }
  }catch(e){return res.status(500).json({error:'classification_failed',detail:String(e?.message||e).slice(0,500),attempts})}
  const last=attempts.at(-1)||{status:502,error:'Geen enkele aanbieder gaf een oordeel terug'};
  const status=[401,403,429].includes(last.status)?last.status:last.status===504?504:502;
  return res.status(status).json({error:status===504?'classification_timeout':'invalid_classifier_json',detail:String(last.error||'').slice(0,500),attempts});
}
// Volgorde van aanbieders voor één classificatie. Deze route beoordeelt tot 50
// tracks tegelijk, dus Claude krijgt meer denkruimte dan de DJ-break.
function providers({instructions,input}){
  const list=[];
  // De aanroeper (channel-click-fix.js) breekt na 10s af, dus de hele keten moet
  // daarbinnen passen: 5s Claude, daarna 2s per Groq-model.
  if(hasClaude())list.push(()=>claudeText({system:instructions,user:input,maxTokens:8000,effort:'low',timeoutMs:5000}));
  if(hasGroq())for(const model of GROQ_MODELS)list.push(()=>groqText({model,system:instructions,user:input,maxCompletionTokens:3500,temperature:.2,topP:.7,timeoutMs:2200}));
  return list;
}

function parseJson(text){try{return JSON.parse(text)}catch{}const cleaned=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(cleaned)}catch{}const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}return null}
