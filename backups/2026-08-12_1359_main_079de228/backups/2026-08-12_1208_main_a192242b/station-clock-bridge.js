// Josh FM Station Clock bridge — makes legacy DJ/imaging consumers use the central clock.
(()=>{
  function install(){
    const clock=window.JFMStationClock,radio=window.JFMRadioClock;if(!clock)return false;
    if(radio){
      const old={...radio};
      window.JFMRadioClock={
        ...old,
        version:`${old.version||'radio-clock'}+station-clock-v1`,
        clockPhase:()=>clock.phase(),
        daypart:()=>clock.current().show.id,
        showName:()=>clock.current().show.name,
        station:()=>clock.current()
      };
    }
    const applyMode=()=>{
      try{
        if(localStorage.getItem('jfm_auto_program')==='0')return;
        const mode=clock.preferredMode();
        if(typeof setMode==='function'&&settings?.mode!==mode)setMode(mode)
      }catch{}
    };
    window.addEventListener('jfm:show-change',()=>{applyMode();try{window.jfmHourMarker=true}catch{}});
    window.addEventListener('jfm:clock-moment',e=>{
      try{if(e.detail?.phase==='top')window.jfmHourMarker=true}catch{}
    });
    applyMode();clock.render();
    window.JFMStationClockBridge={version:'clock-bridge-v1',applyMode};
    return true
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
})();
