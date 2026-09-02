// Josh FM Product Beta Build 5 — first-run onboarding and product UX.
(()=>{
  const $=id=>document.getElementById(id),KEY='jfm_onboarding_v1';
  const hasExistingUser=()=>{
    try{return !!(localStorage.getItem('jfm_client_id')||localStorage.getItem('jfm_streaming_ready_v2')||localStorage.getItem('jfm_taste_model_v4')||localStorage.getItem('jfm_settings'))}catch{return false}
  };
  const getState=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const save=x=>{try{localStorage.setItem(KEY,JSON.stringify({...getState(),...x,updatedAt:Date.now()}))}catch{}};
  function style(){if($('jfmOnboardingStyle'))return;const s=document.createElement('style');s.id='jfmOnboardingStyle';s.textContent=`
#jfmOnboarding{position:fixed;inset:0;z-index:9999;background:rgba(5,7,10,.88);backdrop-filter:blur(16px);display:grid;place-items:center;padding:20px}
#jfmOnboarding[hidden]{display:none}.jfmObCard{width:min(520px,100%);background:#11151b;border:1px solid #2a313b;border-radius:24px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
.jfmObTop{display:flex;justify-content:space-between;align-items:center;gap:16px}.jfmObKicker{font-size:11px;letter-spacing:.13em;color:#7f8b99;font-weight:800}.jfmObCard h2{margin:8px 0 8px;font-size:28px}.jfmObCard p{color:#aab3bf;line-height:1.55}.jfmObChoices{display:grid;gap:9px;margin:18px 0}.jfmObChoices button{border:1px solid #303844;background:#171c23;color:#eef2f7;padding:13px 14px;border-radius:14px;text-align:left;font-weight:750}.jfmObChoices button.active{border-color:#d8ff63;color:#d8ff63}.jfmObActions{display:flex;gap:9px;margin-top:18px}.jfmObActions button{flex:1}.jfmObDots{display:flex;gap:6px}.jfmObDots i{width:7px;height:7px;border-radius:99px;background:#3a414b}.jfmObDots i.on{background:#d8ff63}.jfmObClose{background:transparent;border:0;color:#9ca6b3;font-size:20px}.jfmObSummary{padding:12px 14px;border:1px solid #29313b;border-radius:14px;background:#0c1015;color:#cbd2dc;margin-top:14px}.jfmSettingsLaunch{margin-top:10px;width:100%}`;document.head.appendChild(s)}
  const steps=[
    {title:'Welkom bij Josh FM',text:'In een paar stappen stellen we je persoonlijke radioshow in. Je kunt alles later aanpassen.',render:()=>'<div class="jfmObSummary">Muziek + een AI-DJ + jouw eigen luisterprofiel, in één doorlopende radioshow.</div>'},
    {title:'Hoeveel wil je ontdekken?',text:'Kies hoeveel nieuwe muziek Josh FM tussen je vertrouwde tracks mag programmeren.',render:()=>choices('discovery',[['10','Vooral vertrouwd'],['30','Gebalanceerd'],['60','Veel ontdekken'],['90','Bijna alles nieuw']])},
    {title:'Hoe aanwezig is de DJ?',text:'De DJ praat nooit door de muziek heen. Kies alleen hoe vaak hij langskomt.',render:()=>choices('talk',[['0','Weinig'],['1','Normaal'],['2','Radio'],['3','Veel']])},
    {title:'Klaar om te luisteren',text:'Koppel Spotify en start daarna je eerste radioshow. Je voorkeuren worden op dit apparaat bewaard.',render:()=>'<div class="jfmObSummary">Je kunt onboarding later opnieuw openen via Instellingen.</div>'}
  ];
  let current=0,answers={discovery:'30',talk:'1'};
  function choices(key,items){return `<div class="jfmObChoices">${items.map(([v,l])=>`<button type="button" data-ob-key="${key}" data-ob-value="${v}" class="${answers[key]===v?'active':''}">${l}</button>`).join('')}</div>`}
  function applyAnswers(){const d=$('discovery'),t=$('talk');if(d){d.value=answers.discovery;d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('change',{bubbles:true}))}if(t){t.value=answers.talk;t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}))}save({answers})}
  function dots(){return steps.map((_,i)=>`<i class="${i===current?'on':''}"></i>`).join('')}
  function paint(){const host=$('jfmOnboardingBody');if(!host)return;const step=steps[current];host.innerHTML=`<div class="jfmObTop"><div><div class="jfmObKicker">SETUP ${current+1} / ${steps.length}</div><div class="jfmObDots">${dots()}</div></div><button class="jfmObClose" type="button" aria-label="Sluiten">×</button></div><h2>${step.title}</h2><p>${step.text}</p>${step.render()}<div class="jfmObActions">${current?'<button id="jfmObBack" class="secondary" type="button">Terug</button>':''}<button id="jfmObNext" class="cta" type="button">${current===steps.length-1?'Spotify koppelen / klaar':'Volgende'}</button></div>`;
    host.querySelector('.jfmObClose')?.addEventListener('click',()=>close(false));
    host.querySelector('#jfmObBack')?.addEventListener('click',()=>{current=Math.max(0,current-1);paint()});
    host.querySelectorAll('[data-ob-key]').forEach(b=>b.addEventListener('click',()=>{answers[b.dataset.obKey]=b.dataset.obValue;paint()}));
    host.querySelector('#jfmObNext')?.addEventListener('click',()=>{if(current<steps.length-1){current++;paint();return}finish()});
  }
  function ensure(){if($('jfmOnboarding'))return;style();const root=document.createElement('div');root.id='jfmOnboarding';root.hidden=true;root.innerHTML='<div class="jfmObCard" id="jfmOnboardingBody" role="dialog" aria-modal="true" aria-label="Josh FM instellen"></div>';document.body.appendChild(root);root.addEventListener('click',e=>{if(e.target===root)close(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)close(false)});installSettingsLauncher()}
  function open({reset=false}={}){ensure();const saved=getState();answers={...answers,...(saved.answers||{})};if(reset)current=0;$('jfmOnboarding').hidden=false;paint();save({opened:true})}
  function close(completed=false){const root=$('jfmOnboarding');if(root)root.hidden=true;save({completed:!!completed||!!getState().completed})}
  function finish(){applyAnswers();save({completed:true,completedAt:Date.now()});close(true);const connect=$('connect');if(connect&&!connect.disabled){try{connect.scrollIntoView({behavior:'smooth',block:'center'});connect.click()}catch{}}}
  function installSettingsLauncher(){
    // Deze kaart werd aangemaakt en meteen weer verwijderd door mair-easy-use-v1.js
    // (die #jfmProductSetupCard opruimt). Twee lagen die elkaar tegenwerken; hier stoppen.
    if(true)return;
    if($('jfmOnboardingLaunch'))return;const pane=$('tab-settings');if(!pane)return;const card=document.createElement('article');card.className='card';card.id='jfmProductSetupCard';card.innerHTML='<div class="kicker">PERSOONLIJKE SETUP</div><h3>Jouw radio-instellingen</h3><p class="muted">Pas muziekontdekking en DJ-aanwezigheid opnieuw aan via de korte setup.</p><button id="jfmOnboardingLaunch" class="secondary jfmSettingsLaunch" type="button">Setup opnieuw openen</button>';const version=pane.querySelector('.versionbox');pane.insertBefore(card,version||null);$('jfmOnboardingLaunch')?.addEventListener('click',()=>open({reset:true}))}
  function boot(){ensure();const state=getState();if(hasExistingUser()&&!state.opened){save({completed:true,migratedExistingUser:true});return}if(!state.completed)setTimeout(()=>open({reset:true}),700)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.JFMProductUX={version:'product-ux-v5',open,close,state:getState,applyAnswers};
})();
