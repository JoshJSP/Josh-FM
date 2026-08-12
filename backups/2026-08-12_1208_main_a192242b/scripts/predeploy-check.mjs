import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const fail=[];const pass=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const ok=(name,cond,detail='')=>{(cond?pass:fail).push(`${name}${detail?` — ${detail}`:''}`)};

function walk(dir='.'){
  const out=[];
  for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    if(['.git','node_modules','.vercel'].includes(e.name))continue;
    const rel=path.join(dir,e.name).replace(/^\.\//,'');
    if(e.isDirectory())out.push(...walk(rel));else out.push(rel)
  }
  return out
}

const files=walk();
const js=files.filter(f=>f.endsWith('.js')||f.endsWith('.mjs'));
for(const f of js){try{execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'});pass.push(`syntax ${f}`)}catch(e){fail.push(`syntax ${f} — ${String(e.stderr||e.message).trim()}`)}}

const runtimeJs=js.filter(f=>!f.startsWith('scripts/')&&!f.startsWith('tests/')&&!f.startsWith('.github/'));
const allJs=runtimeJs.map(f=>[f,read(f)]);
const spotifyPlayers=allJs.filter(([,s])=>s.includes('new Spotify.Player'));
ok('single Spotify.Player',spotifyPlayers.length===1&&spotifyPlayers[0]?.[0]==='stability-core.js',spotifyPlayers.map(([f])=>f).join(', ')||'none');
ok('legacy spotify-core removed',!exists('spotify-core.js'));
ok('duplicate web playback controller removed',!exists('playback-web-sdk.js'));
ok('primary playback controller exists',exists('playback-primary.js'));
ok('central DJ handoff exists',exists('dj-handoff-v34.js'));
ok('Spotify API budget exists',exists('spotify-api-budget.js'));

if(exists('stability-core.js')){
  const s=read('stability-core.js');
  ok('SDK core auth-device only',s.includes('sdk-core-v3-auth-device-only'));
  ok('SDK core has no transport button ownership',!/(?:ownButton|own|replace)\(['"](?:start|play|next|prev)['"]/.test(s));
  ok('SDK core has no DJ ownership',!s.includes('window.djBreak=')&&!s.includes('stableDJBreak'));
  ok('SDK clears stale device on not_ready',s.includes("player.addListener('not_ready'")&&s.includes("rememberDevice('')"));
  ok('SDK clears stale device on auth failure',s.includes("authentication_error")&&s.includes("rememberDevice('')"));
  ok('SDK emits empty playback state',s.includes("item:null")&&s.includes("sdk-empty"));
}

if(exists('playback-state.js')){
  const p=read('playback-state.js');
  ok('playback truth clears explicit empty state',p.includes('explicitlyEmpty')&&p.includes("truth-v2-empty-state-safe"));
  ok('trackchange includes previous track id',p.includes('previousTrackId'));
}

if(exists('playback-primary.js')){
  const p=read('playback-primary.js');
  ok('primary controller marker',p.includes("JFMPlaybackPrimary='playback-primary'"));
  ok('primary owns transport DOM',p.includes("dataset.jfmOwner='primary'")&&p.includes("own('play'")&&p.includes("own('next'")&&p.includes("own('prev'"));
  ok('iOS gesture capture',p.includes('activateElement')&&p.includes("document.addEventListener('click'"));
  ok('transport verification',p.includes('verify(')&&p.includes('Spotify bevestigde'));
  ok('normal device transfer preserves state',p.includes('preserve&&!!s?.is_playing'));
  ok('station start silences transfer before jingle',p.includes('transfer(id,false)')&&p.indexOf('transfer(id,false)')<p.indexOf('Josh FM-jingle'));
  ok('station context preserved on explicit play',p.includes('stationContext')&&p.includes('playContextDirect'));
  ok('skip has station-neighbor fallback',p.includes('stationNeighbor')&&p.includes('primary-next-fallback'));
}

if(exists('spotify-api-budget.js')){
  const b=read('spotify-api-budget.js');
  ok('API watchdog >= 15 seconds',b.includes('POLL_MS=15000'));
  ok('API budget is event-driven',b.includes("jfm:trackchange")&&b.includes('api-budget-v1-event-driven'));
}

if(exists('dj-handoff-v34.js')){
  const d=read('dj-handoff-v34.js');
  ok('DJ handoff resumes without URI body',d.includes("api(pathWithDevice('/me/player/play'),{method:'PUT'})")&&!d.includes('position_ms:0'));
  ok('DJ handoff never seeks to zero',!d.includes('seek(0)')&&!d.includes('position_ms=0'));
  ok('DJ handoff preserves expected URI',d.includes('resumePreservingContext(expectedUri)'));
  ok('DJ handoff validates device id',d.includes('const DEVICE=')&&d.includes('validDevice'));
  ok('DJ handoff owns manual button by replacement',d.includes("dataset.jfmHandoffOwner='v34'")&&d.includes('cloneNode(true)'));
}

if(exists('dj-now-queue.js')){
  const d=read('dj-now-queue.js');
  ok('legacy DJ engine disabled',d.includes('legacy-disabled-v35')&&!d.includes('/me/player/pause')&&!d.includes('seek(0)'));
}

if(exists('dj-resume.js')){
  const d=read('dj-resume.js');
  ok('DJ resume points to central owner',d.includes("owner:'dj-handoff-v34.js'"));
}

if(exists('spotify-recovery.js')){
  const r=read('spotify-recovery.js');
  ok('recovery is delegated',r.includes('recovery-v6-delegated'));
  ok('recovery does not bind transport buttons',!r.includes('cloneNode')&&!r.includes("addEventListener('click'"));
  ok('recovery does not create player',!r.includes('new Spotify.Player'));
}

if(exists('discovery.js')){
  const d=read('discovery.js');
  ok('discovery API budget <= 5',/MAX_SEARCHES=([0-5])\b/.test(d));
  ok('discovery honors shared cooldown',d.includes('sharedCooldown')&&d.includes('JFMSpotifyGuard'));
}

if(exists('spotify-test-config.js')){
  const s=read('spotify-test-config.js');
  ok('primary loader wired v35',s.includes('playback-primary.js?v=35'));
  ok('DJ handoff loader wired v35',s.includes('dj-handoff-v34.js?v=35')&&s.includes('loadDJHandoff'));
  ok('API budget loader wired',s.includes('spotify-api-budget.js?v=35')&&s.includes('loadApiBudget'));
  ok('Spotify device validation',s.includes('isDevice')&&s.includes('device_ids'));
  ok('Spotify search cache >= 5 minutes',s.includes('300000'));
  ok('Spotify search pacing >= 1500ms',s.includes('1500-(Date.now()-lastSearchAt)'));
  ok('old web SDK loader absent',!s.includes('playback-web-sdk.js'));
}

if(exists('integration-guards.js')){
  const g=read('integration-guards.js');
  ok('memory clear owns its button',g.includes("dataset.jfmDataOwner='v35'")&&g.includes('clearPersonalMemory'));
  ok('memory clear covers requests and preferences',g.includes("'jfm_requests_v1'")&&g.includes("'jfm_director_memory'")&&g.includes("'jfm_dj_feedback'"));
  ok('logout owns its button',g.includes("dataset.jfmLogoutOwner='v35'")&&g.includes('disconnectSpotify'));
  ok('logout clears device and PKCE',g.includes("'jfm_spotify_device_id'")&&g.includes("'jfm_pkce_verifier_v2'"));
}

if(exists('personal-top40.js')){
  const t=read('personal-top40.js');
  ok('Top 40 canonical dedupe',t.includes('canonicalKey')&&t.includes('mergeEntries'));
  ok('Top 40 clear API',t.includes('clearTop40')&&t.includes('Wis Top 40'));
  ok('Top 40 clear scope is isolated',t.includes('localStorage.removeItem(KEY)')&&t.includes('localStorage.removeItem(SNAP)'));
}

for(const f of ['api/fact.js','api/discover.js','api/dj.js'])if(exists(f))ok(`${f} has external timeout`,read(f).includes('AbortController')&&read(f).includes('timedFetch'));

if(exists('index.html')){
  const html=read('index.html');
  const localScripts=[...html.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/.test(x));
  const missing=localScripts.filter(x=>!exists(x.replace(/^\.\//,'')));
  ok('all index scripts exist',missing.length===0,missing.join(', '));
}

if(exists('radio-suite.js')){
  const suite=read('radio-suite.js');
  const dynamic=[...suite.matchAll(/\['\.\/([^']+\.js)'\s*,/g)].map(m=>m[1]);
  const missing=dynamic.filter(x=>!exists(x));
  ok('all dynamic modules exist',missing.length===0,missing.join(', '));
}

if(exists('sw.js')){
  const sw=read('sw.js');
  ok('PWA caches primary controller',sw.includes("'./playback-primary.js'"));
  ok('PWA caches API budget',sw.includes("'./spotify-api-budget.js'"));
  ok('PWA caches DJ handoff',sw.includes("'./dj-handoff-v34.js'"));
  ok('PWA cache version >= v35',/josh-fm-v(?:3[5-9]|[4-9]\d|\d{3,})/.test(sw));
}

const temp=files.filter(f=>/(^|\/)(\.noop|\.placeholder|__noop__)$/.test(f));
ok('no temporary deploy files',temp.length===0,temp.join(', '));

for(const json of ['package.json','vercel.json','manifest.webmanifest'])if(exists(json)){try{JSON.parse(read(json));pass.push(`valid JSON ${json}`)}catch(e){fail.push(`valid JSON ${json} — ${e.message}`)}}

console.log(`Josh FM predeploy: ${pass.length} PASS, ${fail.length} FAIL`);
if(fail.length){for(const x of fail)console.error('FAIL:',x);process.exit(1)}
for(const x of pass.filter(x=>!x.startsWith('syntax ')))console.log('PASS:',x);
