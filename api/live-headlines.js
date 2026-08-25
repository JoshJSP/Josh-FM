const FEED='https://feeds.nos.nl/nosnieuwsalgemeen';
let CACHE={at:0,data:null};
const TTL=5*60*1000;
async function timedFetch(url,ms=6500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{headers:{'User-Agent':'MAIR/2.0 personal-radio'},signal:c.signal})}finally{clearTimeout(t)}}
function decode(s=''){return String(s).replace(/^<!\[CDATA\[|\]\]>$/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function tag(xml,name){const m=String(xml).match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decode(m?.[1]||'')}
function parse(xml=''){const items=[];for(const m of String(xml).matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)){const block=m[1],title=tag(block,'title'),link=tag(block,'link'),pubDate=tag(block,'pubDate');if(!title||!/^https?:\/\//i.test(link))continue;items.push({title,link,publishedAt:pubDate?new Date(pubDate).toISOString():null,source:'NOS'});if(items.length>=8)break}return items}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 if(CACHE.data&&Date.now()-CACHE.at<TTL)return res.status(200).json(CACHE.data);
 try{const r=await timedFetch(FEED);if(!r.ok)throw Error(`NOS RSS HTTP ${r.status}`);const headlines=parse(await r.text());if(!headlines.length)throw Error('NOS RSS bevat geen bruikbare headlines');const data={ok:true,source:'NOS',sourceLabel:'NOS Nieuws',feed:FEED,fetchedAt:new Date().toISOString(),headlines};CACHE={at:Date.now(),data};return res.status(200).json(data)}catch(e){if(CACHE.data)return res.status(200).json({...CACHE.data,stale:true,error:String(e?.message||e)});return res.status(502).json({ok:false,error:String(e?.message||e),source:'NOS'})}
}
