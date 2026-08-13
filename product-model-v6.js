// Josh FM Product Beta Build 6 — versioned product model / migration bridge.
(()=>{
  if(window.JFMProductModel)return;
  const KEY='jfm_product_model_v6',SCHEMA=1,listeners=new Set();
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
  const str=(v,d='')=>String(v??d).trim();
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const id=(prefix='local')=>`${prefix}-${Math.random().toString(36).slice(2,10)}-${Date.now().toString(36)}`;
  function legacy(){
    const settings=read('jfm_settings',{}),taste=read('jfm_taste_model_v4',{}),onboarding=read('jfm_onboarding_v1',{});
    return{settings,taste,onboarding,channel:localStorage.getItem('jfm_music_channel_v1')||'mix'}
  }
  function blank(){const l=legacy();return{
    schema:SCHEMA,revision:1,createdAt:Date.now(),updatedAt:Date.now(),
    activeUserId:'user-local',activeStationId:'station-josh-fm',
    users:{'user-local':{id:'user-local',displayName:'Josh',createdAt:Date.now(),localOnly:true}},
    stations:{'station-josh-fm':{id:'station-josh-fm',ownerId:'user-local',name:'Josh FM',language:'nl',musicProfileId:'music-default',djProfileId:'dj-default',historyId:'history-default',createdAt:Date.now()}},
    musicProfiles:{'music-default':{id:'music-default',channel:str(l.channel,'mix'),discovery:num(l.settings.discovery,30),tasteModelKey:'jfm_taste_model_v4',learningVersion:str(window.JFMTasteModel?.version,'personal-learning-v4')}},
    djProfiles:{'dj-default':{id:'dj-default',host:'Josh FM DJ',voiceProvider:'fish',talkFrequency:num(l.settings.talk,1),facts:l.settings.facts!==false,timeMention:l.settings.timeMention!==false,weatherMention:!!l.settings.weatherMention,jingles:l.settings.jingles!==false}},
    histories:{'history-default':{id:'history-default',localOnly:true,tasteEvents:num(l.taste?.events?.length,0),lastSessionAt:0}},
    migrations:{legacyImportedAt:Date.now(),onboardingCompleted:!!l.onboarding?.completed}
  }}
  function normalize(raw={}){const base=blank(),x={...base,...raw};x.schema=SCHEMA;x.users={...base.users,...(raw.users||{})};x.stations={...base.stations,...(raw.stations||{})};x.musicProfiles={...base.musicProfiles,...(raw.musicProfiles||{})};x.djProfiles={...base.djProfiles,...(raw.djProfiles||{})};x.histories={...base.histories,...(raw.histories||{})};x.migrations={...base.migrations,...(raw.migrations||{})};return x}
  let model=normalize(read(KEY,{}));
  function snapshot(){return structuredClone?structuredClone(model):JSON.parse(JSON.stringify(model))}
  function persist(reason='update'){model.updatedAt=Date.now();model.revision=num(model.revision,0)+1;write(KEY,model);const s=snapshot();for(const fn of listeners)try{fn(s,reason)}catch{};try{window.dispatchEvent(new CustomEvent('jfm:product-model',{detail:{model:s,reason}}))}catch{};return s}
  function activeStation(){return model.stations?.[model.activeStationId]||null}
  function music(){const s=activeStation();return s?model.musicProfiles?.[s.musicProfileId]||null:null}
  function dj(){const s=activeStation();return s?model.djProfiles?.[s.djProfileId]||null:null}
  function history(){const s=activeStation();return s?model.histories?.[s.historyId]||null:null}
  function patchCollection(collection,key,values,reason){if(!model[collection]||!model[collection][key])return false;model[collection][key]={...model[collection][key],...values,updatedAt:Date.now()};persist(reason);return true}
  function patchStation(values){const s=activeStation();return s&&patchCollection('stations',s.id,values,'station-update')}
  function patchMusic(values){const x=music();return x&&patchCollection('musicProfiles',x.id,values,'music-profile-update')}
  function patchDJ(values){const x=dj();return x&&patchCollection('djProfiles',x.id,values,'dj-profile-update')}
  function syncLegacy(){const l=legacy(),m=music(),d=dj(),h=history();let changed=false;
    if(m){const next={channel:str(l.channel,m.channel),discovery:num(l.settings.discovery,m.discovery),learningVersion:str(window.JFMTasteModel?.version,m.learningVersion)};if(JSON.stringify(next)!==JSON.stringify({channel:m.channel,discovery:m.discovery,learningVersion:m.learningVersion})){model.musicProfiles[m.id]={...m,...next};changed=true}}
    if(d){const next={talkFrequency:num(l.settings.talk,d.talkFrequency),facts:l.settings.facts!==false,timeMention:l.settings.timeMention!==false,weatherMention:!!l.settings.weatherMention,jingles:l.settings.jingles!==false};for(const[k,v]of Object.entries(next))if(d[k]!==v){model.djProfiles[d.id]={...model.djProfiles[d.id],...next};changed=true;break}}
    if(h){const n=num(l.taste?.events?.length,0);if(h.tasteEvents!==n){model.histories[h.id]={...h,tasteEvents:n};changed=true}}
    if(changed)persist('legacy-sync');return changed
  }
  function createStation({name='Nieuw station',ownerId=model.activeUserId}={}){const stationId=id('station'),musicId=id('music'),djId=id('dj'),historyId=id('history');model.musicProfiles[musicId]={...music(),id:musicId};model.djProfiles[djId]={...dj(),id:djId};model.histories[historyId]={id:historyId,localOnly:true,tasteEvents:0,lastSessionAt:0};model.stations[stationId]={id:stationId,ownerId,name:str(name,'Nieuw station'),language:'nl',musicProfileId:musicId,djProfileId:djId,historyId,createdAt:Date.now()};model.activeStationId=stationId;persist('station-created');return stationId}
  function setActiveStation(stationId){if(!model.stations?.[stationId])return false;model.activeStationId=stationId;persist('station-active');return true}
  function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn)}
  function exportPortable(){const s=snapshot();return{schema:s.schema,activeUserId:s.activeUserId,activeStationId:s.activeStationId,users:s.users,stations:s.stations,musicProfiles:s.musicProfiles,djProfiles:s.djProfiles,histories:s.histories}}
  write(KEY,model);setTimeout(syncLegacy,1800);setInterval(syncLegacy,15000);window.addEventListener('jfm:trackchange',()=>{const h=history();if(h){h.lastSessionAt=Date.now();persist('history-session')}});
  window.JFMProductModel={version:'product-model-v6',schema:SCHEMA,get snapshot(){return snapshot()},get station(){return activeStation()},get musicProfile(){return music()},get djProfile(){return dj()},get history(){return history()},patchStation,patchMusic,patchDJ,createStation,setActiveStation,syncLegacy,subscribe,exportPortable};
})();
