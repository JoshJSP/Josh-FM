// Edge-stem: Sec-MS-GEC v2 moet exact gelijk zijn aan edge-tts 7.3.1 (drm.generate_sec_ms_gec_v2).
// De verwachte waarden zijn met het Python-origineel berekend op 20-10-2026.
import assert from 'node:assert/strict';
import {edgeGecV2} from '../api/_edge-gec.js';
const T='6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const cases=[[1792496000,'BBCD29DB0B0C6FC7-8C1CFE6E11F14DE6C69160FB35067CA93BA93DD950A0389F160D5661765E4F79'],[1700000000.5,'2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2'],[1792496299,'BF6BF3AFB40B372B-5522EEA4719658EF44E4876C15CFF95D516EEFBA659D83AB55C76C1F6927C50D']];
for(const[t,want]of cases)assert.equal(edgeGecV2(T,t),want,`token voor ${t}`);
console.log(`edge-gec-check: PASS (${cases.length} tokens gelijk aan edge-tts 7.3.1)`);
