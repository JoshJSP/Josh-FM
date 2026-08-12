// DJ compatibility shim. Playback handoff is owned only by dj-handoff-v34.js.
(()=>{
  window.JFMDJResume={version:'single-owner-v35-ios-audio',owner:'dj-handoff-v34.js'};
  function loadIOSBridge(){
    if(document.getElementById('jfm-ios-dj-audio'))return;
    const s=document.createElement('script');
    s.id='jfm-ios-dj-audio';
    s.src='./ios-dj-audio.js?v=35';
    s.async=false;
    s.onerror=()=>console.warn('Josh FM: iOS DJ audio bridge kon niet laden');
    document.body.appendChild(s);
  }
  if(document.readyState==='complete')setTimeout(loadIOSBridge,0);
  else window.addEventListener('load',()=>setTimeout(loadIOSBridge,0),{once:true});
})();
