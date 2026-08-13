// Josh FM Product Beta Build 9 — central brand configuration. Visible defaults intentionally remain Josh FM.
(()=>{
  const DEFAULTS={
    productName:'Josh FM',
    stationName:'Josh FM',
    shortName:'Josh FM',
    tagline:'Persoonlijke AI-radio',
    djName:'Josh FM DJ',
    logo:'logo.svg',
    themeColor:'#08090b',
    language:'nl',
    supportName:'Josh FM'
  };
  const read=()=>{try{return JSON.parse(localStorage.getItem('jfm_brand_config_v1')||'{}')}catch{return{}}};
  const cfg={...DEFAULTS,...read()};
  const save=patch=>{Object.assign(cfg,patch||{});try{localStorage.setItem('jfm_brand_config_v1',JSON.stringify(cfg))}catch{};apply();return{...cfg}};
  function text(sel,value){document.querySelectorAll(sel).forEach(el=>{if(el.dataset.brandStatic==='1')return;el.textContent=value})}
  function apply(){
    document.title=cfg.productName;
    text('[data-brand="product"]',cfg.productName);
    text('[data-brand="station"]',cfg.stationName);
    text('[data-brand="tagline"]',cfg.tagline);
    text('[data-brand="dj"]',cfg.djName);
    document.querySelectorAll('[data-brand-logo]').forEach(img=>{img.src=cfg.logo;img.alt=`${cfg.productName} logo`});
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.setAttribute('content',cfg.themeColor);
    try{window.dispatchEvent(new CustomEvent('jfm:brand',{detail:{...cfg}}))}catch{}
  }
  window.JFMBrand={version:'brand-config-v1',defaults:{...DEFAULTS},get config(){return{...cfg}},apply,set:save,reset(){Object.assign(cfg,DEFAULTS);try{localStorage.removeItem('jfm_brand_config_v1')}catch{};apply();return{...cfg}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
