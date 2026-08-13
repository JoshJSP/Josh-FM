import fs from 'node:fs';
const model=fs.readFileSync(new URL('../product-model-v6.js',import.meta.url),'utf8');
const version=fs.readFileSync(new URL('../version.js',import.meta.url),'utf8');
const checks=[
 ['valid syntax',(()=>{try{new Function(model);return true}catch{return false}})()],
 ['versioned schema exists',model.includes("KEY='jfm_product_model_v6'")&&model.includes('SCHEMA=1')],
 ['user station music dj history model exists',model.includes('users:')&&model.includes('stations:')&&model.includes('musicProfiles:')&&model.includes('djProfiles:')&&model.includes('histories:')],
 ['legacy migration bridge exists',model.includes("jfm_settings")&&model.includes('jfm_taste_model_v4')&&model.includes('jfm_music_channel_v1')&&model.includes('syncLegacy')],
 ['station/profile ids are separated',model.includes('musicProfileId')&&model.includes('djProfileId')&&model.includes('historyId')],
 ['multi-station API exists',model.includes('createStation')&&model.includes('setActiveStation')],
 ['portable export exists',model.includes('exportPortable')],
 ['observable model exists',model.includes('subscribe')&&model.includes('jfm:product-model')],
 ['safe clone fallback exists',model.includes("typeof structuredClone==='function'")],
 ['runtime loader exists',version.includes('product-model-v6.js')&&version.includes('loadProductModel')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}if(fail)process.exit(1);console.log(`Build 6 checks: ${checks.length} PASS / 0 FAIL`);
