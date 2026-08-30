import { getCache } from '@vercel/functions';

export const config = { regions: ['fra1'] };
const TTL = 6 * 60 * 60;
const MAX_REQUESTS = 24;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const key = code => `mair-passenger:${String(code||'').toUpperCase()}`;
const json = (res,status,body)=>{res.status(status).setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body))};
const clean = (v,n=120)=>String(v||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,n);
function code(){let out='';for(let i=0;i<6;i++)out+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];return out}
function secret(){return `${Date.now().toString(36)}-${crypto.randomUUID()}`}
async function read(cache,c){return await cache.get(key(c))||null}
async function write(cache,s){s.updatedAt=Date.now();await cache.set(key(s.code),s,{ttl:TTL,tags:['mair-passenger',`mair-passenger-${s.code}`]});return s}
function publicSession(s){return{ok:true,code:s.code,active:!!s.active,createdAt:s.createdAt,expiresAt:s.expiresAt,requestCount:(s.requests||[]).length,pendingCount:(s.requests||[]).filter(x=>x.status==='pending').length}}
export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,error:'Method not allowed'});
  const cache=getCache();
  try{
    if(req.method==='GET'){
      const c=clean(req.query?.code,12).toUpperCase(),host=clean(req.query?.hostSecret,180);
      if(!c)return json(res,400,{ok:false,error:'Sessiecode ontbreekt.'});
      const s=await read(cache,c);if(!s||Date.now()>Number(s.expiresAt||0))return json(res,404,{ok:false,error:'Sessie niet gevonden of verlopen.'});
      if(host&&host===s.hostSecret)return json(res,200,{...publicSession(s),requests:(s.requests||[]).slice(-MAX_REQUESTS),guestUrl:s.guestUrl||''});
      return json(res,200,publicSession(s));
    }
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),action=clean(body.action,30);
    if(action==='create'){
      let c='',tries=0,s=null;do{c=code();s=await read(cache,c);tries++}while(s&&tries<8);
      if(s)return json(res,503,{ok:false,error:'Kon geen sessiecode maken.'});
      const now=Date.now(),hostSecret=secret(),origin=clean(body.origin,240).replace(/\/$/,'');
      const session={code:c,hostSecret,active:true,createdAt:now,updatedAt:now,expiresAt:now+TTL*1000,guestUrl:origin?`${origin}/passenger.html?code=${encodeURIComponent(c)}`:'',requests:[]};
      await write(cache,session);return json(res,200,{...publicSession(session),hostSecret,guestUrl:session.guestUrl});
    }
    const c=clean(body.code,12).toUpperCase();if(!c)return json(res,400,{ok:false,error:'Sessiecode ontbreekt.'});
    const s=await read(cache,c);if(!s||Date.now()>Number(s.expiresAt||0))return json(res,404,{ok:false,error:'Sessie niet gevonden of verlopen.'});
    if(action==='request'){
      if(!s.active)return json(res,409,{ok:false,error:'Deze Passenger-sessie is gesloten.'});
      const query=clean(body.query,120),name=clean(body.name,40)||'Passagier';if(query.length<2)return json(res,400,{ok:false,error:'Vul een nummer of artiest in.'});
      const recent=(s.requests||[]).filter(x=>Date.now()-Number(x.createdAt||0)<10*60*1000);if(recent.length>=MAX_REQUESTS)return json(res,429,{ok:false,error:'Te veel verzoeken tegelijk. Probeer zo opnieuw.'});
      const r={id:`p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,query,name,status:'pending',createdAt:Date.now(),resolvedTrack:null,error:''};s.requests=[...(s.requests||[]),r].slice(-MAX_REQUESTS);await write(cache,s);return json(res,200,{ok:true,request:r});
    }
    const host=clean(body.hostSecret,180);if(!host||host!==s.hostSecret)return json(res,403,{ok:false,error:'Host-toegang geweigerd.'});
    if(action==='ack'){
      const id=clean(body.requestId,80),r=(s.requests||[]).find(x=>x.id===id);if(!r)return json(res,404,{ok:false,error:'Verzoek niet gevonden.'});
      r.status=['accepted','rejected','failed'].includes(body.status)?body.status:'accepted';r.resolvedTrack=body.resolvedTrack||null;r.error=clean(body.error,180);r.processedAt=Date.now();await write(cache,s);return json(res,200,{ok:true,request:r});
    }
    if(action==='close'){s.active=false;await write(cache,s);return json(res,200,publicSession(s))}
    return json(res,400,{ok:false,error:'Onbekende actie.'});
  }catch(error){console.error('[Passenger Mode]',error);return json(res,500,{ok:false,error:'Passenger Mode is tijdelijk niet beschikbaar.'})}
}
