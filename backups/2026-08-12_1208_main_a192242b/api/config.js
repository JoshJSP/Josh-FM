export default function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const spotifyClientId=process.env.SPOTIFY_CLIENT_ID||'';
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=300');
  return res.status(200).json({spotifyClientId});
}
