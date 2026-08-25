import fs from 'node:fs';
const a=fs.readFileSync('data-portability-v9.js','utf8'),v=fs.readFileSync('version.js','utf8');
new Function(a);
if(!a.includes('JFMDataPortability')||!a.includes('jfm_product_model_restore_backup_v9')||!v.includes('data-portability-v9.js'))process.exit(1);
console.log('PASS Build 9');
const html=fs.readFileSync('index.html','utf8'),b7=fs.readFileSync('build7.js','utf8'),ctx=fs.readFileSync('mair-live-context.js','utf8'),persona=fs.readFileSync('mair-dj-persona.js','utf8'),foundation=fs.readFileSync('mair-foundation.js','utf8');
new Function(b7);new Function(ctx);new Function(persona);new Function(foundation);
const checks=[
 ['Build7 runtime loaded',html.includes('src="build7.js"')],
 ['MAIR visible brand',html.includes('<h1>MAIR</h1>')&&html.includes('Start MAIR')],
 ['DJ profiles owned by MAIR foundation',['josh','maya','max','noah'].every(x=>foundation.includes(`${x}:{id:'${x}'`))&&foundation.includes('window.MAIRDJProfiles')],
 ['Runtime show preference',b7.includes('rotation:60')&&b7.includes('setRotationMinutes')&&b7.includes("setMode?.('show')")&&ctx.includes("mode==='show'")&&ctx.includes('showDJ')],
 ['Natural rotation engine',ctx.includes("window.addEventListener('jfm:trackchange'")&&ctx.includes('maybeRotate')],
 ['Request confirmation gate',b7.includes('mairConfirmed')&&b7.includes('b7ReqConfirm')],
 ['Live context runtime preference',b7.includes('liveContext:true')&&b7.includes("$('weatherMention')")&&b7.includes("$('timeMention')")&&b7.includes('window.MAIRRuntimePrefs')],
 ['Dutch persona layer',persona.includes('Dit is MAIR FM')&&!persona.includes('Josh FM')&&persona.includes('MAIRDJProfiles')],
 ['Legacy DOM compatibility',['sessionCount','history','nextUp','directorQueue','installHint','discoveryValue'].every(x=>b7.includes(x))]
];
let fail=0;for(const[n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} Build7 ${n}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Build 7 integration: ${checks.length} PASS / 0 FAIL`);
