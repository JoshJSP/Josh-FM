import fs from 'node:fs';
const a=fs.readFileSync('data-portability-v9.js','utf8'),v=fs.readFileSync('version.js','utf8');
new Function(a);
if(!a.includes('JFMDataPortability')||!a.includes('jfm_product_model_restore_backup_v9')||!v.includes('data-portability-v9.js'))process.exit(1);
console.log('PASS Build 9');
const html=fs.readFileSync('index.html','utf8'),b7=fs.readFileSync('build7.js','utf8'),ctx=fs.readFileSync('mair-live-context.js','utf8'),persona=fs.readFileSync('mair-dj-persona.js','utf8');
new Function(b7);new Function(ctx);new Function(persona);
const checks=[
 ['Build7 runtime loaded',html.includes('src="build7.js"')],
 ['MAIR visible brand',html.includes('<h1>MAIR</h1>')&&html.includes('Start MAIR')),
 ['DJ mix and four profiles',['mix','josh','maya','max','noah'].every(x=>b7.includes(x))],
 ['Rotation choices',b7.includes('Elke 30 minuten')&&b7.includes('Elk uur')&&b7.includes('Elke 2 uur')],
 ['Natural rotation engine',ctx.includes("window.addEventListener('jfm:trackchange'")&&ctx.includes('maybeRotate')],
 ['Request confirmation gate',b7.includes('mairConfirmed')&&b7.includes('b7ReqConfirm')],
 ['Live context toggle',b7.includes('b7Context')&&b7.includes('liveContext')],
 ['Dutch persona layer',persona.includes('Dit is MAIR FM')&&persona.includes('Josh')===false&&persona.includes('MAIRDJProfiles')],
 ['Legacy DOM compatibility',['sessionCount','history','nextUp','directorQueue','installHint','discoveryValue'].every(x=>b7.includes(x))]
];
let fail=0;for(const[n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} Build7 ${n}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Build 7 integration: ${checks.length} PASS / 0 FAIL`);
