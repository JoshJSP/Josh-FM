// Josh FM DJ audio guard — fail fast on repeated Fish errors and keep music primary.
(()=>{
  const BASE_BACKOFF=30000,MAX_BACKOFF=5*60*1000;
  const history=[];
  let failures=0,nextRetryAt=0,lastError='',lastSuccessAt=0,lastAttemptAt=0;
  const trace=(stage,extra={})=>{history.unshift({at:Date.now(),stage,...extra});if(history.length>50)history.length=50;window.JFMDJAudioGuardLog=history};
  const available=()=>Date.now()>=nextRetryAt;
  const retryIn=()=>Math.max(0,nextRetryAt-Date.now());
  function success(stage='speech'){
    failures=0;nextRetryAt=0;lastError='';lastSuccessAt=Date.now();trace('success',{stage});
    try{window.dispatchEvent(new CustomEvent('jfm:dj-audio-health',{detail:{ok:true,stage}}))}catch{}
  }
  function failure(error,stage='speech'){
    failures++;lastError=String(error?.message||error||'Fish Audio failed').slice(0,300);
    const delay=Math.min(MAX_BACKOFF,BASE_BACKOFF*Math.pow(2,Math.max(0,failures-1)));
    nextRetryAt=Date.now()+delay;trace('failure',{stage,failures,retryInMs:delay,error:lastError});
    try{window.dispatchEvent(new CustomEvent('jfm:dj-audio-health',{detail:{ok:false,stage,error:lastError,retryInMs:delay}}))}catch{}
  }
  async function guarded(fn,stage,{respectBackoff=true}={}){
    if(respectBackoff&&!available()){trace('backoff-skip',{stage,retryInMs:retryIn()});return false}
    lastAttemptAt=Date.now();
    try{const ok=await fn();if(ok===false){failure('Fish Audio returned no playable speech',stage);return false}success(stage);return ok}catch(e){failure(e,stage);return false}
  }
  const oldPrepare=window.prepareSpeech;
  if(typeof oldPrepare==='function')window.prepareSpeech=async(...args)=>guarded(()=>oldPrepare(...args),'prepare',{respectBackoff:true});
  const oldSpeak=window.speakText;
  // Speaking may consume audio that was already prepared before a later jingle/health failure,
  // so allow one playback attempt even while new Fish generation is in backoff.
  if(typeof oldSpeak==='function')window.speakText=async(...args)=>guarded(()=>oldSpeak(...args),'speak',{respectBackoff:false});
  async function health(){
    if(!available())return{ok:false,backoff:true,retryInMs:retryIn(),error:lastError};
    try{lastAttemptAt=Date.now();const out=await window.JFMDJAudio?.health?.();success('health');return{ok:true,data:out}}catch(e){failure(e,'health');return{ok:false,error:lastError,retryInMs:retryIn()}}
  }
  window.JFMDJAudioGuard={
    version:'fish-guard-v2',available,retryIn,health,success,failure,log:()=>[...history],
    get state(){return{available:available(),failures,nextRetryAt,retryInMs:retryIn(),lastError,lastSuccessAt,lastAttemptAt}}
  };
})();
