// Offline check van de zinsblokken en gespreide pogingen in api/tts.js (edgeSpeak), met een nepstem.
import {splitSentences,edgeSpeak} from '../api/tts.js';
let bad=0;const ok=(n,c)=>{console.log(`${c?'PASS':'FAIL'} ${n}`);if(!c)bad++};
const long='De Tweede Kamer heeft vanmiddag gestemd over de nieuwe begroting en een meerderheid steunde het voorstel van de regering. In Utrecht viel het openbaar vervoer urenlang stil. Reizigers werd gevraagd later te reizen. '.repeat(3);
const parts=splitSentences(long);
ok('lange tekst wordt in meerdere blokken geknipt',parts.length>=3);
ok('geen blok langer dan 260 tekens',parts.every(p=>p.length<=260));
ok('niets kwijt: alle woorden komen terug in volgorde',parts.join(' ').replace(/\s+/g,' ')===long.trim().replace(/\s+/g,' '));
ok('één woord zonder spaties blijft heel of valt in stukken, nooit leeg',splitSentences('a'.repeat(600)).every(Boolean));
ok('korte tekst blijft één blok',splitSentences('Hallo daar.').length===1);
// Nepstem: blok "traag" hangt bij de eerste poging (3 s+), de tweede poging (na 3 s) slaagt meteen.
const calls={};const synth=async(profile,text)=>{calls[text]=(calls[text]||0)+1;if(text.startsWith('Traag')&&calls[text]===1)return{ok:false,status:504,detail:'Edge TTS timed out',ms:9000};return{ok:true,status:200,buf:Buffer.from(text),voice:'nep',ms:5}};
const t0=Date.now(),r=await edgeSpeak('josh','Traag blok. Tweede blok dat ook lang genoeg is om een eigen stuk te vormen, want het moet boven de grens komen van honderdzeventig tekens, en dat lukt met nog wat extra woorden erbij. Derde blok dat opnieuw vrij lang is zodat het apart wordt, met opnieuw wat woorden om de grens ruim te halen en het blok te vullen.',synth);
ok('mislukte eerste poging wordt door een volgende gered',r.ok&&Date.now()-t0<5000);
ok('audio staat in de goede volgorde',r.ok&&r.buf.toString().startsWith('Traag blok.'));
const dead=await edgeSpeak('josh','Altijd stuk.',async()=>({ok:false,status:502,detail:'weg',ms:1}));
ok('alle pogingen stuk: foutmelding teruggeven',!dead.ok&&dead.detail==='weg');
process.exit(bad?1:0);
