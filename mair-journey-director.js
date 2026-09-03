// MAIR Journey Director — route context is an automatic programming layer, not a separate mode.
(()=>{
'use strict';
if(window.__mairJourneyDirector)return;
window.__mairJourneyDirector=true;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
let installed=false,lastKey='',lastReplanAt=0,replanTimer=null;

function journey(){
  const j=window.MAIRJourneyContext||{};
  return j&&j.active&&Number.isFinite(Number(j.remainingTravelTime))?j:null;
}
function phase(j=journey()){
  if(!j)return'off';
  const sec=Math.max(0,Number(j.remainingTravelTime)||0),p=clamp(Number(j.routeProgress)||0),stops=Math.max(0,Number(j.stopsRemaining)||0);
  if(stops===0&&sec<=5*60)return'arrival';
  if(stops===0&&sec<=10*60)return'final';
  if(p<.15)return'start';
  if(p<.58)return'cruise';
  if(p<.82)return'build';
  return stops>0?'cruise':'final';
}
function targetMomentum(j=journey()){
  const ph=phase(j);
  return({start:.54,cruise:.66,build:.78,final:.74,arrival:.86})[ph]??.66;
}
function category(t){try{return window.JFMRotation?.category?.(t)||''}catch{return''}}
function familiarity(t){try{return Number(window.JFMRotation?.familiarity?.(t))||.5}catch{return.5}}
function momentum(t){try{return Number(window.JFMRotation?.momentum?.(t))||.6}catch{return.6}}
function personalAffinity(t){
  const id=t?.id||'';let m={};
  try{m=window.jfmDirectorMemory?.()||{}}catch{}
  return Number(m.likes?.[id]||0)*1.8+Math.min(6,Number(m.plays?.[id]||0))*.35+Math.min(5,Number(m.completions?.[id]||0))*.25;
}
function journeyBonus(t,out=[],slotIndex=0,j=journey()){
  if(!j)return 0;
  const ph=phase(j),mom=momentum(t),fam=familiarity(t),cat=category(t),target=targetMomentum(j);
  let score=-Math.abs(mom-target)*18;
  if(ph==='start')score+=fam*2.5;
  if(ph==='cruise')score+=fam*1.5;
  if(ph==='build')score+=mom*4;
  if(ph==='final'){score+=fam*5+personalAffinity(t)*.8;if(cat==='Discovery')score-=4}
  if(ph==='arrival'){
    score+=fam*10+personalAffinity(t)*1.7+mom*5;
    if(['Power','Familiar','Forgotten','Request'].includes(cat))score+=4;
    if(cat==='Discovery')score-=10;
    // Make the first few upcoming positions increasingly dependable near arrival.
    score-=Math.max(0,slotIndex-2)*1.2;
  }
  if(Number(j.stopsRemaining)>0&&ph!=='start')score-=Math.abs(mom-.68)*4;
  return score;
}
function installPlanner(){
  const r=window.JFMRotation;
  if(installed||!r?.plan||!r?.score)return false;
  const basePlan=r.plan.bind(r),baseScore=r.score.bind(r);
  r.plan=function(list=[],context=[]){
    const j=journey();
    if(!j)return basePlan(list,context);
    let pool=basePlan(list,context).filter(Boolean),out=[],prefix=(context||[]).filter(Boolean).slice(-10);
    while(pool.length){
      let best=0,bestValue=-Infinity;
      for(let i=0;i<pool.length;i++){
        const candidate=pool[i],value=Number(baseScore(candidate,[...prefix,...out]))+journeyBonus(candidate,out,out.length,j);
        if(value>bestValue){bestValue=value;best=i}
      }
      out.push(pool.splice(best,1)[0]);
    }
    return out;
  };
  r.journeyScore=journeyBonus;
  r.journeyState=()=>{const j=journey();return j?{active:true,phase:phase(j),targetMomentum:targetMomentum(j),remainingTravelTime:Number(j.remainingTravelTime),routeProgress:Number(j.routeProgress)||0,stopsRemaining:Number(j.stopsRemaining)||0}:{active:false,phase:'off'}};
  installed=true;
  return true;
}
function bucket(j){
  if(!j?.active)return'off';
  const m=Math.max(0,Math.round(Number(j.remainingTravelTime||0)/60)),stops=Math.max(0,Number(j.stopsRemaining)||0),ph=phase(j);
  const time=m<=5?'0-5':m<=10?'6-10':m<=20?'11-20':m<=30?'21-30':m<=45?'31-45':m<=60?'46-60':'60+';
  return`${ph}|${time}|stops:${stops}`;
}
function scheduleReplan(j){
  installPlanner();
  const key=bucket(j),now=Date.now();
  if(key===lastKey)return;
  lastKey=key;
  clearTimeout(replanTimer);
  const wait=Math.max(250,8000-(now-lastReplanAt));
  replanTimer=setTimeout(async()=>{
    lastReplanAt=Date.now();
    try{await window.JFMProgramDirector?.replan?.('journey',true)}catch{}
  },wait);
}
function retireRoadtrip(){
  // De Modes-UI bestaat niet meer, dus de kaart verbergen en de ondertitel herschrijven
  // hoeft niet langer. Wat blijft is het vangnet: een roadtrip-sessie die nog in
  // localStorage stond wordt gestopt, en starten blijft geblokkeerd.
  const manager=window.MAIRModeManager;
  if(manager&&!manager.__roadtripRetired){
    const originalStart=manager.start?.bind(manager);
    if(originalStart)manager.start=async(mode,options,force)=>mode==='roadtrip'?{ok:false,retired:true,reason:'journey-director'}:originalStart(mode,options,force);
    manager.__roadtripRetired=true;
    try{if(manager.state?.().mode==='roadtrip')manager.stop?.('roadtrip-retired')}catch{}
  }
}
function boot(){
  installPlanner();retireRoadtrip();
  setInterval(()=>{installPlanner();retireRoadtrip()},1800);
  window.addEventListener('mair:journey-context',e=>scheduleReplan(e.detail||window.MAIRJourneyContext));
  window.addEventListener('mair:foundation-ready',()=>setTimeout(retireRoadtrip,100));
  const current=journey();if(current)scheduleReplan(current);
  window.MAIRJourneyDirector={version:'journey-director-v1',state:()=>{const j=journey();return j?{active:true,phase:phase(j),targetMomentum:targetMomentum(j),context:{...j}}:{active:false,phase:'off'}},replan:()=>window.JFMProgramDirector?.replan?.('journey-manual',true)};
  try{window.dispatchEvent(new CustomEvent('mair:journey-director-ready'))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();