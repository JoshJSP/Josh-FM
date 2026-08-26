import assert from 'node:assert/strict';
import tts from '../api/tts.js';
import writer from '../api/dj-writer.js';

const originalFetch=globalThis.fetch;
const originalEnv={...process.env};
function response(){return{statusCode:0,headers:{},body:null,status(code){this.statusCode=code;return this},setHeader(name,value){this.headers[name]=value},json(value){this.body=value;return this},send(value){this.body=value;return this}}}
async function call(handler,req){const res=response();await handler(req,res);return res}
function fishResponse(body,{status=200,type='audio/mpeg'}={}){const data=Buffer.isBuffer(body)?body:Buffer.from(String(body));return{ok:status>=200&&status<300,status,headers:{get:name=>name.toLowerCase()==='content-type'?type:null},text:async()=>data.toString(),arrayBuffer:async()=>data}}
function writerBody(id='api-test'){return{breakId:id,breakType:'FORWARD_ANNOUNCE',targetWords:16,energy:'NORMAL',context:{schemaVersion:'1.0.0',break:{breakType:'FORWARD_ANNOUNCE',targetWords:16,maxDurationSeconds:10,energy:'NORMAL',mustMention:[],permittedTopics:['music'],prohibitedTopics:[]},onAir:{previous:{id:'a',name:'Eerste',artists:['Artiest A']},next:{id:'b',name:'Tweede',artists:['Artiest B']},future:[],relationship:null},session:{station:'MAIR',localTime:'10:15',day:'woensdag',daypart:'ochtend',durationMinutes:20,narrative:{}},memory:{revision:0,recentBreaks:[],usedFactIds:[]},allowedFacts:[],doNot:[]}}}
function restoreEnv(){for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv)}

