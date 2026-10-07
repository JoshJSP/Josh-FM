// Stuurt de Spotify-sessie mee naar de vier AI-routes. De server laat ze alleen
// toe met een geldig Spotify-token (api/_guard.js). Eén plek in plaats van een
// header in elke beller: mair-dj-v2, mair-news-bulletin, mair-test-lab en
// channel-click-fix praten allemaal via window.fetch.
// Zonder token gaat het verzoek gewoon door en antwoordt de server 401; de DJ
// slaat dan een break over en de muziek speelt door.
(()=>{if(window.__mairAIAuth)return;window.__mairAIAuth=true;const native=window.fetch.bind(window),AI=/^\/api\/(dj-writer|discover|category-filter|news-bulletin)$/;
const aiPath=input=>{try{const u=new URL(typeof input==='string'?input:String(input?.url||''),location.href);return u.origin===location.origin&&AI.test(u.pathname)}catch{return false}};
window.fetch=async function(input,init){if(aiPath(input)){const token=await window.JFMAuth?.ensure?.().catch?.(()=>null);if(token){const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('Authorization',`Bearer ${token}`);init={...init,headers}}}return native(input,init)};
window.MAIRAIAuth={version:'mair-ai-auth-v1'}})();
