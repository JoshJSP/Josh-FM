const CACHE='josh-fm-v15-live-ui';
const CORE=['./','./index.html','./styles.css','./app.js','./stability-core.js','./dj-resume.js','./discovery.js','./debug-tts.js','./dj-audio-guard.js','./dj-context.js','./request-manager.js','./station-clock.js','./station-clock-bridge.js','./rotation-engine.js','./director.js','./smart-dj.js','./radio-suite.js','./radio-upgrades.js','./playback-state.js','./spotify-recovery.js','./station-queue.js','./live-ui.js','./dj-now-queue.js','./manifest.webmanifest','./logo.svg'];

async function cacheCore(){
  const cache=await caches.open(CACHE);
  const jobs=CORE.map(async path=>{
    try{const r=await fetch(path,{cache:'reload'});if(r.ok)await cache.put(path,r.clone())}catch{}
  });
  await Promise.allSettled(jobs)
}
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(cacheCore())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('josh-fm-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
function bypass(request,url){return request.method!=='GET'||url.pathname.startsWith('/api/')||url.hostname.includes('spotify')||url.hostname.includes('wikipedia')||url.hostname.includes('musicbrainz')||url.hostname.includes('open-meteo')||url.hostname.includes('fish.audio')}
async function networkFirst(request){const cache=await caches.open(CACHE);try{const response=await fetch(request,{cache:'no-store'});if(response?.ok)await cache.put(request,response.clone());return response}catch{const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;if(request.mode==='navigate')return cache.match('./index.html')||cache.match('./');throw new Error('offline')}}
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(bypass(event.request,url))return;event.respondWith(networkFirst(event.request))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='CACHE_VERSION')event.source?.postMessage?.({type:'CACHE_VERSION',cache:CACHE})});
