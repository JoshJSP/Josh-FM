import assert from 'node:assert/strict';
import tts from '../api/tts.js';
import writer from '../api/dj-writer.js';

const originalFetch=globalThis.fetch;
const originalEnv={...process.env};
function response(){return{statusCode:0,headers:{},body:null,status(code){this.statusCode=code;return this},setHeader(name,value){this.headers[name]=value},json(value){this.body=value;return this},send(value){this.body=value;return this}}}
async function call(handler,req){const res=response();await handler(req,res);return res}
function fishResponse(body,{status=200,type='audio/mpeg'}={}){const data=Buffer.isBuffer(body)?body:Buffer.from(String(body));return{ok:status>=200&&status<300,status,headers:{get:name=>name.toLowerCase()==='content-type'?type:null},text:async()=>data.toString(),arrayBuffer:async()=>data}}
function restoreEnv(){for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv)}

try{
  delete process.env.FISH_AUDIO_API_KEY;
  let res=await call(tts,{method:'POST',body:{text:'Hallo'}});
  assert.equal(res.statusCode,503);assert.equal(res.body.error,'fish_key_missing');

  process.env.FISH_AUDIO_API_KEY='test-key';delete process.env.FISH_AUDIO_MODEL;
  let calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});if(url.includes('/model/'))return fishResponse(JSON.stringify({_id:'voice-josh',title:'Josh'}),{type:'application/json'});return fishResponse('unexpected')};
  res=await call(tts,{method:'GET',query:{djProfile:'UNKNOWN'}});
  assert.equal(res.statusCode,200);assert.equal(res.body.djProfile,'josh');assert.match(calls[0].url,/\/model\//);

  calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push({url,opt});return calls.length===1?fishResponse(JSON.stringify({message:'temporary'}),{status:500,type:'application/json'}):fishResponse(Buffer.from([0x49,0x44,0x33,1]))};
  res=await call(tts,{method:'POST',body:{text:'Dit is een test.',djProfile:'maya'}});
  assert.equal(res.statusCode,200);assert.equal(calls.length,2);assert.equal(res.headers['X-MAIR-DJ'],'maya');assert.equal(res.headers['X-JoshFM-Fish-Model'],'s2-pro');assert.ok(Buffer.isBuffer(res.body));

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
  res=await call(writer,{method:'POST',body:{currentTrack:{name:'Test',artists:['Artiest']}}});
  assert.equal(res.statusCode,429);assert.equal(res.body.error,'rate limited');

  process.env.GROQ_DJ_MODEL='llama-3.3-70b-versatile';calls=[];
  globalThis.fetch=async(url,opt)=>{calls.push(JSON.parse(opt.body).model);return calls.length===1?{ok:false,status:400,json:async()=>({error:{message:'model unavailable'}})}:{ok:true,status:200,json:async()=>({choices:[{message:{content:'Dit is betrouwbare Nederlandse radiotekst.'}}]})}};
  res=await call(writer,{method:'POST',body:{}});assert.equal(res.statusCode,200);assert.deepEqual(calls,['llama-3.3-70b-versatile','openai/gpt-oss-120b']);assert.equal(res.body.model,'openai/gpt-oss-120b');assert.equal(res.body.attempts.length,1);

  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'   '}}]})});
  res=await call(writer,{method:'POST',body:{}});assert.equal(res.statusCode,502);assert.match(res.body.error,/geen DJ-tekst/);assert.equal(res.body.attempts.length,3);

  globalThis.fetch=async()=>{const error=new Error('aborted');error.name='AbortError';throw error};
  res=await call(writer,{method:'POST',body:{}});assert.equal(res.statusCode,504);assert.equal(res.body.error,'Groq timeout');assert.equal(res.body.attempts.length,3);

  console.log('MAIR API failure behavior: PASS');
}finally{globalThis.fetch=originalFetch;restoreEnv()}
