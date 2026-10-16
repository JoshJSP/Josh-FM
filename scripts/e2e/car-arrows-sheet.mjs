// Contactblad van alle afslagpijlen en rijstrook-pijlen (visuele controle): node scripts/e2e/car-arrows-sheet.mjs <png>
import {launch,boot} from './harness.mjs';
const out=process.argv[2]||'pijlen.png';
const h=await launch({width:900,height:420});
try{
  await boot(h);
  await h.page.evaluate(()=>{
    const P=window.MAIRCarModePrototype,items=[['turn','left'],['turn','right'],['turn','slight left'],['turn','slight right'],['turn','sharp left'],['turn','sharp right'],['turn','straight'],['turn','uturn'],['off ramp','slight left'],['off ramp','right'],['fork','left'],['fork','slight right'],['roundabout','right'],['roundabout','left'],['roundabout',''],['merge','left'],['on ramp','right'],['end of road','left'],['arrive','']];
    document.body.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:14px;padding:14px;background:#0d0b13;color:#c18aff;font:12px sans-serif;width:900px">'+items.map(([t,m])=>`<div style="width:78px;text-align:center"><div style="width:64px;height:64px;margin:auto">${P.arrowSvg({maneuver:{type:t,modifier:m}})}</div><div style="color:#aaa;margin-top:4px">${t}<br>${m||'-'}</div></div>`).join('')+'</div>';
    document.querySelectorAll('.car-arrow').forEach(s=>{s.style.width='64px';s.style.height='64px';s.style.overflow='visible'});
  });
  await h.page.screenshot({path:out});console.log('ok',out);
}finally{await h.close()}