try{
  delete process.env.FISH_AUDIO_API_KEY;
  let res=await call(tts,{method:'POST',body:{text:'Hallo'}});
  assert.equal(res.statusCode,503);assert.equal(res.body.error,'fish_key_missing');

  process.env.FISH_AUDIO_API_KEY='test-key';delete process.env.FISH_AUDIO_MODEL;
  let calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});if(url.includes('/model/'))return fishResponse(JSON.stringify({_id:'voice-josh',title:'Josh',languages:['nl']}),{type:'application/json'});return fishResponse('unexpected')};
  res=await call(tts,{method:'GET',query:{djProfile:'UNKNOWN'}});
  assert.equal(res.statusCode,200);assert.equal(res.body.djProfile,'josh');assert.match(calls[0].url,/\/model\//);

  process.env.FISH_AUDIO_VOICE_MAX='802e3bc2b27e49c2995d23ef70e6ac89';calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return fishResponse(JSON.stringify({_id:'149694610a7449b6b2c5aef22859e2d3',title:'Jonge Nederlandse Stem',languages:['nl']}),{type:'application/json'})};
  res=await call(tts,{method:'GET',query:{djProfile:'max'}});assert.equal(res.statusCode,200);assert.equal(res.body.djProfile,'max');assert.equal(res.body.voiceId,'149694610a7449b6b2c5aef22859e2d3');assert.equal(res.body.voice.dutchReady,true);delete process.env.FISH_AUDIO_VOICE_MAX;

  process.env.FISH_AUDIO_VOICE_NOAH='custom-english-only';
  globalThis.fetch=async()=>fishResponse(JSON.stringify({_id:'custom-english-only',title:'English only',languages:['en']}),{type:'application/json'});
  res=await call(tts,{method:'GET',query:{djProfile:'noah'}});assert.equal(res.statusCode,422);assert.equal(res.body.voice.dutchReady,false);assert.match(res.body.voice.detail,/geen Nederlandse/);delete process.env.FISH_AUDIO_VOICE_NOAH;

  calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return calls.length===1?fishResponse(JSON.stringify({message:'temporary'}),{status:500,type:'application/json'}):fishResponse(Buffer.from([0x49,0x44,0x33,1]))};
  res=await call(tts,{method:'POST',body:{text:'Dit is een test.',djProfile:'maya'}});
  assert.equal(res.statusCode,200);assert.equal(calls.length,2);assert.equal(res.headers['X-MAIR-DJ'],'maya');assert.equal(res.headers['X-JoshFM-Fish-Model'],'s2-pro');assert.ok(res.headers['X-MAIR-Request-ID']);assert.ok(Buffer.isBuffer(res.body));

  calls=[];globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return fishResponse(Buffer.from('not-an-mp3'))};
  res=await call(tts,{method:'POST',body:{text:'Malformed audio.'}});assert.equal(res.statusCode,502);assert.equal(calls.length,2);assert.match(res.body.detail,/malformed MP3/i);

  calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return fishResponse(JSON.stringify({message:'invalid token'}),{status:401,type:'application/json'})};
  res=await call(tts,{method:'POST',body:{text:'Dit faalt veilig.'}});
  assert.equal(res.statusCode,401);assert.equal(calls.length,1);assert.equal(res.body.error,'fish_tts_failed');

  calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return fishResponse('',{type:'audio/mpeg'})};
  res=await call(tts,{method:'POST',body:{text:'Lege audio.'}});
  assert.equal(res.statusCode,502);assert.equal(calls.length,2);assert.equal(res.body.attempts.length,2);assert.match(res.body.detail,/empty audio/i);

  calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return fishResponse('<html>upstream proxy error</html>',{type:'text/html'})};
  res=await call(tts,{method:'POST',body:{text:'Geen HTML als audio.'}});
  assert.equal(res.statusCode,502);assert.equal(calls.length,2);assert.match(res.body.detail,/instead of audio/i);

  process.env.GROQ_API_KEY='test-key';
  globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({error:{message:'rate limited'}})});
  res=await call(writer,{method:'POST',headers:{},body:writerBody('rate-upstream')});
  assert.equal(res.statusCode,429);assert.equal(res.body.error,'rate limited');

  process.env.GROQ_DJ_MODEL='llama-3.3-70b-versatile';calls=[];let writerBodies=[];
  globalThis.fetch=async(url,opt)=>{const body=JSON.parse(opt.body);writerBodies.push(body);calls.push(body.model);return calls.length===1?{ok:false,status:400,json:async()=>({error:{message:'model unavailable'}})}:{ok:true,status:200,json:async()=>({choices:[{message:{content:'Dit is betrouwbare Nederlandse radiotekst.'}}]})}};
  res=await call(writer,{method:'POST',headers:{},body:writerBody('model-fallback')});assert.equal(res.statusCode,200);assert.deepEqual(calls,['llama-3.3-70b-versatile','openai/gpt-oss-120b']);assert.equal(res.body.model,'openai/gpt-oss-120b');assert.equal(res.body.attempts.length,1);assert.equal(writerBodies[1].max_completion_tokens,420);assert.equal(writerBodies[1].reasoning_effort,'low');assert.equal(writerBodies[1].include_reasoning,false);assert.equal('max_tokens'in writerBodies[1],false);assert.equal(res.body.promptVersion,'1.0.0');

  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'   '}}]})});
  res=await call(writer,{method:'POST',headers:{},body:writerBody('empty')});assert.equal(res.statusCode,502);assert.match(res.body.error,/geen DJ-tekst/);assert.equal(res.body.attempts.length,2);

  globalThis.fetch=async()=>{const error=new Error('aborted');error.name='AbortError';throw error};
  res=await call(writer,{method:'POST',headers:{},body:writerBody('timeout')});assert.equal(res.statusCode,504);assert.equal(res.body.error,'Groq timeout');assert.equal(res.body.attempts.length,2);assert.ok(res.body.requestId);

  res=await call(writer,{method:'POST',headers:{'x-forwarded-for':'198.51.100.19'},body:{breakType:'made-up'}});assert.equal(res.statusCode,400);assert.equal(res.body.error,'invalid_break_id');

  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'Korte Nederlandse radiotekst voor de limiettest.'}}]})});
  for(let i=0;i<20;i++){res=await call(writer,{method:'POST',headers:{'x-forwarded-for':'198.51.100.20'},body:writerBody(`limit-${i}`)});assert.equal(res.statusCode,200)}
  res=await call(writer,{method:'POST',headers:{'x-forwarded-for':'198.51.100.20'},body:{}});assert.equal(res.statusCode,429);assert.equal(res.body.error,'rate_limited');assert.ok(Number(res.headers['Retry-After'])>=1);

  globalThis.fetch=async()=>fishResponse(Buffer.from([0x49,0x44,0x33,1]));
  for(let i=0;i<20;i++){res=await call(tts,{method:'POST',headers:{'x-forwarded-for':'198.51.100.21'},body:{text:'Limiettest.'}});assert.equal(res.statusCode,200)}
  res=await call(tts,{method:'POST',headers:{'x-forwarded-for':'198.51.100.21'},body:{text:'Limiettest.'}});assert.equal(res.statusCode,429);assert.equal(res.body.error,'rate_limited');assert.ok(Number(res.headers['Retry-After'])>=1);

  console.log('MAIR API failure behavior: PASS');
}finally{globalThis.fetch=originalFetch;restoreEnv()}
