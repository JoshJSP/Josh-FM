// DJ playback ownership lives in dj-now-queue.js.
//
// This file intentionally does not wrap window.djBreak anymore. The old wrapper
// attempted a second Spotify resume after every automatic break, while
// dj-now-queue.js already pauses, rewinds and restarts the exact URI itself.
// Keeping one owner prevents double play requests, accidental skips and races on
// iOS/Spotify Connect. The file remains as a compatibility no-op because older
// cached index.html versions may still request dj-resume.js.
(()=>{
  window.JFMDJResume={version:'single-owner-v1',owner:'dj-now-queue.js'};
})();
