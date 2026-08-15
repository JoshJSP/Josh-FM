(()=>{
'use strict';
if(window.__mairSingleStationRuntime)return;window.__mairSingleStationRuntime=true;
const ACTIVE_KEY='mair_active_category_v2',SEARCH_KEY='mair_category_search_v1',SOURCE_KEY='mair_playback_source_v1';
const ALIASES={pop:'hits',dance:'party',rnb:'mix',hiphop:'mix',rock:'throwback',nl:'nl',indie:'new',feelgood:'hits',chill:'chill',energy:'party',focus:'chill',party:'party',morning:'hits',drive:'mix',evening:'chill',latenight:'chill','90s':'throwback','00s':'00s','10s':'10s','20s':'hits'};
function clearActive(){
  try{localStorage.removeItem(ACTIVE_KEY);localStorage.removeItem(SEARCH_KEY);const src=JSON.parse(localStorage.getItem(SOURCE_KEY)||'null');if(src?.kind==='category')localStorage.removeItem(SOURCE_KEY)}catch{}
  try{delete window.MAIRPlaybackContext;delete document.body.dataset.mairCategory;window.dispatchEvent(new CustomEvent('mair:playback-context',{detail:null}))}catch{}
  return true;
}
function removeDuplicateUi(){document.getElementById('mairCategorySearch')?.remove();document.querySelectorAll('[data-category]').forEach(x=>x.closest('.mair-category-result')?.remove())}
async function selectStation(id){clearActive();const api=window.MAIRStationController||window.JFMMusicChoice,fn=api?.select||api?.chooseChannel;if(typeof fn!=='function')return false;return !!(await fn.call(api,String(id||'mix')))}
async function select(id){return selectStation(ALIASES[String(id||'').toLowerCase()]||id||'mix')}
function install(){removeDuplicateUi();clearActive();window.MAIRCategorySearch={version:'mair-category-search-v3-station-only',categories:[],search:()=>[],select,selectStation,restore:async()=>false,maintain:async()=>false,clearActive,get active(){return null}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('pageshow',removeDuplicateUi);
})();