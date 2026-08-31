// MAIR central brand configuration with non-destructive legacy migration.
(()=>{
  const DEFAULTS={productName:'MAIR',stationName:'MAIR',shortName:'MAIR',tagline:'Your music. Your radio.',djName:'MAIR DJ',logo:'mair-logo.svg',themeColor:'#ff6a00',language:'nl',supportName:'MAIR'};
  const read=()=>{try{const raw=JSON.parse(localStorage.getItem('jfm_brand_config_v1')||'{}');const legacy=!raw.productName||/^Josh\s*FM$/i.test(String(raw.productName));if(legacy)return{};if(/^MAIR\s*FM$/i.test(String(raw.stationName||'')))raw.stationName='MAIR';if(!raw.logo||/^logo\.svg$/i.test(String(raw.logo)))raw.logo='mair-logo.svg';return raw}catch{return{}}};
  const cfg={...DEFAULTS,...read()};
  const save=patch=>{Object.assign(cfg,patch||{});if(/^MAIR\s*FM$/i.test(String(cfg.stationName||'')))cfg.stationName='MAIR';if(!cfg.logo||/^logo\.svg$/i.test(String(cfg.logo)))cfg.logo='mair-logo.svg';try{localStorage.setItem('jfm_brand_config_v1',JSON.stringify(cfg))}catch{};apply();return{...cfg}};
  function text(sel,value){document.querySelectorAll(sel).forEach(el=>{if(el.dataset.brandStatic==='1')return;el.textContent=value})}
  function load(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;document.head.appendChild(s)}
  function apply(){document.title=cfg.productName;text('[data-brand="product"]',cfg.productName);text('[data-brand="station"]',cfg.stationName);text('[data-brand="tagline"]',cfg.tagline);text('[data-brand="dj"]',cfg.djName);document.querySelectorAll('[data-brand-logo]').forEach(img=>{img.src=cfg.logo;img.alt=`${cfg.productName} logo`});const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.setAttribute('content',cfg.themeColor);try{localStorage.setItem('jfm_brand_config_v1',JSON.stringify(cfg))}catch{}try{window.dispatchEvent(new CustomEvent('jfm:brand',{detail:{...cfg}}))}catch{}}
  function loadMairBuilds(){load('mair-tts-profile-bridge-js','./mair-tts-profile-bridge.js');load('mair-live-context-js','./mair-live-context.js');load('mair-voice-engine-js','./mair-voice-engine.js')}
  // MAIRFM feature flags. Eén plek, vroeg in de boot (brand-config.js is het derde
  // script in index.html), zodat elke latere loader hem kan lezen.
  //
  // MAIR_DJ_ENABLED staat standaard UIT. Uit betekent: mair-dj-v2.js (de enige
  // scheduler/orchestrator) wordt niet geladen, dus window.MAIRDJ bestaat niet.
  // Alle playback-hooks gebruiken optional chaining op window.MAIRDJ en worden
  // daardoor vanzelf no-ops - er is geen DJ die transport kan overnemen, geen
  // automatische break en geen praatmoment. Zet op true om de DJ terug te zetten.
  // Overschrijfbaar per toestel via localStorage 'mair_dj_enabled_v1' = '1'.
  const djOverride=(()=>{try{return localStorage.getItem('mair_dj_enabled_v1')}catch{return null}})();
  window.MAIR_DJ_ENABLED=djOverride==='1';
  window.MAIR_PUBLIC_DJ_ENABLED=window.MAIR_DJ_ENABLED;
  window.MAIRFlags={version:'mair-flags-v1',get djEnabled(){return !!window.MAIR_DJ_ENABLED},
    setDJEnabled(on){try{localStorage.setItem('mair_dj_enabled_v1',on?'1':'0')}catch{};return'Herlaad MAIRFM om de DJ-instelling toe te passen.'}};
  window.JFMBrand={version:'brand-config-v3-mair-clean',defaults:{...DEFAULTS},get config(){return{...cfg}},apply,set:save,reset(){Object.assign(cfg,DEFAULTS);try{localStorage.setItem('jfm_brand_config_v1',JSON.stringify(cfg))}catch{};apply();return{...cfg}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
