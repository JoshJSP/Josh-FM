const MB_BASE='https://musicbrainz.org/ws/2';
const UA='JoshFM/2.2 (https://github.com/JoshJSP/Josh-FM)';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const track=req.body?.track;if(!track?.name)return res.status(400).json({error:'Missing track'});
  const artist=(track.artists||[])[0]||'',album=track.album||'',release=track.release||'';
  const facts=[];let sourceUrl='',sources=[];

  if(album)facts.push(`${track.name} staat op het album ${album}.`);
  if(release)facts.push(`Deze uitgave verscheen op ${release}.`);

  let mb=null;
  try{
    const q=`recording:"${track.name.replace(/"/g,'')}"${artist?` AND artist:"${artist.replace(/"/g,'')}"`:''}`;
    const r=await fetch(`${MB_BASE}/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`,{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(r.ok){const d=await r.json();mb=(d.recordings||[]).find(x=>Number(x.score||0)>=90)||(d.recordings||[]).find(x=>Number(x.score||0)>=80)||null}
    if(mb){if(mb['first-release-date'])facts.push(`De eerste bekende release van deze opname dateert van ${mb['first-release-date']}.`);sourceUrl=`https://musicbrainz.org/recording/${mb.id}`;sources.push('MusicBrainz')}
  }catch{}

  try{
    const query=`"${track.name}" "${artist}" song`;
    const s=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=6`);
    if(s.ok){const sd=await s.json(),tn=norm(track.name).replace(/\b(remaster(ed)?|radio edit|single version|live)\b/g,'').trim(),an=norm(artist),hits=sd?.query?.search||[];const hit=hits.find(h=>{const title=norm(h.title),snippet=norm(h.snippet);return title.includes(tn)&&(snippet.includes(an.split(' ')[0])||title.includes(an))})||hits.find(h=>norm(h.title).includes(tn));if(hit){const p=await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&pageids=${hit.pageid}`);if(p.ok){const pd=await p.json(),page=pd?.query?.pages?.[hit.pageid],text=(page?.extract||'').replace(/\s+/g,' ').trim(),low=norm(text);if(text.length>100&&low.includes(an.split(' ')[0])&&low.includes(tn.split(' ')[0])){const sentences=text.split(/(?<=[.!?])\s+/).filter(x=>x.length>35&&x.length<260).slice(0,3);facts.push(...sentences);sourceUrl=page?.fullurl||sourceUrl;sources.push('Wikipedia')}}}}
  }catch{}

  const unique=[...new Set(facts.map(x=>x.trim()).filter(Boolean))].slice(0,5);
  if(!unique.length)return res.status(204).end();
  return res.status(200).json({text:unique.join(' ').slice(0,1050),source:sources.length?sources.join(' + '):'Spotify metadata',url:sourceUrl||track.url||''});
}
