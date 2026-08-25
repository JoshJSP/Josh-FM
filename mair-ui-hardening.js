(()=>{
'use strict';
if(window.__mairUIHardening)return;window.__mairUIHardening=true;
const stations=[
 ['hits','MAIR HITS','De grootste hits van nu'],['top40','MAIR TOP 40','De populairste tracks van dit moment'],['new','MAIR DISCOVERY','Nieuwe releases en nieuwe vondsten'],['nl','MAIR NEDERLANDSTALIG','Alleen echt Nederlandstalige nummers'],['party','MAIR PARTY','Energieke muziek voor een feestje'],['chill','MAIR CHILL','Rustig, warm en ontspannen'],['sleep','MAIR SLEEP','Zachte muziek om rustig bij in slaap te vallen'],['summer','MAIR SUMMER','Zonnige feelgood en zomertracks'],['throwback','MAIR THROWBACK','Bekende muziek van vóór 2017'],['00s','MAIR 00s','Hits uit 2000–2009'],['10s','MAIR 10s','Hits uit 2010–2019'],['mix','MY MAIR','Jouw persoonlijke mix']
];
const art=id=>`<span class="mair-station-art art-${id}" aria-hidden="true"><span class="mair-art-word">${id==='nl'?'NL':id.toUpperCase()}</span><span class="mair-art-wave">▥▦▥</span></span>`;
function sync(){
 document.querySelectorAll('.mair-personal-row>strong,.mair-station-card>strong').forEach(x=>x.remove());
 const grid=document.querySelector('.mair-station-grid');
 if(grid){
  const existing=new Map([...grid.querySelectorAll('[data-mair-station]')].map(x=>[x.dataset.mairStation,x]));
  for(const[id,name,tagline]of stations){
   let b=existing.get(id);
   if(!b){b=document.createElement('button');b.type='button';b.className='mair-station-card';b.dataset.mairStation=id;grid.appendChild(b)}
   const html=`${art(id)}<span class="mair-station-copy"><b>${name}</b><small>${tagline}</small></span>`;
   if(b.innerHTML!==html)b.innerHTML=html;
  }
  const order=new Map(stations.map((x,i)=>[x[0],i]));
  [...grid.children].sort((a,b)=>(order.get(a.dataset.mairStation)??99)-(order.get(b.dataset.mairStation)??99)).forEach((x,i)=>{if(grid.children[i]!==x)grid.appendChild(x)});
 }
 const select=document.getElementById('voiceMode');if(select){const o=select.querySelector('option[value="fish"]');if(o&&o.textContent!=='Automatisch per DJ')o.textContent='Automatisch per DJ'}
 const info=document.getElementById('voiceInfo');if(info&&info.textContent!=='MAIR kiest automatisch de juiste stem voor de actieve DJ.')info.textContent='MAIR kiest automatisch de juiste stem voor de actieve DJ.';
 const engine=document.getElementById('mairVoiceEngineCard');if(engine&&engine.style.display!=='none')engine.style.display='none';
 const active=localStorage.getItem('jfm_music_channel_v1')||'mix';document.querySelectorAll('[data-mair-station]').forEach(x=>{const on=x.dataset.mairStation===active;x.classList.toggle('active',on);x.setAttribute('aria-pressed',on?'true':'false')});
}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-mair-station]');if(!b)return;b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');sync()},4000)},true);
window.addEventListener('mair:channelchange',sync);
window.addEventListener('jfm:trackchange',sync);
window.addEventListener('mair:djchange',sync);
window.addEventListener('pageshow',()=>setTimeout(sync,100));
document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,0),{once:true});
setTimeout(sync,0);setTimeout(sync,400);setTimeout(sync,1500);
window.MAIRUIHardening={version:'mair-ui-hardening-v1.4-sleep-station',sync,stations:stations.map(x=>x[0])};
})();
