// MAIR Imaging — lightweight sonic identity around selected DJ links.
(()=>{
'use strict';
if(window.MAIRImaging)return;
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));let ctx=null,lastAt=0,lastPhase='',plays=0,lastError='';
function enabled(){return !!$('jingles')?.checked}
function phase(){return window.JFMStationClock?.current?.()?.phase||document.body?.dataset?.clockPhase||'open'}
function audio(){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio niet beschikbaar');if(!ctx)ctx=new C();return ctx}
async function sonicLogo(force=false){if(!force&&!enabled())return false;if(document.visibilityState==='hidden')return false;try{const a=audio();if(a.state==='suspended')await a.resume();const start=a.currentTime+.015,master=a.createGain();master.gain.setValueAtTime(.0001,start);master.gain.exponentialRampToValueAtTime(.055,start+.06);master.gain.exponentialRampToValueAtTime(.0001,start+.5);master.connect(a.destination);[392,523.25,659.25].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain(),s=start+i*.075;o.type='sine';o.frequency.setValueAtTime(f,s);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.65,s+.04);g.gain.exponentialRampToValueAtTime(.0001,s+.31);o.connect(g);g.connect(master);o.start(s);o.stop(s+.34)});await wait(540);lastAt=Date.now();lastPhase=phase();plays++;lastError='';emit();return true}catch(e){lastError=String(e?.message||e);emit();return false}}
function shouldPlay(p=phase(),force=false){if(force)return true;if(!enabled())return false;if(!['top','q1','half','q3'].includes(p))return false;if(Date.now()-lastAt<7*60*1000&&p===lastPhase)return false;return true}
async function beforeBreak(meta={}){const p=String(meta.phase||phase());if(!shouldPlay(p,!!meta.force))return false;return sonicLogo(!!meta.force)}
function emit(){try{window.dispatchEvent(new CustomEvent('mair:imaging',{detail:status()}))}catch{}}
function status(){return{version:'mair-imaging-v1.1-diagnostics-only',enabled:enabled(),plays,lastAt,lastPhase,error:lastError}}
window.MAIRImaging={version:'mair-imaging-v1.1-diagnostics-only',beforeBreak,preview:()=>sonicLogo(true),shouldPlay,status};
})();
