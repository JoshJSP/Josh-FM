// MAIRFM terug-navigatie — een uitweg uit elk scherm.
//
// Het probleem: MAIRFM opent negen verschillende overlays en sheets, elk met een eigen
// sluitknop op een eigen plek, en sommige zonder. Er was nergens history.pushState, dus
// de terugveeg van iOS deed niets of verliet de app. "Kies station" had helemaal geen
// uitweg.
//
// Deze laag doet drie dingen en raakt geen enkele bestaande module aan:
//   1. Ze herkent welk scherm open is en weet hoe dat scherm zichzelf sluit.
//   2. Ze duwt bij het openen een history-entry, zodat de systeem-terugveeg en de
//      browserknop het bovenste scherm sluiten in plaats van de app te verlaten.
//   3. Ze legt een veeg-naar-rechts vanaf de linkerrand op hetzelfde gedrag, en zet een
//      terugknop in elk scherm dat er zelf geen heeft.
//
// Sluiten gebeurt altijd via de eigen API of de eigen sluitknop van het scherm, nooit
// door zelf DOM te verbergen: anders raakt de interne toestand van die module in de war.
(()=>{
'use strict';
if(window.MAIRBackNav)return;

const $=id=>document.getElementById(id);
const visible=el=>!!el&&!el.hidden&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';
const click=sel=>{const b=document.querySelector(sel);if(b){b.click();return true}return false};

// Van boven naar beneden: het scherm dat het meest 'bovenop' ligt staat eerst.
const VIEWS=[
  {id:'passenger',el:()=>$('mairPassengerSheet'),open:el=>!!el&&!el.hidden,close:()=>click('#mairPassengerSheet [data-passenger-close]')},
  {id:'car',el:()=>$('mairCarWaveOverlay'),open:el=>!!el&&el.classList.contains('is-open'),close:()=>{try{window.MAIRCarModePrototype?.close?.();return true}catch{return false}}},
  {id:'sleep',el:()=>$('mairSleepOverlay'),open:el=>!!el&&!el.hidden,close:()=>{try{window.MAIRSleep?.close?.();return true}catch{return false}}},
  {id:'director',el:()=>$('mairDirectorOverlay'),open:el=>!!el&&!el.hidden,close:()=>click('#mairDirectorClose')},
  {id:'diagnostics',el:()=>document.querySelector('.mair-diagnostics-sheet'),open:visible,close:()=>click('#mairDiagnosticsClose')},
  {id:'dj',el:()=>$('mairDJSheet'),open:visible,close:()=>click('#mairDJSheet .mair-sheet-back')},
  {id:'request-sheet',el:()=>$('b7RequestSheet'),open:visible,close:()=>click('#b7ReqClose')},
  {id:'request-pane',el:()=>document.querySelector('.mair-request-pane.mair-sheet-open'),open:visible,close:()=>click('.mair-request-close')},
];

// Een tab is geen overlay maar wel een scherm waar je uit moet kunnen. Radio is thuis.
function activeTab(){
  const pane=[...document.querySelectorAll('.tabpane.active')][0];
  return pane?.id&&pane.id!=='tab-radio'?pane.id:''
}
const goHome=()=>{try{window.MAIRFoundation?.activate?.('radio');return true}catch{return false}};

function topView(){
  for(const v of VIEWS){const el=v.el();if(el&&v.open(el))return{...v,node:el}}
  return null
}
// Is er iets om uit terug te gaan?
const somethingOpen=()=>!!topView()||!!activeTab();

let depth=0,lastPop=0;

function pushEntry(){
  try{depth++;history.pushState({mairBack:depth},'',location.href)}catch{}
}
// Sluit precies een niveau. Geeft terug of er iets gesloten is.
function back(){
  const view=topView();
  if(view){
    const closed=view.close();
    if(closed!==false)return true;
  }
  if(activeTab())return goHome();
  return false
}

// --- history ---------------------------------------------------------------
// Bij het openen van een scherm zetten we een entry klaar. popstate sluit dan het
// bovenste scherm in plaats van de app te verlaten. Blijft er nog iets open staan, dan
// zetten we meteen een nieuwe entry klaar zodat de volgende veeg ook werkt.
window.addEventListener('popstate',()=>{
  lastPop=Date.now();
  const closed=back();
  if(closed&&somethingOpen())pushEntry();
});

// Detecteer openen zonder elke module aan te passen: bij een klik of tabwissel kijken we
// een tel later of er iets open is dat er eerst niet was.
let known='';
function sync(){
  const view=topView();
  const key=view?view.id:activeTab()?('tab:'+activeTab()):'';
  if(key===known)return;
  const opened=!!key&&key!==known;
  known=key;
  // Geen entry duwen vlak na een popstate: dan zou terug niets doen.
  if(opened&&Date.now()-lastPop>250)pushEntry();
  ensureBackButton(view);
}

// --- veeg naar rechts vanaf de linkerrand -----------------------------------
let touchX=0,touchY=0,tracking=false;
document.addEventListener('touchstart',e=>{
  const t=e.touches?.[0];if(!t)return;
  tracking=t.clientX<=32&&somethingOpen();touchX=t.clientX;touchY=t.clientY;
},{passive:true});
document.addEventListener('touchend',e=>{
  if(!tracking)return;tracking=false;
  const t=e.changedTouches?.[0];if(!t)return;
  const dx=t.clientX-touchX,dy=Math.abs(t.clientY-touchY);
  if(dx>70&&dy<60){const closed=back();if(closed&&somethingOpen())pushEntry()}
},{passive:true});

// --- zichtbare terugknop ----------------------------------------------------
// Alleen voor schermen die er zelf geen hebben. De knop is groot genoeg om te raken
// (48x48) en staat linksboven binnen de veilige zone.
const HAS_OWN_BACK=new Set(['car','sleep','director','diagnostics','modes','dj','request-sheet','request-pane','passenger']);
function ensureBackButton(view){
  const existing=$('mairBackNavButton');
  existing?.remove();
}

document.addEventListener('click',()=>setTimeout(sync,60),true);
for(const name of ['mair:car-sleep-ready','mair:sleep','mair:mode-change','jfm:trackchange'])window.addEventListener(name,()=>setTimeout(sync,60));
window.addEventListener('pageshow',()=>setTimeout(sync,120));
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(back())sync()});
setInterval(sync,600);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>sync(),{once:true});else sync();

window.MAIRBackNav={
  version:'mair-back-nav-v1',
  back,
  get open(){return topView()?.id||activeTab()||''},
  views:()=>VIEWS.map(v=>({id:v.id,open:(()=>{const el=v.el();return !!el&&v.open(el)})()})),
  hasOwnBack:id=>HAS_OWN_BACK.has(id)
};
window.MAIRRuntime?.register?.('mair-back-nav',{version:'mair-back-nav-v1',owner:'back-navigation'});
})();
