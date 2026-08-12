// Josh FM DJ Now v1 — immediate manual break with skip-safe fallback.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedForSkip=null,handling=false;
  async function current(){try{return await api('/me/player')}catch{return null}}
  async function runImmediate(){
    if(handling||window.JFMDJHandoff?.busy)return false;
    handling=true;
    try{
      const before=await current();
      const beforeId=before?.item?.id||'';
      if(!before?.is_playing||!beforeId){return false}
      armedForSkip={fromId:beforeId,at:Date.now()};
      const started=Promise.resolve(window.JFMDJHandoff?.runBreak?.(null,true));
      for(let i=0;i<8;i++){
        await wait(120);
        const live=await current();
        const nowId=live?.item?.id||'';
        if(nowId&&nowId!==beforeId){
          armedForSkip={fromId:beforeId,toId:nowId,at:Date.now()};
          break;
        }
      }
      const ok=await started;
      if(ok!==false){armedForSkip=null;return true}
      const live=await current();
      if(live?.item?.id&&live.item.id!==beforeId){
        await wait(120);
        const retry=await window.JFMDJHandoff?.runBreak?.(null,true);
        armedForSkip=null;
        return retry!==false
      }
      armedForSkip=null;
      return false
    }finally{handling=false}
  }
  function own(){
    const old=$('djNow');if(!old||old.dataset.jfmImmediateOwner==='1')return;
    const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmImmediateOwner='1';
    fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();runImmediate().catch(()=>{})},true)
  }
  const boot=()=>{own();setTimeout(own,300);setTimeout(own,1000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',boot);setInterval(own,4000);
  window.JFMDJNowImmediate={version:'v1-immediate-skip-safe',run:runImmediate,get armed(){return armedForSkip}};
})();
