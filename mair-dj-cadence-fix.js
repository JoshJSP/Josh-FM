// MAIR DJ cadence guard — keeps the existing Radio Brain in charge, but prevents
// endless score-based silence and exposes an honest approximate countdown.
(()=>{
'use strict';
if(window.MAIRDJCadenceFix?.version)return;
const $=id=>document.getElementById(id);
const level=()=>Math.max(0,Math.min(3,Number($('talk')?.value??1)||0));
const range=()=>[{min:5,max:7},{min:3,max:5},{min:2,max:4},{min:1,max:3}][level()]||{min:3,max:5};
let planTarget=0,lastBreakAt=0,lastLevel=-1,lastDetail=null;
function pickTarget(){const r=range();return r.min+Math.floor(Math.random()*(r.max-r.min+1))}
function memory(){try{return window.MAIRDJMemory?.snapshot?.()||{}}catch{return{}}}
function ensureTarget(){const m=memory(),lv=level(),breakAt=Number(m.lastBreakAt||0);if(!planTarget||breakAt!==lastBreakAt||lv!==lastLevel){planTarget=pickTarget();lastBreakAt=breakAt;lastLevel=lv}return planTarget}
function remaining(){const tracks=Math.max(0,Number(memory().tracksSinceLastBreak)||0);return Math.max(0,ensureTarget()-tracks)}
function patchBrain(){
  const brain=window.MAIRRadioBrain;if(!brain?.decide||brain.__mairCadencePatched)return false;
  const original=brain.decide.bind(brain);
  brain.decide=function(input={}){
    const target=ensureTarget(),m=input.memory||{},tracks=Math.max(0,Number(m.tracksSinceLastBreak)||0),minutes=Number(m.minutesSinceLastBreak);
    const lockBusy=!!window.MAIRAudioTransitionLock?.breakId;
    const result=original({...input,audioLockBusy:lockBusy});
    if(!input.manual&&result?.shouldTalk===false&&result.reason==='score-below-threshold'&&tracks>=target&&minutes>=5){
      const now=Date.now(),hour=new Date(now).getHours();
      return{...result,shouldTalk:true,breakType:'STATION_ID',maxDurationSeconds:5,targetWordCount:8,priority:6,permittedTopics:['music','station','local-time','session-context'],prohibitedTopics:['weather','news','sport','traffic','unverified-facts','technical-details'],mustMention:[],mayMention:[],reason:'cadence-due-safe-break',fallbackType:'STATION_ID',score:Math.max(Number(result.score)||0,Number(result.threshold)||0),cadenceTarget:target,hourKey:`${new Date(now).toISOString().slice(0,10)}-${hour}`}
    }
    return{...result,cadenceTarget:target}
  };
  brain.__mairCadencePatched=true;brain.__mairOriginalDecide=original;return true
}
function copy(detail=lastDetail||window.MAIRDJ?.diagnostics?.()||{}){
  const phase=String(detail.phase||'COUNTING').toUpperCase(),rem=remaining();
  if(phase==='SPEAKING')return{state:'ON_AIR',label:'DJ · On air',detail:'De MAIR DJ is live.'};
  if(phase==='HANDOFF'||phase==='RESTORING')return{state:'PREPARING',label:'DJ · On air voorbereiden',detail:'Muziek en DJ worden veilig overgedragen.'};
  if(phase==='ARMED')return{state:'PREPARING',label:'DJ · Zo op de radio',detail:'De break staat klaar voor de volgende natuurlijke overgang.'};
  if(phase==='PREPARING')return{state:'PREPARING',label:'DJ · Break wordt voorbereid',detail:'De DJ maakt het volgende radiomoment klaar.'};
  if(detail.skipNextBreak)return{state:'QUIET',label:'DJ · Even stil',detail:'Het volgende radiomoment wordt overgeslagen.'};
  if(rem<=0)return{state:'QUIET',label:'DJ · Radiomoment wordt bepaald',detail:'De DJ pakt de eerstvolgende geschikte natuurlijke overgang.'};
  if(rem===1)return{state:'QUIET',label:'DJ · Radiomoment komt dichtbij',detail:'Nog ongeveer 1 nummer tot een mogelijk DJ-moment.'};
  return{state:'QUIET',label:'DJ · Luistert mee',detail:`Nog ongeveer ${rem} nummers tot een mogelijk DJ-moment.`}
}
function render(detail=lastDetail){
  if(detail)lastDetail=detail;ensureTarget();const c=copy(detail),card=$('mairfmDjPublic'),label=$('mairfmDjLabel'),info=$('mairfmDjDetail');
  if(card)card.dataset.state=c.state;if(label&&label.textContent!==c.label)label.textContent=c.label;if(info&&info.textContent!==c.detail)info.textContent=c.detail
}
function boot(){patchBrain();ensureTarget();render();setTimeout(()=>{patchBrain();render()},350)}
window.addEventListener('mair:dj-v2-state',e=>setTimeout(()=>render(e.detail||null),0));
window.addEventListener('mair:ux-state',()=>setTimeout(()=>render(),0));
window.addEventListener('mair:track-transition',e=>{if(e.detail?.cause==='NATURAL_END')setTimeout(()=>render(),60)});
$('talk')?.addEventListener('change',()=>{planTarget=0;render()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRDJCadenceFix={version:'mair-dj-cadence-v1',patchBrain,render,remaining,get target(){return ensureTarget()},get state(){return{target:ensureTarget(),remaining:remaining(),memory:memory(),lastDetail}}};
window.MAIRRuntime?.register?.('mair-dj-cadence-fix',{version:'v1',owner:'dj-cadence-guard'});
})();
