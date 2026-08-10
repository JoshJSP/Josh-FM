import zlib from 'zlib';
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
export default function handler(req,res){
 const W=512,H=512,p=Buffer.alloc(W*H*4);const set=(x,y,r,g,b,a=255)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=a};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-256,y-256)/360,v=Math.max(4,22-Math.floor(d*12));set(x,y,v,v+1,v+4)}
 const circle=(cx,cy,rad,w,r,g,b)=>{for(let y=cy-rad-w;y<=cy+rad+w;y++)for(let x=cx-rad-w;x<=cx+rad+w;x++){const d=Math.hypot(x-cx,y-cy);if(d>rad-w&&d<rad+w)set(x,y,r,g,b)}};
 circle(256,210,154,7,255,25,35);
 // microphone
 for(let y=92;y<205;y++)for(let x=214;x<298;x++){const rx=(x-256)/42,ry=(y-148)/56;if(rx*rx+ry*ry<=1)set(x,y,240,242,246)}
 for(let y=118;y<185;y+=22)for(let x=214;x<235;x++)set(x,y,25,27,31);
 for(let y=118;y<185;y+=22)for(let x=277;x<298;x++)set(x,y,25,27,31);
 for(let y=160;y<230;y++)for(let x=190;x<205;x++)set(x,y,235,237,241);
 for(let y=160;y<230;y++)for(let x=307;x<322;x++)set(x,y,235,237,241);
 for(let y=216;y<232;y++)for(let x=198;x<314;x++)set(x,y,235,237,241);
 for(let y=228;y<275;y++)for(let x=248;x<264;x++)set(x,y,235,237,241);
 for(let y=267;y<282;y++)for(let x=220;x<292;x++)set(x,y,235,237,241);
 // bold JFM mark
 const rect=(x,y,w,h,r,g,b)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)set(xx,yy,r,g,b)};
 rect(112,318,36,92,245,245,247);rect(112,388,92,22,245,245,247);rect(168,350,36,60,245,245,247);
 rect(226,318,36,92,255,35,45);rect(226,318,92,22,255,35,45);rect(226,354,72,20,255,35,45);
 rect(332,318,30,92,255,35,45);rect(406,318,30,92,255,35,45);for(let i=0;i<46;i++){rect(362+i,318+i,3,3,255,35,45);rect(405-i,318+i,3,3,255,35,45)}
 // waveform
 for(let i=0;i<9;i++){const h=12+((i*17)%34);rect(150+i*27,442-h/2,8,h,255,25,35)}
 const raw=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;p.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4)}
 const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store, max-age=0');res.status(200).send(png)
}
