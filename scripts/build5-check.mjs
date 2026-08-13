import fs from 'node:fs';
const ux=fs.readFileSync(new URL('../product-ux-v5.js',import.meta.url),'utf8');
const version=fs.readFileSync(new URL('../version.js',import.meta.url),'utf8');
const checks=[
 ['valid syntax',(()=>{try{new Function(ux);return true}catch{return false}})()],
 ['first-run state exists',ux.includes('jfm_onboarding_v1')&&ux.includes('completedAt')],
 ['existing users are migrated silently',ux.includes('migratedExistingUser')&&ux.includes('hasExistingUser')],
 ['music discovery setup is wired',ux.includes('data-ob-key')&&ux.includes("$('discovery')")],
 ['DJ frequency setup is wired',ux.includes("$('talk')")&&ux.includes("answers={discovery:'30',talk:'1'}")],
 ['Spotify connect handoff exists',ux.includes("const connect=$('connect')")&&ux.includes('connect.click()')],
 ['settings can reopen setup',ux.includes('jfmOnboardingLaunch')&&ux.includes('Setup opnieuw openen')],
 ['keyboard/overlay dismissal exists',ux.includes("e.key==='Escape'")&&ux.includes('e.target===root')],
 ['runtime loader exists',version.includes('product-ux-v5.js')&&version.includes('loadProductUX')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Build 5 checks: ${checks.length} PASS / 0 FAIL`);
