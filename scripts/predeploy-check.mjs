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

// Never scan this gate's own rule strings as runtime code.
const runtimeJs=js.filter(f=>f!=='scripts/predeploy-check.mjs');
const allJs=runtimeJs.map(f=>[f,read(f)]);
const spotifyPlayers=allJs.filter(([,s])=>s.includes('new Spotify.Player'));
ok('single Spotify.Player',spotifyPlayers.length===1,spotifyPlayers.map(([f])=>f).join(', ')||'none');
ok('legacy spotify-core removed',!exists('spotify-core.js'));
ok('duplicate web playback controller removed',!exists('playback-web-sdk.js'));
ok('primary playback controller exists',exists('playback-primary.js'));

if(exists('playback-primary.js')){
  const p=read('playback-primary.js');
  ok('primary controller marker',p.includes("JFMPlaybackPrimary='playback-primary'"));
  ok('primary owns transport DOM',p.includes("dataset.jfmOwner='primary'")&&p.includes("own('play'")&&p.includes("own('next'")&&p.includes("own('prev'"));
  ok('iOS gesture capture',p.includes('activateElement')&&p.includes("document.addEventListener('click'"));
  ok('transport verification',p.includes('verify(')&&p.includes('Spotify bevestigde'));
  ok('normal device transfer preserves state',p.includes('preserve&&!!s?.is_playing'));
  ok('station start silences transfer before jingle',p.includes('transfer(id,false)')&&p.indexOf('transfer(id,false)')<p.indexOf('Josh FM-jingle'));
}

if(exists('spotify-recovery.js')){
  const r=read('spotify-recovery.js');
  ok('recovery is delegated',r.includes('recovery-v6-delegated'));
  ok('recovery does not bind transport buttons',!r.includes('cloneNode')&&!r.includes("addEventListener('click'"));
  ok('recovery does not create player',!r.includes('new Spotify.Player'));
}

if(exists('personal-top40.js')){
  const t=read('personal-top40.js');
  ok('Top 40 canonical dedupe',t.includes('canonicalKey')&&t.includes('mergeEntries'));
  ok('Top 40 clear API',t.includes('clearTop40')&&t.includes('Wis Top 40'));
  ok('Top 40 clear scope is isolated',t.includes('localStorage.removeItem(KEY)')&&t.includes('localStorage.removeItem(SNAP)'));
}

if(exists('spotify-test-config.js')){
  const s=read('spotify-test-config.js');
  ok('primary loader wired',s.includes('playback-primary.js?v=33'));
  ok('old web SDK loader absent',!s.includes('playback-web-sdk.js'));
}

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
  ok('PWA cache version >= v33',/josh-fm-v(?:3[3-9]|[4-9]\d|\d{3,})/.test(sw));
}

const temp=files.filter(f=>/(^|\/)(\.noop|\.placeholder|__noop__)$/.test(f));
ok('no temporary deploy files',temp.length===0,temp.join(', '));

for(const json of ['package.json','vercel.json','manifest.webmanifest'])if(exists(json)){try{JSON.parse(read(json));pass.push(`valid JSON ${json}`)}catch(e){fail.push(`valid JSON ${json} — ${e.message}`)}}

console.log(`Josh FM predeploy: ${pass.length} PASS, ${fail.length} FAIL`);
if(fail.length){for(const x of fail)console.error('FAIL:',x);process.exit(1)}
for(const x of pass.filter(x=>!x.startsWith('syntax ')))console.log('PASS:',x);
