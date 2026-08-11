// Josh FM Station Clock — one source of truth for shows, dayparts and scheduled imaging moments.
(()=>{
  const $=id=>document.getElementById(id),EVENT_KEY='jfm_station_clock_events_v1';
  const SHOWS=[
    {id:'after-hours',name:'Josh FM After Hours',start:0,end:6,mode:'late',tone:'low-key overnight radio'},
    {id:'morning',name:'Josh FM Morning',start:6,end:10,mode:'morning',tone:'bright morning radio'},
    {id:'daytime',name:'Josh FM Daytime',start:10,end:16,mode:'normal',tone:'music-first daytime radio'},
    {id:'drive',name:'Josh FM Drive',start:16,end:20,mode:'normal',tone:'upbeat drive-time radio'},
    {id:'evening',name:'Josh FM Evening',start:20,end:23,mode:'chill',tone:'evening radio'},
    {id:'late-night',name:'Josh FM Late Night',start:23,end:24,mode:'late',tone:'calm late-night radio'}
  ];
  const MOMENTS=[
    {minute:0,type:'top',label:'Top of hour'},
    {minute:15,type:'quarter',label:'Quarter-hour ID'},
    {minute:30,type:'half',label:'Half-hour show ID'},
    {minute:45,type:'quarter',label:'Quarter-hour ID'}
  ];
  let lastShow='',lastMomentKey='',lastTick=0;
  const log=[];
  const pad=n=>String(n).padStart(2,'0');
  function trace(stage,extra={}){log.unshift({at:Date.now(),stage,...extra});if(log.length>80)log.length=80}
  function showAt(date=new Date()){
    const h=date.getHours()+date.getMinutes()/60;
    return SHOWS.find(s=>h>=s.start&&h<s.end)||SHOWS[0]
  }
  function nextShow(date=new Date()){
    const cur=showAt(date),idx=SHOWS.findIndex(s=>s.id===cur.id);
    const next=SHOWS[(idx+1)%SHOWS.length];
    const d=new Date(date);d.setSeconds(0,0);
    if(next.start===0){d.setDate(d.getDate()+1);d.setHours(0,0,0,0)}else d.setHours(next.start,0,0,0);
    if(d<=date){d.setDate(d.getDate()+1);d.setHours(next.start,0,0,0)}
    return{show:next,at:d}
  }
  function phase(date=new Date()){
    const m=date.getMinutes();
    if(m<=2)return'top';
    if(m>=13&&m<=17)return'q1';
    if(m>=28&&m<=32)return'half';
    if(m>=43&&m<=47)return'q3';
    if((m>=6&&m<=11)||(m>=20&&m<=26)||(m>=35&&m<=41)||(m>=50&&m<=57))return'sweep';
    return'open'
  }
  function nextMoment(date=new Date()){
    const base=new Date(date);base.setSeconds(0,0);
    const candidates=[];
    for(const m of MOMENTS){const d=new Date(base);d.setMinutes(m,0,0);if(d<=date)d.setHours(d.getHours()+1);candidates.push({type:m.type,label:m.label,at:d})}
    const show=nextShow(date);candidates.push({type:'show-change',label:`${show.show.name} starts`,at:show.at,show:show.show});
    candidates.sort((a,b)=>a.at-b.at);return candidates[0]
  }
  function guide(date=new Date()){
    const cur=showAt(date),n=nextShow(date);
    return{current:cur,next:n.show,nextAt:n.at,shows:SHOWS.map(x=>({...x}))}
  }
  function formatTime(d){return`${pad(d.getHours())}:${pad(d.getMinutes())}`}
  function emit(type,detail={}){try{window.dispatchEvent(new CustomEvent(type,{detail}))}catch{}}
  function tick(){
    const d=new Date(),cur=showAt(d),ph=phase(d),key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${ph}`;
    if(cur.id!==lastShow){const previous=lastShow;lastShow=cur.id;trace('show-change',{from:previous,to:cur.id});emit('jfm:show-change',{show:cur,previous});window.jfmHourMarker=true}
    if(['top','q1','half','q3'].includes(ph)&&key!==lastMomentKey){lastMomentKey=key;trace('clock-moment',{phase:ph,show:cur.id});emit('jfm:clock-moment',{phase:ph,show:cur});if(ph==='top')window.jfmHourMarker=true}
    lastTick=Date.now();render()
  }
  function ensureGuide(){
    if($('jfmProgramGuide'))return;
    const radio=$('tab-radio');if(!radio)return;
    const cards=[...radio.querySelectorAll('.card')];const program=cards.find(c=>c.querySelector('#modeLabel'))||cards[cards.length-1];
    const card=document.createElement('article');card.className='card';card.id='jfmProgramGuide';
    card.innerHTML='<div class="row between"><div><div class="kicker">PROGRAMMAGIDS</div><h3 id="jfmGuideNow">Josh FM</h3></div><span id="jfmGuideTime" class="accent">LIVE</span></div><div id="jfmGuideNext" class="muted"></div><div id="jfmGuideMoment" class="muted" style="margin-top:8px"></div>';
    if(program?.nextSibling)radio.insertBefore(card,program.nextSibling);else radio.appendChild(card)
  }
  function render(){
    ensureGuide();const d=new Date(),cur=showAt(d),n=nextShow(d),m=nextMoment(d);
    if($('jfmGuideNow'))$('jfmGuideNow').textContent=cur.name;
    if($('jfmGuideTime'))$('jfmGuideTime').textContent=`${pad(cur.start)}:00–${pad(cur.end===24?0:cur.end)}:00`;
    if($('jfmGuideNext'))$('jfmGuideNext').textContent=`Hierna: ${n.show.name} om ${formatTime(n.at)}`;
    if($('jfmGuideMoment'))$('jfmGuideMoment').textContent=`Volgend radiomoment: ${m.label} · ${formatTime(m.at)}`;
    const mini=$('showMini');if(mini){mini.textContent=cur.name;mini.dataset.phase=phase(d);mini.title=`${cur.name} · ${phase(d)}`}
    document.body.dataset.show=cur.id;document.body.dataset.clockPhase=phase(d)
  }
  function preferredMode(date=new Date()){return showAt(date).mode}
  function current(){const d=new Date(),show=showAt(d),m=nextMoment(d);return{show,phase:phase(d),nextShow:nextShow(d),nextMoment:m,at:d}}
  window.JFMStationClock={version:'station-clock-v1',shows:SHOWS,current,showAt,nextShow,nextMoment,guide,phase,preferredMode,render,log:()=>[...log],get lastTick(){return lastTick}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureGuide();tick()});else{ensureGuide();tick()}
  setInterval(tick,15000);
})();
