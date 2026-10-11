// MAIR "Deel je week": tekent je weekoverzicht als plaatje en deelt of downloadt het.
// Alles gebeurt lokaal op een canvas; er gaat niets naar een server.
(()=>{
'use strict';
if(window.MAIRShareWeek)return;
const W=1080,H=1350,ORANGE='#ff6a00',FONT='Poppins,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
function fit(ctx,text,maxW){text=String(text||'');if(ctx.measureText(text).width<=maxW)return text;while(text.length>1&&ctx.measureText(text+'…').width>maxW)text=text.slice(0,-1);return text.trimEnd()+'…'}
function render(data={}){
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#2a1206');bg.addColorStop(.45,'#0b0b0d');bg.addColorStop(1,'#050505');x.fillStyle=bg;x.fillRect(0,0,W,H);
  const glow=x.createRadialGradient(W*.8,160,10,W*.8,160,520);glow.addColorStop(0,'rgba(255,106,0,.35)');glow.addColorStop(1,'rgba(255,106,0,0)');x.fillStyle=glow;x.fillRect(0,0,W,H);
  x.textBaseline='alphabetic';x.fillStyle=ORANGE;x.font=`900 64px ${FONT}`;x.fillText('MAIR',80,150);
  x.fillStyle='#fff';x.font=`800 84px ${FONT}`;x.fillText('Mijn week',80,270);
  x.fillStyle='#b9b2ac';x.font=`500 40px ${FONT}`;x.fillText(fit(x,data.title||'Je week op MAIR',W-160),80,334);
  const items=[['TOP ARTIEST',data.topArtist||'Nog in opbouw',true],['MIJN NUMMER',data.topTrack||'Nog in opbouw',true],['NUMMERS',String(data.tracks??0),false],['ONTDEKKINGEN',String(data.discoveries??0),false]];
  let y=420;
  for(const [label,value,wide] of items.slice(0,2)){
    x.fillStyle='rgba(255,255,255,.06)';x.beginPath();x.roundRect(80,y,W-160,180,32);x.fill();
    x.fillStyle=ORANGE;x.font=`800 30px ${FONT}`;x.fillText(label,120,y+62);
    x.fillStyle='#fff';x.font=`800 58px ${FONT}`;x.fillText(fit(x,value,W-240),120,y+138);y+=208}
  const half=(W-160-24)/2;
  items.slice(2).forEach(([label,value],i)=>{const bx=80+i*(half+24);
    x.fillStyle='rgba(255,255,255,.06)';x.beginPath();x.roundRect(bx,y,half,210,32);x.fill();
    x.fillStyle=ORANGE;x.font=`800 30px ${FONT}`;x.fillText(label,bx+40,y+62);
    x.fillStyle='#fff';x.font=`900 100px ${FONT}`;x.fillText(fit(x,value,half-80),bx+40,y+166)});
  if(data.insight){x.fillStyle='#d8d2cc';x.font=`500 38px ${FONT}`;const words=String(data.insight).split(/\s+/);let line='',ly=y+300,n=0;for(const w of words){const t=line?line+' '+w:w;if(x.measureText(t).width>W-160&&line){x.fillText(line,80,ly);ly+=54;line=w;if(++n>=3)break}else line=t}if(n<3&&line)x.fillText(line,80,ly)}
  x.fillStyle='#7b7570';x.font=`600 32px ${FONT}`;x.fillText('MAIRFM · mijn eigen radio',80,H-56);
  return new Promise((ok,fail)=>c.toBlob(b=>b?ok(b):fail(new Error('Plaatje maken mislukt')),'image/png'))
}
async function share(data){
  const blob=await render(data),file=new File([blob],'mair-mijn-week.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Mijn week op MAIR'});return 'shared'}catch(e){if(e?.name==='AbortError')return 'cancelled'}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return 'downloaded'
}
window.MAIRShareWeek={version:'mair-share-week-v1',render,share};
})();
