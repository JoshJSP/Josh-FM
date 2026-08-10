const MB_BASE='https://musicbrainz.org/ws/2';
const UA='JoshFM/2.0 (https://github.com/JoshJSP/Josh-FM)';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const track=req.body?.track;
  if(!track?.name) return res.status(400).json({error:'Missing track'});

  const artist=(track.artists||[])[0]||'';
  const query=`recording:"${track.name.replace(/"/g,'')}"${artist?` AND artist:"${artist.replace(/"/g,'')}"`:''}`;
  let mb=null;
  try{
    const r=await fetch(`${MB_BASE}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=3`,{headers:{'User-Agent':UA,'Accept':'application/json'}});
    if(r.ok){const d=await r.json();mb=(d.recordings||[]).find(x=>Number(x.score||0)>=80)||(d.recordings||[])[0]||null}
  }catch{}

  try{
    const searchTerm=[track.name,artist].filter(Boolean).join(' ');
    const s=await fetch(`https://nl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&utf8=1&format=json&srlimit=4`);
    if(s.ok){
      const sd=await s.json(),hit=(sd?.query?.search||[])[0];
      if(hit){
        const p=await fetch(`https://nl.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&pageids=${hit.pageid}`);
        if(p.ok){
          const pd=await p.json(),page=pd?.query?.pages?.[hit.pageid],text=(page?.extract||'').replace(/\s+/g,' ').trim();
          if(text.length>80){
            const summary=text.split(/(?<=[.!?])\s+/).filter(x=>x.length>35).slice(0,3).join(' ').slice(0,650);
            if(summary)return res.status(200).json({text:summary,source:'Wikipedia + MusicBrainz',url:page?.fullurl||'',musicbrainz:mb?{id:mb.id,firstReleaseDate:mb['first-release-date']||null,score:mb.score||null}:null});
          }
        }
      }
    }
  }catch{}

  if(mb){
    const date=mb['first-release-date'],dis=mb.disambiguation,parts=[];
    if(date)parts.push(`MusicBrainz dateert de eerste bekende release van deze opname op ${date}.`);
    if(dis)parts.push(dis);
    if(parts.length)return res.status(200).json({text:parts.join(' '),source:'MusicBrainz',url:`https://musicbrainz.org/recording/${mb.id}`});
  }
  return res.status(204).end();
}
