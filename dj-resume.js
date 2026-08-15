// MAIR DJ compatibility guard.
// app.js still contains the historic DJ scheduler, but it is not allowed to own automatic DJ breaks.
// The real single-owner scheduler is installed later by mair-dj-v2.js (DJ v3 runtime).
(()=>{
  window.__mairLegacyDJSchedulerDisabled=true;
  window.djBreak=(track=null,manual=false)=>{
    const dj=window.MAIRDJ;
    if(manual&&dj?.version?.startsWith('v3')&&typeof dj.armManual==='function')return Promise.resolve(dj.armManual());
    return Promise.resolve(false);
  };
  window.JFMDJResume={version:'legacy-scheduler-disabled-v3',owner:'mair-dj-v2.js',duplicateIOSBridge:false,legacyAutomaticBreaks:false};
})();
