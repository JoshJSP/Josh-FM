export default function handler(req,res){
  const commit=String(process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.status(200).json({version:'2.2.5',commit,cache:'josh-fm-v41-v226-dj-progress'});
}
