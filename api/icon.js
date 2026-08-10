import zlib from 'zlib';
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
export default function handler(req,res){
 const W=512,H=512,p=Buffer.alloc(W*H*4);const set=(x,y,r,g,b,a=255)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=a};
 const rect=(x,y,w,h,r,g,b)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)set(xx,yy,r,g,b)};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-256,y-256)/360;const glow=Math.max(0,1-d);set(x,y,4+Math.floor(8*glow),7+Math.floor(14*glow),14+Math.floor(34*glow))}
 // cobalt radio arcs
 for(let y=72;y<250;y++)for(let x=70;x<442;x++){const d=Math.hypot((x-256)/1.15,y-250);if(d>168&&d<180)set(x,y,50,107,255);if(d>137&&d<144)set(x,y,40,83,205)}
 // microphone / J shape
 for(let y=96;y<220;y++)for(let x=212;x<300;x++){const rx=(x-256)/44,ry=(y-153)/61;if(rx*rx+ry*ry<=1)set(x,y,247,249,255)}
 for(let y=122;y<187;y+=22){rect(212,y,23,7,18,28,52);rect(277,y,23,7,18,28,52)}
 rect(187,159,15,67,243,246,255);rect(310,159,15,67,243,246,255);rect(198,215,116,15,243,246,255);rect(248,226,16,49,243,246,255);rect(218,266,76,15,243,246,255);
 // JFM wordmark: J white, FM cobalt
 rect(109,315,32,94,247,249,255);rect(109,387,91,22,247,249,255);rect(169,349,31,60,247,249,255);
 rect(222,315,31,94,50,107,255);rect(222,315,94,22,50,107,255);rect(222,352,72,20,50,107,255);
 rect(329,315,29,94,50,107,255);rect(406,315,29,94,50,107,255);for(let i=0;i<48;i++){rect(358+i,315+i,3,3,50,107,255);rect(406-i,315+i,3,3,50,107,255)}
 // ON AIR live dot + bars
 for(let y=431;y<444;y++)for(let x=144;x<157;x++){if(Math.hypot(x-150,y-437)<6)set(x,y,50,107,255)}
 for(let i=0;i<8;i++){const h=8+((i*13)%23);rect(181+i*21,438-Math.floor(h/2),6,h,94,142,255)}
 const raw=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;p.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4)}
 const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store, max-age=0');res.status(200).send(png)
}
