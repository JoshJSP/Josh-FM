const PLAYLISTS={
  top40:{id:'5lH9NjOeJvctAO92ZrKQNB',label:'Qmusic Top 40',weight:1},
  airplay:{id:'7a5Qk0YvgHSdk6Ot3Yc7qS',label:'Airplay Top 40',weight:.86},
  streaming:{id:'1U0P7X7JJe1e7wcTrCkQIj',label:'Streaming Top 40',weight:.86},
  nl:{id:'37i9dQZF1DWUX3x84bv557',label:'Je Moerstaal',weight:1}
};
const TTL=10*60*1000,cache=new Map();
function text(v){return typeof v==='string'?v.trim():''}
function artists(item){
  const direct=Array.isArray(item?.artists)?item.artists.map(a=>text(a?.name||a)).filter(Boolean):[];
  if(direct.length)return direct;
  const sub=text(item?.subtitle);return sub?sub.split(/,\s*/).map(x=>x.trim()).filter(Boolean):[];
}
function image(item,entity){
  const sources=item?.coverArt?.sources||item?.visualIdentity?.image||entity?.visualIdentity?.image||entity?.coverArt?.sources||[];
  return Array.isArray(sources)?text(sources.find(x=>x?.url)?.url):'';
}
function normalizeTrack(item,rank,entity){
  const uri=text(item?.uri||item?.track?.uri),id=uri.startsWith('spotify:track:')?uri.split(':').pop():text(item?.id||item?.track?.id);
  const spotifyUri=uri.startsWith('spotify:track:')?uri:(id?`spotify:track:${id}`:'');
  if(!id||!spotifyUri)return null;
  const name=text(item?.title||item?.name||item?.track?.name);if(!name)return null;
  const duration=Number(item?.duration||item?.duration_ms||item?.track?.duration_ms||0);
  return{id,uri:spotifyUri,name,artists:artists(item),album:text(item?.album?.name||item?.track?.album?.name),release:text(item?.album?.release_date||item?.track?.album?.release_date),image:image(item,entity),url:`https://open.spotify.com/track/${id}`,duration:Number.isFinite(duration)?duration:0,rank};
}
function findEntity(root){
  const direct=root?.props?.pageProps?.state?.data?.entity;if(Array.isArray(direct?.trackList))return direct;
  const seen=new Set(),stack=[root];
  while(stack.length){const x=stack.pop();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);if(Array.isArray(x.trackList)&&x.trackList.length)return x;for(const v of Object.values(x))if(v&&typeof v==='object')stack.push(v)}
  return null;
}
async function fetchPlaylist(key){
  const spec=PLAYLISTS[key],hit=cache.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.items;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch(`https://open.spotify.com/embed/playlist/${spec.id}`,{headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'nl-NL,nl;q=0.9,en;q=0.7','User-Agent':'Mozilla/5.0 MAIR/2'},signal:controller.signal});
    if(!r.ok)throw Error(`Spotify embed ${r.status}`);
    const html=await r.text(),m=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if(!m)throw Error('Spotify embed data ontbreekt');
    const json=JSON.parse(m[1]),entity=findEntity(json),list=Array.isArray(entity?.trackList)?entity.trackList:[];
    const items=list.map((x,i)=>normalizeTrack(x,i+1,entity)).filter(Boolean);
    if(items.length<5)throw Error(`Spotify embed bevat slechts ${items.length} tracks`);
    cache.set(key,{at:Date.now(),items});return items;
  }finally{clearTimeout(timer)}
}
function dedupe(items){const s=new Set();return items.filter(t=>t?.id&&!s.has(t.id)&&(s.add(t.id),true))}
function radioDiversity(items,limit=50){
  const byArtist=new Map(),out=[];
  for(const t of items){const a=text(t.artists?.[0]).toLowerCase(),n=byArtist.get(a)||0;if(a&&n>=4)continue;if(a)byArtist.set(a,n+1);out.push(t);if(out.length>=limit)break}
  return out;
}
function hitsMix(sources){
  const scored=new Map();
  for(const [key,items] of Object.entries(sources)){const spec=PLAYLISTS[key];for(const t of items){const x=scored.get(t.id)||{...t,chartScore:0,chartSources:[],bestRank:99};x.chartScore+=spec.weight*Math.max(1,45-t.rank);x.bestRank=Math.min(x.bestRank,t.rank);if(!x.chartSources.includes(key))x.chartSources.push(key);scored.set(t.id,x)}}
  const ordered=[...scored.values()].map(x=>({...x,chartScore:x.chartScore+(x.chartSources.length-1)*14})).sort((a,b)=>b.chartScore-a.chartScore||a.bestRank-b.bestRank);
  return radioDiversity(ordered,50);
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const station=String(req.query?.station||'').toLowerCase();if(!['hits','top40','nl'].includes(station))return res.status(400).json({error:'station must be hits, top40 or nl'});
  try{
    if(station==='top40'){
      const items=(await fetchPlaylist('top40')).slice(0,40);
      res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');return res.status(200).json({station,source:'Nederlandse Top 40',playlist:PLAYLISTS.top40.id,items,updatedAt:new Date().toISOString()});
    }
    if(station==='nl'){
      const items=radioDiversity(await fetchPlaylist('nl'),50);
      res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');return res.status(200).json({station,source:'Spotify · Je Moerstaal',playlist:PLAYLISTS.nl.id,items,updatedAt:new Date().toISOString()});
    }
    const settled=await Promise.allSettled(['top40','airplay','streaming'].map(async key=>[key,await fetchPlaylist(key)])),sources={},errors=[];
    for(const result of settled){if(result.status==='fulfilled'){const[key,items]=result.value;sources[key]=items}else errors.push(String(result.reason?.message||result.reason))}
    const items=hitsMix(sources);if(items.length<5)throw Error(errors.at(-1)||'Nederlandse hitlijsten leverden te weinig tracks');
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');return res.status(200).json({station,source:'Nederlandse Top 40 + Airplay Top 40 + Streaming Top 40',sources:Object.keys(sources),items,partial:errors.length>0,updatedAt:new Date().toISOString()});
  }catch(e){return res.status(e?.name==='AbortError'?504:502).json({error:'nl_chart_unavailable',detail:String(e?.message||e).slice(0,300)})}
}
