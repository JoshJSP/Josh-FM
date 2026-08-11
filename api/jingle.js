const JINGLES={
  '1':'cab0e2326acf483d9d7d45e67a0a9d69',
  '2':'cc383dcffce2463fb7aabe3dd5876818',
  '3':'285e082c8ea04e1ba29aa4da4765ced4',
  '4':'508583122d3843efa166a17c17ce8b36',
  '5':'4b5b9fdf1dfd4d3f8b7624cad527d151',
  '6':'a5bf1f017fd5499e8c6fe7c917f11736',
  '7':'9467eb258c844f628508993f5103dcc5',
  '8':'e6266c2a981343f2ad58fc98e5479e50',
  '9':'37c0137e8b27400197080f08c1f4fb55',
  '10':'580b1d912d374e76a21ec23a61d4d866'
};

export default async function handler(req,res){
  const id=String(req.query?.id||'');
  const key=JINGLES[id];
  if(!key)return res.status(404).json({error:'Unknown jingle'});
  try{
    const upstream=await fetch(`https://www.aidocmaker.com/g0/audio?name=${key}`);
    if(!upstream.ok)throw new Error(`upstream ${upstream.status}`);
    const data=Buffer.from(await upstream.arrayBuffer());
    const type=upstream.headers.get('content-type')||'audio/mpeg';
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('Content-Length',String(data.length));
    return res.status(200).send(data);
  }catch(e){
    return res.status(502).json({error:'Jingle audio unavailable',detail:String(e?.message||e)});
  }
}
