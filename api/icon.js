import zlib from 'zlib';
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
export default function handler(req,res){
 const W=512,H=512,p=Buffer.alloc(W*H*4);const set=(x,y,r,g,b,a=255)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=a};
 const rect=(x,y,w,h,r,g,b)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)set(xx,yy,r,g,b)};
 const line=(x1,y1,x2,y2,w,r,g,b)=>{const dx=x2-x1,dy=y2-y1,n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=n;i++){const x=Math.round(x1+dx*i/n),y=Math.round(y1+dy*i/n);for(let yy=y-w;yy<=y+w;yy++)for(let xx=x-w;xx<=x+w;xx++)if((xx-x)**2+(yy-y)**2<=w*w)set(xx,yy,r,g,b)}};
 const arc=(cx,cy,rx,ry,a1,a2,w,r,g,b)=>{for(let a=a1;a<=a2;a+=0.5){const rad=a*Math.PI/180;const x=Math.round(cx+Math.cos(rad)*rx),y=Math.round(cy+Math.sin(rad)*ry);for(let yy=y-w;yy<=y+w;yy++)for(let xx=x-w;xx<=x+w;xx++)if((xx-x)**2+(yy-y)**2<=w*w)set(xx,yy,r,g,b)}};
 // deep navy background with subtle center glow
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-256,y-235)/360;const glow=Math.max(0,1-d);set(x,y,4+Math.round(glow*7),8+Math.round(glow*12),18+Math.round(glow*24))}
 // blue outline halo
 arc(256,240,226,226,195,345,3,39,92,220);arc(256,240,226,226,15,165,3,39,92,220);
 // broadcast waves
 arc(154,210,76,98,110,250,10,50,107,255);arc(154,210,45,64,115,245,8,50,107,255);
 arc(358,210,76,98,-70,70,10,50,107,255);arc(358,210,45,64,-65,65,8,50,107,255);
 // J shaped microphone head
 for(let y=72;y<182;y++)for(let x=218;x<294;x++){const rx=(x-256)/38,ry=(y-127)/55;if(rx*rx+ry*ry<=1)set(x,y,248,249,252)}
 // mic grille
 for(let y=105;y<=155;y+=18){rect(220,y,23,7,18,23,34);rect(269,y,23,7,18,23,34)}
 // J stem and hook
 rect(242,166,28,118,248,249,252);arc(220,280,50,45,5,150,14,248,249,252);
 // JFM wordmark under mic-J
 // J
 rect(136,330,24,76,50,107,255);rect(136,384,70,22,50,107,255);rect(182,348,24,58,50,107,255);
 // F
 rect(228,330,24,76,245,247,252);rect(228,330,68,22,245,247,252);rect(228,361,56,18,245,247,252);
 // M
 rect(318,330,22,76,245,247,252);rect(388,330,22,76,245,247,252);line(338,334,363,365,8,245,247,252);line(390,334,365,365,8,245,247,252);
 // ON AIR accent and small blue live dot
 for(let i=0;i<8;i++){const h=10+((i*13)%22);rect(180+i*20,444-h/2,7,h,50,107,255)}
 rect(219,452,74,4,50,107,255);
 // encode PNG
 const raw=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;p.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4)}
 const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store, max-age=0');res.status(200).send(png)
}
