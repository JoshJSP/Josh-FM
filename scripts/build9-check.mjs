import fs from 'node:fs';
const a=fs.readFileSync('data-portability-v9.js','utf8'),v=fs.readFileSync('version.js','utf8');
new Function(a);
if(!a.includes('JFMDataPortability')||!a.includes('jfm_product_model_restore_backup_v9')||!v.includes('data-portability-v9.js'))process.exit(1);
console.log('PASS Build 9');
