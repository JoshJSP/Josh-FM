(()=>{
  'use strict';
  if(window.MAIRRadioSequencer?.version)return;
  const VERSION='mair-radio-sequencer-v1';
  const TARGETS=new Set(['hits','top40','new','nl']);
  const START_KEY='mair_station_recent_starts_v1';
  const HISTORY=8;
  const artist=t=>String(t?.artists?.[0]?.name||t?.artists?.[0]||'').toLowerCase().trim();
  const id=t=>String(t?.id||t?.uri||'');
  function dedupe(list){const seen=new Set();return(Array.isArray(list)?list:[]).filter(t=>{const k=id(t);if(!k||seen.has(k))return false;seen.add(k);return true})}
  function shuffle(list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function recentArtists(out,n=2){return new Set(out.slice(-n).map(artist).filter(Boolean))}
  function takeCompatible(bucket,out){if(!bucket.length)return null;const recent=recentArtists(out);let i=bucket.findIndex(t=>{const a=artist(t);return !a||!recent.has(a)});if(i<0)i=0;return bucket.splice(i,1)[0]||null}
  function tiered(list){const n=list.length,a=Math.max(3,Math.ceil(n*.30)),b=Math.max(a+1,Math.ceil(n*.65));return[shuffle(list.slice(0,a)),shuffle(list.slice(a,b)),shuffle(list.slice(b))]}
  function spread(list){const pool=shuffle(list),out=[];while(pool.length){const next=takeCompatible(pool,out);if(next)out.push(next)}return out}
  function sequence(station,list){
    const pool=dedupe(list);if(!TARGETS.has(station)||pool.length<4)return pool;
    if(station==='new')return spread(pool);
    const buckets=tiered(pool),pattern=[0,1,0,2,1,0,1,2],out=[];let step=0;
    while(buckets.some(b=>b.length)){
      const preferred=pattern[step++%pattern.length];
      const order=[preferred,0,1,2].filter((x,i,a)=>a.indexOf(x)===i&&buckets[x]?.length);
      let picked=null;
      for(const bi of order){const recent=recentArtists(out),idx=buckets[bi].findIndex(t=>{const a=artist(t);return !a||!recent.has(a)});if(idx>=0){picked=buckets[bi].splice(idx,1)[0];break}}
      if(!picked){const bi=order[0];picked=bi===undefined?null:buckets[bi].shift()}
      if(picked)out.push(picked)
    }
    return out;
  }
  function readStarts(){try{return JSON.parse(localStorage.getItem(START_KEY)||'{}')}catch{return{}}}
  function rememberStart(station,trackId){if(!station||!trackId)return;try{const all=readStarts(),arr=Array.isArray(all[station])?all[station]:[];all[station]=[trackId,...arr.filter(x=>x!==trackId)].slice(0,HISTORY);localStorage.setItem(START_KEY,JSON.stringify(all))}catch{}}
  function avoidRecentStart(station,list){
    const out=[...list];if(!TARGETS.has(station)||out.length<2)return out;
    const recent=new Set(Array.isArray(readStarts()?.[station])?readStarts()[station]:[]);
    if(!recent.has(id(out[0]))){rememberStart(station,id(out[0]));return out}
    let i=out.findIndex((t,index)=>index>0&&index<Math.min(12,out.length)&&!recent.has(id(t))&&artist(t)!==artist(out[0]));
    if(i<0)i=out.findIndex((t,index)=>index>0&&!recent.has(id(t)));
    if(i>0)[out[0],out[i]]=[out[i],out[0]];
    rememberStart(station,id(out[0]));return out;
  }
  function install(){
    const q=window.JFMQueue;if(q&&!q.__mairSequencerWrapped&&typeof q.commit==='function'){
      const original=q.commit.bind(q);q.commit=function(list,meta={}){const station=String(meta.station||localStorage.getItem('jfm_music_channel_v1')||'mix'),reason=String(meta.reason||'');let next=list;if(TARGETS.has(station)&&reason==='station-switch')next=avoidRecentStart(station,sequence(station,list));return original(next,meta)};q.__mairSequencerWrapped=true;
    }
    const c=window.MAIRStationController;if(c&&!c.__mairSequencerWrapped&&typeof c.buildPool==='function'){
      const original=c.buildPool.bind(c);c.buildPool=async function(station,...args){const result=await original(station,...args);if(!result?.tracks?.length||!TARGETS.has(String(station)))return result;return{...result,tracks:sequence(String(station),result.tracks)}};c.__mairSequencerWrapped=true;
    }
  }
  install();setTimeout(install,250);setTimeout(install,1200);window.addEventListener('mair:runtime-ready',install);window.addEventListener('pageshow',()=>setTimeout(install,100));
  window.MAIRRadioSequencer={version:VERSION,targets:[...TARGETS],sequence,avoidRecentStart,install};
})();
