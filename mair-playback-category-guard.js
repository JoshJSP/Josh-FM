// MAIR playback compatibility shim — station controller owns station quality and playback.
(()=>{
'use strict';
if(window.__mairPlaybackCategoryGuard)return;window.__mairPlaybackCategoryGuard=true;
window.MAIRPlaybackCategoryGuard={version:'mair-playback-category-guard-v2-pass-through',installed:false,mode:'pass-through'};
})();
