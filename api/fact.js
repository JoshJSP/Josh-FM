const MB_BASE='https://musicbrainz.org/ws/2';
const UA='JoshFM/2.1 (https://github.com/JoshJSP/Josh-FM)';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const track=req.body?.track;if(!track?.name)return res.status(400).json({error:'Missing track'});
  const artist=(track.artists||[])[0]||'',album=track.album||'',release=track.release||'';
  const facts=[];let sourceUrl='',sources=[];

  // Spotify metadata is already verified for the exact playing item.
  if(album)facts.push(`Het nummer staat op het album ${album}.`);
  if(release)facts.push(`Spotify geeft ${release} als releasedatum van deze uitgave.`);

  // Match the exact recording in MusicBrainz and add only concrete metadata.
  let mb=null;
  try{
    const q=`recording:"${track.name.replace(/"/g,'')}"${artist?` AND artist:"${artist.replace(/"/g,'')}"`:''}`;
    const r=await fetch(`${MB_BASE}/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`,{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(r.ok){const d=await r.json();mb=(d.recordings||[]).find(x=>Number(x.score||0)>=90)||(d.recordings||[]).find(x=>Number(x.score||0)>=80)||null}
    if(mb){
      if(mb['first-release-date'])facts.push(`MusicBrainz dateert de eerste bekende release van deze opname op ${mb['first-release-date']}.`);
      if(Array.isArray(mb.isrcs)&&mb.isrcs.length)facts.push(`Voor deze opname is de ISRC ${mb.isrcs[0]} geregistreerd.`);
      sourceUrl=`https://musicbrainz.org/recording/${mb.id}`;sources.push('MusicBrainz');
    }
  }catch{}

  // Wikipedia is used only when search results strongly point to this song/artist.
  try{
    const query=`"${track.name}" "${artist}" song`;
    const s=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=5`);
    if(s.ok){
      const sd=await s.json(),hits=sd?.query?.search||[];
      const norm=x=>String(x||'').toLowerCase();
      const hit=hits.find(h=>norm(h.title).includes(norm(track.name).replace(/\s*\(.+?\)\s*/g,'')))||hits[0];
      if(hit){
        const p=await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&pageids=${hit.pageid}`);
        if(p.ok){
          const pd=await p.json(),page=pd?.query?.pages?.[hit.pageid],text=(page?.extract||'').replace(/\s+/g,' ').trim();
          const low=norm(text),artistToken=norm(artist).split(/\s+/)[0],titleToken=norm(track.name).split(/\s+/)[0];
          if(text.length>100&&low.includes(artistToken)&&low.includes(titleToken)){
            const sentences=text.split(/(?<=[.!?])\s+/).filter(x=>x.length>35&&x.length<260).slice(0,4);
            facts.push(...sentences);
            sourceUrl=page?.fullurl||sourceUrl;sources.push('Wikipedia');
          }
        }
      }
    }
  }catch{}

  const unique=[...new Set(facts.map(x=>x.trim()).filter(Boolean))].slice(0,6);
  if(!unique.length)return res.status(204).end();
  return res.status(200).json({text:unique.join(' ').slice(0,1100),source:sources.length?sources.join(' + '):'Spotify metadata',url:sourceUrl||track.url||''});
}
