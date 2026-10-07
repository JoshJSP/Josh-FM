// Poort voor de vier AI-routes (dj-writer, discover, category-filter, news-bulletin).
//
// Zonder deze poort kon iedereen met curl op Josh' kosten tekst laten schrijven.
// Twee drempels, allebei nodig:
//
// 1. Origin moet het eigen domein zijn. Een browser zet die header zelf en een
//    andere site kan hem niet vervalsen; curl kan dat wel, dus dit alleen is geen
//    slot. Vergelijken met de eigen Host dekt productie, previews en `vercel dev`
//    zonder lijst die bij elke nieuwe preview-URL veroudert.
// 2. Een geldige Spotify-sessie. MAIRFM heeft geen eigen accounts, maar wie de
//    radio gebruikt heeft altijd een Spotify-token. De server vraagt bij Spotify
//    na van wie het is en onthoudt dat tien minuten, zodat het één extra aanroep
//    per tien minuten kost en niet één per DJ-break.
//    Met MAIR_ALLOWED_SPOTIFY_USERS (komma-gescheiden Spotify-gebruikers-id's)
//    mag alleen die lijst erdoor; zonder lijst elke geldige Spotify-gebruiker.
//
// Faalt de controle zelf (Spotify onbereikbaar), dan gaat de deur dicht: de DJ
// slaat dan een break over, de muziek speelt door. Liever dat dan een open deur.
import {createHash} from 'node:crypto';
import {timedFetch} from './_ai.js';

const SEEN=new Map(),TTL_MS=10*60000;
const list=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const hostOf=v=>{try{return new URL(v).host}catch{return ''}};

export function originAllowed(req){
  const origin=String(req.headers?.origin||'').trim();
  if(!origin)return false;
  const own=String(req.headers?.['x-forwarded-host']||req.headers?.host||'').split(',')[0].trim().toLowerCase();
  if(own&&hostOf(origin).toLowerCase()===own)return true;
  return list(process.env.MAIR_ALLOWED_ORIGINS).includes(origin);
}

function userAllowed(id){
  const allowed=list(process.env.MAIR_ALLOWED_SPOTIFY_USERS);
  return !allowed.length||allowed.includes(id)?{ok:true,user:id}:{ok:false,status:403,error:'spotify_user_not_allowed'};
}

export async function spotifyUser(req){
  const m=/^Bearer\s+(\S{20,1000})$/i.exec(String(req.headers?.authorization||'').trim());
  if(!m)return{ok:false,status:401,error:'spotify_token_missing'};
  const key=createHash('sha256').update(m[1]).digest('hex'),now=Date.now(),hit=SEEN.get(key);
  if(hit&&hit.until>now)return userAllowed(hit.user);
  let r;
  try{r=await timedFetch('https://api.spotify.com/v1/me',{headers:{Authorization:`Bearer ${m[1]}`}},4000)}
  catch{return{ok:false,status:503,error:'spotify_check_unavailable'}}
  if(r.status===401||r.status===403)return{ok:false,status:401,error:'spotify_token_invalid'};
  const id=r.ok?String((await r.json().catch(()=>null))?.id||''):'';
  if(!id)return{ok:false,status:503,error:'spotify_check_unavailable'};
  if(SEEN.size>256)for(const[k,v]of SEEN)if(v.until<=now)SEEN.delete(k);
  SEEN.set(key,{user:id,until:now+TTL_MS});
  return userAllowed(id);
}

// Geeft true als het verzoek door mag; anders is het antwoord al verstuurd.
export async function guardAI(req,res){
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return false}
  const who=await spotifyUser(req);
  if(!who.ok){res.status(who.status).json({error:who.error});return false}
  return true;
}
