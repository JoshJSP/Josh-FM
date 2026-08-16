import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=read('mair-personal-source-sync.js');
const polish=read('mair-pwa-polish.js');
const fail=[];const ok=(x,m)=>{if(!x)fail.push(m)};
ok(runtime.includes("CHANNEL_KEY='jfm_music_channel_v1'"),'personal source runtime must own the channel key');
ok(runtime.includes("localStorage.setItem(CHANNEL_KEY,'mix')"),'changing personal source must switch authoritative station to MY MAIR');
ok(runtime.includes("reason:'personal-source'"),'personal source playback state must be explicit');
ok(runtime.includes("source.addEventListener('change'")&&runtime.includes("queue=[]"),'source changes must clear the old queue without rebuilding a stale station');
ok(runtime.includes("rebuild.addEventListener('click'")&&runtime.includes('stopImmediatePropagation'),'personal rebuild must bypass the legacy wrapped rebuild handler');
ok(runtime.includes("active==='mix'?buildPersonal():inherited(...args)"),'generic buildSet must use the personal builder for MY MAIR only');
ok(runtime.includes("[data-mair-station=\"mix\"]")&&runtime.includes("activatePersonal('my-mair-tap')"),'MY MAIR station taps must enter personal-source mode before station routing');
ok(runtime.includes("api('/me/player/recently-played?limit=50')")&&runtime.includes("api('/me/tracks?limit=50&offset=${off}')")&&runtime.includes("api(`/playlists/${id}/items?limit=50&offset=${off}`)"),'personal builder must support recent, saved and playlist sources');
ok(polish.includes("mairPersonalSourceSyncJs")&&polish.includes("./mair-personal-source-sync.js?v=1"),'PWA polish must load the personal source runtime');
if(fail.length){console.error('Personal source sync FAILED');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('Personal source sync regression OK');
