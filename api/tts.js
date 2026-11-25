import {randomBytes,randomUUID} from 'node:crypto';
import {guardAI} from './_guard.js';
import {edgeGecV2} from './_edge-gec.js';
const RATE=new Map();
const AUDIO_QUALITY='mp3-192-stable-v1';
function normalizeProfile(profile='josh'){const id=String(profile||'josh').trim().toLowerCase();return Object.hasOwn(EDGE_VOICES,id)?id:'josh'}
// x-real-ip wordt door het platform gezet en is niet door de client te kiezen.
// x-forwarded-for mag de client wel aanvullen, en het eerste element daarvan is precies
// de waarde die hij zelf meestuurt; daarop limiteren betekende dat iedereen de limiet met
// een willekeurige header kon omzeilen. Val daarom terug op het laatste element, want dat
// is het element dat het platform er zelf achter zet.
const clientIp=req=>{const real=String(req.headers?.['x-real-ip']||'').trim();if(real)return real.slice(0,80);const chain=String(req.headers?.['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean);return (chain.at(-1)||'unknown').slice(0,80)};
function rateLimit(req,res){const method=String(req.method||'GET').toUpperCase(),limit=method==='POST'?20:60,windowMs=60000,ip=clientIp(req),key=`${method}:${ip}`,now=Date.now(),fresh=(RATE.get(key)||[]).filter(at=>now-at<windowMs);if(fresh.length>=limit){const retry=Math.max(1,Math.ceil((windowMs-(now-fresh[0]))/1000));res.setHeader('Retry-After',String(retry));res.status(429).json({error:'rate_limited',detail:`Probeer het over ${retry} seconden opnieuw.`});return false}fresh.push(now);RATE.set(key,fresh);if(RATE.size>512)for(const[k,hits]of RATE)if(!hits.some(at=>now-at<windowMs))RATE.delete(k);return true}
// Edge (Microsoft Read Aloud) is de eerste stem: gratis, zonder sleutel, echte nl-NL-stemmen.
// Het is een onofficieel endpoint (handshake overgenomen uit edge-tts 7.3.1). Faalt hij, dan slaat de DJ over en speelt de muziek door.
// Max is een vrouw: Colette, iets sneller.
const EDGE_VOICES={josh:{voice:'nl-NL-MaartenNeural',pitch:'+0Hz',rate:'+0%'},maya:{voice:'nl-NL-FennaNeural',pitch:'+0Hz',rate:'+0%'},max:{voice:'nl-NL-ColetteNeural',pitch:'+2Hz',rate:'+8%'}};
const EDGE_TOKEN='6A5AA1D4EAFF4E9FB37E23D68491D6F4',EDGE_CHROME='143.0.3650.75',EDGE_MAJOR=EDGE_CHROME.split('.')[0];
const EDGE_TIMEOUT_MS=7000;
const edgeId=()=>randomUUID().replace(/-/g,'');
// Sec-MS-GEC v2 (edge-tts 7.3.1, oktober 2026): de oude SHA-256-token gaf alleen nog "non-101", zie api/_edge-gec.js.
const edgeUrl=()=>`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${edgeId()}&Sec-MS-GEC=${edgeGecV2(EDGE_TOKEN)}&Sec-MS-GEC-Version=2-${EDGE_CHROME}`;
const edgeHeaders=()=>({'User-Agent':`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${EDGE_MAJOR}.0.0.0 Safari/537.36 Edg/${EDGE_MAJOR}.0.0.0`,Origin:'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',Pragma:'no-cache','Cache-Control':'no-cache','Accept-Language':'en-US,en;q=0.9',Cookie:`muid=${randomBytes(16).toString('hex').toUpperCase()};`});
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
// Edge spelt "MAIR" als losse letters; "Mair" klinkt als de naam.
const edgeText=text=>String(text).replace(/\bMAIR\b/g,'Mair');
// Artiesten die de stem verkeerd uitspreekt: geschreven naam -> spelling die goed klinkt. Alleen de stem, niet het scherm.
// Josh luistert eerst: Davina Michelle en S10 klonken al goed, dus die staan er niet in.
// MAIRFM aan elkaar las de stem als losse letters. Los geschreven pakt edgeText hem op als 'Mair FM', zoals de DJ's het zeggen (Josh 24-11-2026).
const SAY=[[/\bMAIR ?FM\b/gi,'MAIR FM'],[/\bFroukje\b/gi,'Frauwkje'],[/\bDavina Michelle\b/gi,'Davina Mischèl'],[/\bS10\b/g,'Es-tien']];
export const sayText=text=>SAY.reduce((s,[re,to])=>s.replace(re,to),String(text));
const isMp3=buf=>buf.length>2&&((buf[0]===0x49&&buf[1]===0x44&&buf[2]===0x33)||(buf[0]===0xff&&(buf[1]&0xe0)===0xe0));
export function edgeSynthesize(profile,text,timeoutMs=EDGE_TIMEOUT_MS){const started=Date.now(),cast=EDGE_VOICES[profile]||EDGE_VOICES.josh,parts=[];let ws=null,done=false,timer=null;return new Promise(resolve=>{const finish=out=>{if(done)return;done=true;clearTimeout(timer);try{ws?.close()}catch{/* al dicht */}resolve({...out,voice:cast.voice,ms:Date.now()-started})};timer=setTimeout(()=>finish({ok:false,status:504,detail:'Edge TTS timed out'}),timeoutMs);try{if(typeof globalThis.WebSocket!=='function')return finish({ok:false,status:501,detail:'WebSocket is niet beschikbaar'});ws=new globalThis.WebSocket(edgeUrl(),{headers:edgeHeaders()});ws.binaryType='arraybuffer';ws.onopen=()=>{const date=new Date().toUTCString();ws.send(`X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);ws.send(`X-RequestId:${edgeId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='nl-NL'><voice name='${cast.voice}'><prosody pitch='${cast.pitch}' rate='${cast.rate}' volume='+0%'>${xml(edgeText(text))}</prosody></voice></speak>`)};ws.onmessage=e=>{if(typeof e.data==='string'){if(!e.data.includes('Path:turn.end'))return;const buf=Buffer.concat(parts);if(!buf.length)return finish({ok:false,status:502,detail:'Edge TTS returned empty audio'});if(!isMp3(buf))return finish({ok:false,status:502,detail:'Edge TTS returned malformed MP3 data'});return finish({ok:true,status:200,buf})}const b=Buffer.from(e.data);if(b.length<2)return;const head=b.readUInt16BE(0);if(head+2>b.length)return;if(b.subarray(2,2+head).toString().includes('Path:audio'))parts.push(b.subarray(2+head))};ws.onerror=e=>finish({ok:false,status:502,detail:`Edge TTS verbinding mislukt${e?.message?`: ${e.message}`:''}`});ws.onclose=e=>finish({ok:false,status:502,detail:`Edge TTS sloot de verbinding (${e?.code??'?'})`})}catch(e){finish({ok:false,status:500,detail:String(e?.message||e).slice(0,300)})}})}
// Edge synthetiseert ongeveer in realtime: een journaal van 600 tekens duurde 9-11 s (soms hing het) en brak op de 7 s-limiet af,
// dus het uurnieuws faalde elke keer. Lange tekst gaat daarom in zinsblokken parallel; mp3-frames kunnen gewoon achter elkaar.
export function splitSentences(text,max=170){const out=[];let cur='';for(const part of String(text).match(/[^.!?]+[.!?]*\s*/g)||[String(text)]){if(cur&&(cur+part).length>max){out.push(cur.trim());cur=''}cur+=part;while(cur.length>max*1.5){const cut=cur.lastIndexOf(' ',max);const at=cut>40?cut:max;out.push(cur.slice(0,at).trim());cur=cur.slice(at)}}if(cur.trim())out.push(cur.trim());return out.filter(Boolean)}
export async function edgeSpeak(profile,text,synth=edgeSynthesize){const started=Date.now(),chunks=splitSentences(text);
  // Edge is meestal binnen 1-2 s klaar, maar de eerste verbinding na stilte duurt 5-9 s en soms hangt hij. Daarom tot drie pogingen:
  // faalt er een, dan start de volgende meteen; hangt er een, dan start na 3 s een tweede ernaast. De eerste die slaagt wint.
  const one=c=>new Promise(done=>{let started=0,failed=0,fin=false;const go=()=>{if(fin||started>=3)return;const me=++started,hedge=setTimeout(()=>{if(started===me)go()},3000);synth(profile,c,9000).then(r=>{clearTimeout(hedge);if(fin)return;if(r.ok){fin=true;return done(r)}if(++failed>=3){fin=true;return done(r)}if(started===me)go()})};go()});
  const rs=await Promise.all(chunks.map(one)),bad=rs.find(r=>!r.ok);if(bad)return{...bad,ms:Date.now()-started};return{ok:true,status:200,buf:Buffer.concat(rs.map(r=>r.buf)),voice:rs[0].voice,ms:Date.now()-started}}
export default async function handler(req,res){if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});if(!rateLimit(req,res))return;if(!await guardAI(req,res))return;const profile=normalizeProfile(req.method==='POST'?req.body?.djProfile:req.query?.djProfile);const edge={provider:'edge',...(EDGE_VOICES[profile]||EDGE_VOICES.josh)};if(req.method==='GET'){
  // Health test Edge niet live (scheelt verzoeken).
  return res.status(200).json({provider:'edge',configured:true,djProfile:profile,edge,audioQuality:AUDIO_QUALITY})}
  const text=sayText(String(req.body?.text||'').trim().slice(0,1200));if(!text)return res.status(400).json({error:'Missing text'});const requestId=String(req.headers?.['x-mair-break-id']||req.body?.breakId||`tts-${Date.now().toString(36)}`).slice(0,100);res.setHeader('X-MAIR-Request-ID',requestId);
  const sendAudio=(buf,headers)=>{res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','private, max-age=0, no-store');res.setHeader('X-MAIR-DJ',profile);res.setHeader('X-MAIR-Audio-Quality',AUDIO_QUALITY);for(const[k,v]of Object.entries(headers))res.setHeader(k,v);return res.status(200).send(buf)};
  // Edge weigert soms een verbinding direct (ongeveer 1 op 5 in tests): edgeSpeak probeert het dan opnieuw.
  const first=await edgeSpeak(profile,text);if(first.ok)return sendAudio(first.buf,{'X-JoshFM-TTS':'edge','X-JoshFM-Voice':first.voice,'X-JoshFM-TTS-MS':String(first.ms)});
  const edgeFail={status:first.status,detail:first.detail,ms:first.ms};console.error('MAIRFM!',JSON.stringify({route:'tts',provider:'edge',status:first.status,detail:String(first.detail||'').slice(0,300),djProfile:profile,requestId}));
  // Alleen nl-NL (afspraak Josh, 20-10-2026: "nooit Vlaams"). Valt Edge uit, dan slaat de DJ over en speelt de muziek door.
  console.error('MAIRFM!',JSON.stringify({route:'tts',status:503,detail:'Edge faalde',djProfile:profile,requestId}));return res.status(503).json({error:'edge_tts_failed',detail:'De Nederlandse stem (Edge) faalde.',requestId,djProfile:profile,edge:edgeFail})}
