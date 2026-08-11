// DJ playback ownership lives in dj-now-queue.js.
//
// This file intentionally does not wrap window.djBreak anymore. The old wrapper
// attempted a second Spotify resume after every automatic break, while
// dj-now-queue.js already pauses, rewinds and restarts the exact URI itself.
// Keeping one owner prevents double play requests, accidental skips and races on
// iOS/Spotify Connect. It also loads the Safari-safe Fish Audio playback bridge.
(()=>{
  window.JFMDJResume={version:'single-owner-v2-ios-audio',owner:'dj-now-queue.js'};
  function loadIOSBridge(){
    if(document.getElementById('jfm-ios-dj-audio'))return;
    const s=document.createElement('script');
    s.id='jfm-ios-dj-audio';
    s.src='./ios-dj-audio.js?v=1';
    s.async=false;
    s.onerror=()=>console.warn('Josh FM: iOS DJ audio bridge kon niet laden');
    document.body.appendChild(s);
  }
  if(document.readyState==='complete')setTimeout(loadIOSBridge,0);
  else window.addEventListener('load',()=>setTimeout(loadIOSBridge,0),{once:true});
})();
