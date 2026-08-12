const MB_BASE='https://musicbrainz.org/ws/2';
const UA='JoshFM/2.3 (https://github.com/JoshJSP/Josh-FM)';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const track=req.body?.track;if(!track?.name)return res.status(400).json({error:'Missing track'});
  const artist=(track.artists||[])[0]||'',album=track.album||'',release=track.release||'';const interesting=[];let sourceUrl='',sources=[];
  async function wikiEnglish(){
    try{const query=`"${track.name}" "${artist}"`,s=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=6`);if(!s.ok)return false;const sd=await s.json(),tn=norm(track.name).replace(/\b(remaster(ed)?|radio edit|single version|live)\b/g,'').trim(),an=norm(artist),hits=sd?.query?.search||[];const hit=hits.find(h=>{const title=norm(h.title),snippet=norm(h.snippet);return title.includes(tn)&&(snippet.includes(an.split(' ')[0])||title.includes(an))})||hits.find(h=>norm(h.title).includes(tn));if(!hit)return false;const p=await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&pageids=${hit.pageid}`);if(!p.ok)return false;const pd=await p.json(),page=pd?.query?.pages?.[hit.pageid],text=(page?.extract||'').replace(/\s+/g,' ').trim(),low=norm(text);if(text.length<100||!low.includes(an.split(' ')[0])||!low.includes(tn.split(' ')[0]))return false;const sentences=text.split(/(?<=[.!?])\s+/).filter(x=>x.length>45&&x.length<300).filter(x=>!/^.+ (is|was) (a|an|the) song\b/i.test(x)).slice(0,4);if(sentences.length){interesting.push(...sentences);sourceUrl=page?.fullurl||sourceUrl;sources.push('Wikipedia EN');return true}}catch{}return false
  }
  await wikiEnglish();
  try{const q=`recording:"${track.name.replace(/"/g,'')}"${artist?` AND artist:"${artist.replace(/"/g,'')}"`:''}`,r=await fetch(`${MB_BASE}/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`,{headers:{'User-Agent':UA,Accept:'application/json'}});if(r.ok){const d=await r.json(),mb=(d.recordings||[]).find(x=>Number(x.score||0)>=90)||(d.recordings||[]).find(x=>Number(x.score||0)>=80)||null;if(mb){sourceUrl=sourceUrl||`https://musicbrainz.org/recording/${mb.id}`;sources.push('MusicBrainz')}}}catch{}
  let facts=[...new Set(interesting.map(x=>x.trim()).filter(Boolean))].slice(0,4);if(!facts.length&&album)facts.push(`${track.name} appears on the album ${album}.`);if(!facts.length&&release){const year=String(release).slice(0,4);facts.push(`${track.name} was released${/^\d{4}$/.test(year)?` in ${year}`:''}.`)}if(!facts.length)return res.status(204).end();
  return res.status(200).json({text:facts.join(' ').slice(0,1400),source:sources.length?sources.join(' + '):'music data',url:sourceUrl||track.url||''});
}
