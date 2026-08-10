const MB_BASE='https://musicbrainz.org/ws/2';
const UA='JoshFM/2.2 (https://github.com/JoshJSP/Josh-FM)';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const track=req.body?.track;if(!track?.name)return res.status(400).json({error:'Missing track'});
  const artist=(track.artists||[])[0]||'',album=track.album||'',release=track.release||'';
  const interesting=[];let sourceUrl='',sources=[];

  // Prefer Dutch Wikipedia when it has a strong match. English is only raw background for the AI,
  // which is instructed to translate/paraphrase it into Dutch before speaking.
  async function wiki(lang){
    try{
      const query=`"${track.name}" "${artist}"`;
      const s=await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=6`);
      if(!s.ok)return false;const sd=await s.json(),tn=norm(track.name).replace(/\b(remaster(ed)?|radio edit|single version|live)\b/g,'').trim(),an=norm(artist),hits=sd?.query?.search||[];
      const hit=hits.find(h=>{const title=norm(h.title),snippet=norm(h.snippet);return title.includes(tn)&&(snippet.includes(an.split(' ')[0])||title.includes(an))})||hits.find(h=>norm(h.title).includes(tn));
      if(!hit)return false;
      const p=await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&pageids=${hit.pageid}`);
      if(!p.ok)return false;const pd=await p.json(),page=pd?.query?.pages?.[hit.pageid],text=(page?.extract||'').replace(/\s+/g,' ').trim(),low=norm(text);
      if(text.length<100||!low.includes(an.split(' ')[0])||!low.includes(tn.split(' ')[0]))return false;
      const sentences=text.split(/(?<=[.!?])\s+/).filter(x=>x.length>45&&x.length<300).filter(x=>!/^.+ (is|was) (a|an|the) song\b/i.test(x)).slice(0,4);
      if(sentences.length){interesting.push(...sentences);sourceUrl=page?.fullurl||sourceUrl;sources.push(lang==='nl'?'Wikipedia NL':'Wikipedia EN');return true}
    }catch{}
    return false;
  }
  const gotNl=await wiki('nl');if(!gotNl)await wiki('en');

  // MusicBrainz is useful as identity verification, but don't make release dates the default radio story.
  try{
    const q=`recording:"${track.name.replace(/"/g,'')}"${artist?` AND artist:"${artist.replace(/"/g,'')}"`:''}`;
    const r=await fetch(`${MB_BASE}/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`,{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(r.ok){const d=await r.json(),mb=(d.recordings||[]).find(x=>Number(x.score||0)>=90)||(d.recordings||[]).find(x=>Number(x.score||0)>=80)||null;if(mb){sourceUrl=sourceUrl||`https://musicbrainz.org/recording/${mb.id}`;sources.push('MusicBrainz')}}
  }catch{}

  let facts=[...new Set(interesting.map(x=>x.trim()).filter(Boolean))].slice(0,4);
  // Only when there is no richer context, provide minimal metadata as a fallback. Do not lead with a date.
  if(!facts.length&&album)facts.push(`${track.name} staat op het album ${album}.`);
  if(!facts.length&&release)facts.push(`Voor deze plaat is als releasedatum ${release} geregistreerd.`);
  if(!facts.length)return res.status(204).end();
  return res.status(200).json({text:facts.join(' ').slice(0,1400),source:sources.length?sources.join(' + '):'muziekdata',url:sourceUrl||track.url||''});
}
