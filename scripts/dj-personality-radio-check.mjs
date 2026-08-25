import assert from 'node:assert/strict';
import writer from '../api/dj-writer.js';

const originalFetch=globalThis.fetch,originalKey=process.env.GROQ_API_KEY,originalModel=process.env.GROQ_DJ_MODEL;
function response(){return{statusCode:0,body:null,headers:{},status(code){this.statusCode=code;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}}}
async function call(body,ip){const res=response();await writer({method:'POST',headers:{'x-forwarded-for':ip},body},res);return res}
try{
  process.env.GROQ_API_KEY='test-key';delete process.env.GROQ_DJ_MODEL;
  const bodies=[];
  globalThis.fetch=async(url,opt)=>{const parsed=JSON.parse(opt.body);bodies.push(parsed);return{ok:true,status:200,json:async()=>({choices:[{message:{content:'Korte radiotekst die natuurlijk klinkt.'}}]})}};
  let res=await call({dj:{id:'max',name:'Max',role:'The Hype'},time:'17:15',station:'MAIR PARTY',previousTrack:{name:'Vorige',artists:['A']},currentTrack:{name:'Nu',artists:['B']},nextTrack:{name:'Straks',artists:['C']},recentDJ:['We gaan door met B.']},'198.51.100.31');
  assert.equal(res.statusCode,200);assert.equal(res.body.persona,'max');assert.equal(res.body.daypart,'drive');assert.equal(res.body.clockPhase,'quarter');assert.equal(res.body.show,'MAIR Drive');
  let system=bodies.at(-1).messages[0].content,user=bodies.at(-1).messages[1].content;
  assert.match(system,/energieke MAIR drive\/party host/i);assert.match(system,/geen geschreeuw/i);assert.match(system,/Vermijd de automatische formule/i);assert.match(user,/RECENTE DJ-BREAKS:/);assert.match(user,/MAIR Drive/);

  res=await call({dj:{id:'noah',name:'Noah',role:'The Curator'},time:'23:30',station:'MAIR CHILL',currentTrack:{name:'Nacht',artists:['D']}},'198.51.100.32');
  assert.equal(res.statusCode,200);assert.equal(res.body.persona,'noah');assert.equal(res.body.daypart,'late-night');assert.equal(res.body.clockPhase,'half-hour');assert.equal(res.body.show,'MAIR Late Night');
  system=bodies.at(-1).messages[0].content;assert.match(system,/rustige MAIR curator/i);assert.match(system,/Minder woorden/i);

  res=await call({dj:{id:'maya',name:'Maya'},time:'20:08',station:'MAIR CHILL',currentTrack:{name:'Avond',artists:['E']}},'198.51.100.33');
  assert.equal(res.body.persona,'maya');assert.equal(res.body.daypart,'evening');assert.equal(res.body.clockPhase,'music-sweep');
  console.log('MAIR DJ personality + radio clock: PASS');
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.GROQ_DJ_MODEL;else process.env.GROQ_DJ_MODEL=originalModel;
}