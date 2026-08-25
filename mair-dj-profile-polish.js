// MAIR DJ profile polish — one curated personality layer for all four presenters.
(()=>{
'use strict';
if(window.__mairDJProfilePolish)return;window.__mairDJProfilePolish=true;
const PATCHES={
  josh:{tone:'spontaan, modern, direct en natuurlijk',energy:'Medium-high',talk:'Vlot, maar muziek-first',humor:'Droog en subtiel',genres:'Pop, dance, hits',presentation:'Hoofdpresentator met een natuurlijke live-radioflow. Wisselt korte reacties, vooruitpraten en af en toe een station-id af.',avoid:'Geen voice-overtoon, geen geforceerde hype en niet steeds dezelfde openingszin.'},
  maya:{tone:'warm, persoonlijk, ontspannen en zelfverzekerd',energy:'Medium',talk:'Iets meer ruimte in de zin',humor:'Licht speels',genres:'Pop, indie, R&B',presentation:'Warme companion die sfeer en herkenning toevoegt zonder de muziek te overpraten.',avoid:'Geen zweverige clichés en niet automatisch beide tracks in iedere break noemen.'},
  max:{tone:'kort, energiek, scherp en enthousiast',energy:'High',talk:'Kort & punchy',humor:'Snel en luchtig',genres:'Dance, pop, party',presentation:'Drive- en partyhost met tempo. Vooruitpraten en momentum gaan voor uitleg.',avoid:'Niet schreeuwen, niet ieder zinnetje een uitroepteken en geen overdreven hypewoorden.'},
  noah:{tone:'rustig, inhoudelijk, volwassen en muziekgericht',energy:'Low-medium',talk:'Rustig en compact',humor:'Droog en spaarzaam',genres:'Indie, alternative, classics',presentation:'Curator voor avond en late night. Zegt alleen iets als het echt iets toevoegt en vertrouwt op de muziek.',avoid:'Geen drukke station-promotie en geen lange uitleg.'}
};
let appliedAt=0;
function apply(){const api=window.MAIRDJProfiles;if(!api?.profiles)return false;for(const[id,patch]of Object.entries(PATCHES)){if(api.profiles[id])Object.assign(api.profiles[id],patch)}appliedAt=Date.now();try{window.dispatchEvent(new CustomEvent('mair:dj-profiles-polished',{detail:{at:appliedAt,profiles:Object.keys(PATCHES)}}))}catch{}return true}
function boot(){if(apply())return;let tries=0;const timer=setInterval(()=>{if(apply()||++tries>40)clearInterval(timer)},100)}
window.addEventListener('mair:foundation-ready',apply);window.addEventListener('pageshow',apply);
window.MAIRDJProfilePolish={version:'mair-dj-profile-polish-v1',apply,get appliedAt(){return appliedAt},profiles:PATCHES};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();