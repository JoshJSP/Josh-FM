// Josh FM DJ Now compatibility + immediate manual break owner.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  let handling=false;
  if(!window.JFMDJTransition){
    window.JFMDJTransition={
      version:'legacy-disabled-v35',
      disabled:true,
      transition:opts=>window.JFMDJHandoff?.runBreak?.(opts?.track||null,!!opts?.manual)??Promise.resolve(false),
      get busy(){return !!window.JFMDJHandoff?.busy}
    };
  }
  async function current(){try{return await api('/me/player')}catch{return null}}
  async function immediate(){
    if(handling||window.JFMDJHandoff?.busy)return false;
    handling=true;
    try{
      const before=await current(),beforeId=before?.item?.id||'';
      if(!before?.is_playing||!beforeId)return false;
      const first=await window.JFMDJHandoff?.runBreak?.(null,true);
      if(first!==false)return true;
      const live=await current();
      if(live?.is_playing&&live?.item?.id&&live.item.id!==beforeId){
        await wait(120);
        return (await window.JFMDJHandoff?.runBreak?.(null,true))!==false;
      }
      return false;
    }finally{handling=false}
  }
  function own(){
    const old=$('djNow');
    if(!old||old.dataset.jfmImmediateOwner==='1')return;
    const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmImmediateOwner='1';
    fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();immediate().catch(()=>{})},true);
  }
  const boot=()=>{own();setTimeout(own,250);setTimeout(own,900)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',boot);setInterval(own,4000);
  window.JFMDJNowImmediate={version:'v1-immediate-skip-safe',run:immediate,get handling(){return handling}};
})();
