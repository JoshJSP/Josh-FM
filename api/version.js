export default function handler(req,res){
  const commit=String(process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.status(200).json({version:'2.0.0-beta.2',displayVersion:'2b.0.2',commit,cache:'mair-v50-dj-v2-voice-check-20260815'});
}
