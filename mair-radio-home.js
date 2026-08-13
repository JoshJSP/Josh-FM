(()=>{
  const $=id=>document.getElementById(id);
  function findCard(id){return $(id)?.closest('article.card')||null}
  function radio(){return $('tab-radio')}
  function ensureHeading(){
    const r=radio();if(!r||document.querySelector('.mair-radio-heading'))return;
    const h=document.createElement('div');h.className='mair-radio-heading';
    h.innerHTML='<div><div class="mair-eyebrow"><span class="mair-live-dot"></span> MAIR FM · LIVE</div><h2>Jouw radio</h2><p>Persoonlijk samengesteld. Altijd in beweging.</p></div><div class="mair-radio-mode" id="mairRadioMode">MAIR</div>';
    r.insertBefore(h,r.firstChild);
  }
  function decorateNow(){
    const n=document.querySelector('#tab-radio .now');if(!n)return;
    n.classList.add('mair-now-v2');
    const live=n.querySelector('.live');if(live)live.classList.add('mair-live-strip');
    const title=$('title');if(title)title.classList.add('mair-track-title');
    const artist=$('artist');if(artist)artist.classList.add('mair-track-artist');
    const taste=n.querySelector('.taste');if(taste)taste.classList.add('mair-taste-v2');
    const start=$('start');if(start)start.classList.add('mair-start-v2');
  }
  function decorateDj(){
    const card=findCard('djText');if(!card)return;
    card.classList.add('mair-dj-card-v2');
    const kicker=card.querySelector('.kicker');if(kicker)kicker.textContent='MAIR DJ · LAATSTE BREAK';
    const h=card.querySelector('h3');if(h&&!/JOSH|MAYA|MAX|NOAH/i.test(h.textContent))h.textContent='Josh · MAIR DJ';
    const mic=card.querySelector('.mic');if(mic)mic.textContent='●';
    const r=radio();const now=document.querySelector('#tab-radio .now');if(r&&now&&card.previousElementSibling!==now)r.insertBefore(card,now.nextSibling);
  }
  function decorateActions(){
    const grid=$('djNow')?.closest('.grid2');if(!grid)return;
    grid.classList.add('mair-radio-actions-v2');
    const r=radio(),djCard=findCard('djText');if(r&&djCard&&grid.previousElementSibling!==djCard)r.insertBefore(grid,djCard.nextSibling);
    const djButton=$('djNow');if(djButton){djButton.querySelector('b')&&(djButton.querySelector('b').textContent='DJ nu');djButton.querySelector('span')&&(djButton.querySelector('span').textContent='Laat MAIR iets vertellen')}
    const quiet=$('skipTalk');if(quiet){quiet.querySelector('b')&&(quiet.querySelector('b').textContent='Even stil');quiet.querySelector('span')&&(quiet.querySelector('span').textContent='Volgende break overslaan')}
  }
  function hideLegacyRadioCards(){
    [findCard('directorQueue'),findCard('statHours'),findCard('modeLabel')].forEach(c=>c?.classList.add('mair-radio-legacy-hidden'));
  }
  function ensureUpNext(){
    const r=radio();if(!r||$('mair-up-next'))return;
    const card=document.createElement('article');card.id='mair-up-next';card.className='card mair-up-next-v2';
    card.innerHTML='<div class="mair-section-head"><div><div class="kicker">HIERNA</div><h3>Op MAIR</h3></div><span class="mair-queue-live">LIVE</span></div><div id="mair-up-next-list" class="mair-up-next-list"><div class="mair-up-empty">MAIR maakt je volgende tracks klaar zodra de radio draait.</div></div>';
    const actions=$('djNow')?.closest('.grid2'),djCard=findCard('djText');
    const anchor=actions||djCard||document.querySelector('#tab-radio .now');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else r.appendChild(card);
  }
  function readQueue(){
    const out=[];
    document.querySelectorAll('.jfm-nnl-item:not(.now)').forEach(x=>{const b=x.querySelector('b')?.textContent?.trim(),s=x.querySelector('small')?.textContent?.trim();if(b)out.push({title:b,artist:s||''})});
    if(out.length<3)document.querySelectorAll('#directorQueue .director-track').forEach(x=>{const b=x.querySelector('.director-meta b')?.textContent?.trim(),s=x.querySelector('.director-meta span')?.textContent?.trim();if(b&&!out.some(y=>y.title===b))out.push({title:b,artist:s||''})});
    if(!out.length){const n=$('nextUp')?.textContent?.trim();if(n&&n!=='—')out.push({title:n,artist:'Volgende op MAIR'})}
    return out.slice(0,3)
  }
  function renderUpNext(){
    const list=$('mair-up-next-list');if(!list)return;
    const items=readQueue();
    if(!items.length){list.innerHTML='<div class="mair-up-empty">MAIR maakt je volgende tracks klaar zodra de radio draait.</div>';return}
    list.innerHTML=items.map((x,i)=>`<div class="mair-up-row"><span class="mair-up-num">${String(i+1).padStart(2,'0')}</span><div><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.artist||'MAIR FM')}</span></div></div>`).join('');
  }
  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function syncMode(){const m=$('modeMini')?.textContent?.trim();const p=$('mairRadioMode');if(p&&m)p.textContent=m}
  function observe(){
    const sources=[$('directorQueue'),$('nextUp'),document.querySelector('#tab-radio .now')].filter(Boolean);
    const o=new MutationObserver(()=>{renderUpNext();syncMode()});sources.forEach(s=>o.observe(s,{childList:true,subtree:true,characterData:true}));
  }
  function install(){const r=radio();if(!r)return;r.classList.add('mair-radio-v2');ensureHeading();decorateNow();decorateDj();decorateActions();hideLegacyRadioCards();ensureUpNext();renderUpNext();syncMode();observe();window.MAIRRadioHome={version:'mair-radio-home-v2',refresh:renderUpNext,build:2}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();