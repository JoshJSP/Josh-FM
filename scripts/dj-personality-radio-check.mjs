import assert from 'node:assert/strict';
import writer from '../api/dj-writer.js';

const originalFetch=globalThis.fetch,originalKey=process.env.GROQ_API_KEY,originalModel=process.env.GROQ_DJ_MODEL;
function response(){return{statusCode:0,body:null,headers:{},status(code){this.statusCode=code;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}}}
async function call(body,ip){const res=response();await writer({method:'POST',headers:{'x-forwarded-for':ip},body},res);return res}
try{
  process.env.GROQ_API_KEY='test-key';delete process.env.GROQ_DJ_MODEL;
  const bodies=[];
  globalThis.fetch=async(url,opt)=>{const parsed=JSON.parse(opt.body);bodies.push(parsed);return{ok:true,status:200,json:async()=>({choices:[{message:{content:'Korte radiotekst die natuurlijk klinkt.'}}]})}};
  const makeBody=(djProfile,daypart='avond')=>({breakId:`personality-${djProfile}`,breakType:'STATION_ID',targetWords:8,energy:'NORMAL',djProfile,context:{schemaVersion:'1.0.0',break:{breakType:'STATION_ID',targetWords:8,maxDurationSeconds:6,energy:'NORMAL',mustMention:[],permittedTopics:['station'],prohibitedTopics:[]},onAir:{previous:null,next:null,future:[],relationship:null},session:{station:'MAIR',localTime:'20:08',day:'woensdag',daypart,durationMinutes:30,narrative:{}},memory:{revision:0,recentBreaks:[],usedFactIds:[]},allowedFacts:[],doNot:[]}});
  let res=await call(makeBody('max','middag'),'198.51.100.31');
  assert.equal(res.statusCode,200);assert.equal(res.body.persona,'max');
  let system=bodies.at(-1).messages[0].content,user=bodies.at(-1).messages[1].content;
  assert.match(system,/energieke drive- en partyhost/i);assert.match(system,/geen geschreeuw/i);assert.match(system,/geen chatbot/i);assert.match(user,/CONTEXT:/);assert.match(user,/MAIR/);

  res=await call(makeBody('noah','late avond'),'198.51.100.32');
  assert.equal(res.statusCode,200);assert.equal(res.body.persona,'noah');
  system=bodies.at(-1).messages[0].content;assert.match(system,/rustige curator/i);assert.match(system,/minder woorden/i);

  res=await call(makeBody('maya'),'198.51.100.33');
  assert.equal(res.statusCode,200);assert.equal(res.body.persona,'maya');assert.match(bodies.at(-1).messages[0].content,/warme storyteller/i);
  console.log('MAIR DJ personality + radio clock: PASS');
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.GROQ_DJ_MODEL;else process.env.GROQ_DJ_MODEL=originalModel;
}
