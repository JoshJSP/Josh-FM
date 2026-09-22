# Van ChatGPT naar Claude, en de Live DJ terug — 22 september 2026

Branch `claude/ai-provider-and-dj-20260921`, acht commits, 33 bestanden.
`npm run predeploy` is groen na elke commit.

Dit bestand legt vast wat er is gewijzigd, wat daarvan **bewezen** is en wat nog
een echte telefoon met een echte Spotify-sessie nodig heeft. Die scheiding is de
belangrijkste inhoud van dit document: statische tests bewijzen geen geluid.

---

## 1. Alle AI-teksten gaan nu naar Claude, met Groq als vangnet

Er zaten twee soorten "OpenAI" in de code:

| Route | Was | Is |
|---|---|---|
| `api/discover.js` | ChatGPT rechtstreeks (`api.openai.com`, `gpt-5-mini`), **geen vangnet** | Claude → Groq |
| `api/category-filter.js` | idem | Claude → Groq |
| `api/dj-writer.js` | Groq met `openai/gpt-oss-120b/20b` | Claude → dezelfde Groq-keten |
| `api/news-bulletin.js` | idem | Claude → Groq → vast bulletin |

`api/_ai.js` is de gedeelde aanbiederlaag met een eigen deadline per aanroep.
Bewust geen SDK: de rest van `api/` praat ook met kale `fetch` tegen Groq, Fish
Audio, Spotify en MusicBrainz, en een extra dependency per Vercel-functie kost
meer dan de dertig regels die het nu zijn.

**Wat daarbij bijna misging.** Claude meldt een weigering als **HTTP 200** met
`stop_reason: "refusal"`. Zonder die controle lees je een lege `content`-array,
concludeer je dat het model niets te zeggen had, en val je nooit door naar Groq.
Die check zit erin en wordt getest.

**De DJ houdt zijn tijdsbudget.** Een break heeft elf seconden totaal. Claude
krijgt er maximaal vijf; Groq houdt zijn volle zes. Is Claude traag, dan neemt
Groq het over zonder dat de break sneuvelt.

**Zonder `ANTHROPIC_API_KEY` werkt alles precies zoals gisteren.** Groq doet dan
al het werk. De sleutel toevoegen is een verbetering, geen voorwaarde.

### Wat je moet doen om Claude aan te zetten

1. Haal een API-sleutel bij Anthropic (console.anthropic.com).
2. Zet hem in Vercel als `ANTHROPIC_API_KEY`. Ik heb geen productie-omgeving
   aangeraakt.
3. Optioneel `ANTHROPIC_TEXT_MODEL`. Standaard is `claude-opus-5`. Kies een
   model dat `output_config.effort` ondersteunt (Claude 4.6 en nieuwer); een
   ouder model geeft 400 en valt dus altijd door naar Groq.
4. **Houd `GROQ_API_KEY` ingevuld.** Dat is het vangnet.

### Controleer daarna of Claude echt wordt gebruikt

Dit is geen overbodige stap. Ik heb de Claude-aanroep uit documentatie
geschreven maar nooit verstuurd — er is hier geen Anthropic-sleutel. Klopt er
iets niet aan de vorm van het verzoek, dan geeft de API 400 en valt élke break
door naar Groq. De radio klinkt dan precies hetzelfde en je merkt niets.

Daarom laat de diagnostiek nu zien wie er onderweg is afgehaakt. Zet de Live DJ
aan, wacht één radiomoment af en kijk in Diagnostiek naar de writer-status:

- `provider: claude` → goed, Claude schrijft.
- `provider: groq` met een lege `upstream` → Claude is niet eens geprobeerd; de
  sleutel staat niet in de omgeving.
- `provider: groq` met `upstream: claude: …` → Claude is geprobeerd en
  geweigerd. De tekst erachter is de reden en zegt precies wat er moet worden
  bijgesteld.

### Eén bewuste afwijking van Anthropics eigen advies

Anthropic raadt aan om bij Opus 5 de server-side `fallbacks`-parameter mee te
sturen: weigert het model, dan draait dezelfde vraag automatisch op een ander
Anthropic-model. Die zit hier bewust niet in. MAIRFM heeft al een vangnet dat
beter past — Groq is gratis en sneller — en `stop_reason: "refusal"` stuurt de
break daar naartoe. Een tweede, betaalde Anthropic-poging ertussen zou alleen
geld en tijd kosten in een pad dat elf seconden heeft.

### Openstaand punt: kosten

Zolang Groq het werk deed was misbruik van `/api/dj-writer` hooguit vervelend.
Met een Anthropic-sleutel kost elke aanroep geld, en de vier AI-routes zijn
zonder authenticatie bereikbaar voor iedereen die de URL kent. De rate limit
staat in modulegeheugen per lambda-instance (auditpunt M-10), dus de effectieve
limiet is een veelvoud van de bedoelde twintig per minuut.

Dat is geen nieuw lek — het is een bestaand punt dat door de overstap duurder
wordt. Beslis dit vóórdat je de sleutel toevoegt.

---

## 2. De Live DJ

### Waarom hij uit stond

Niet omdat de code weg was. `MAIR_DJ_ENABLED` in `brand-config.js` staat sinds
1 september standaard op `false`, en alle DJ-code staat er nog en is groen in
alle tests. Er stonden twee echte bugs open:

- **H-3** — de DJ praat niet met het scherm uit, en een mislukte break is
  verloren.
- **H-4** — een break wordt afgebroken zodra de volgende track niet de
  verwachte is.

### H-4 is aangepakt

Bij het voorbereiden voorspelt de DJ welke track erna komt (`nextHintId`). Koos
Spotify iets anders — wat vaak gebeurt, met verzoeken en de rotatie-engine
ertussen — dan gooide `air()` de **hele** break weg. De DJ zweeg dan zonder dat
er iets kapot was.

Dat weggooien is maar voor een deel terecht. Een `FORWARD_ANNOUNCE` die het
verkeerde nummer aankondigt is erger dan stilte; een feit over het nummer dat
net speelde klopt nog gewoon. De bewaking geldt nu alleen als de tekst de
gewijzigde track ook echt raakt — het breaktype zegt wat de tekst hoort te doen,
en een tekstscan vangt het model dat alsnog een titel laat vallen.

**Eerlijk over de reikwijdte:** kleiner dan het lijkt. De brain kiest in de
praktijk meestal `TWO_SONG_LINK`, en de deterministische terugvaltekst noemt de
volgende track altijd. Die blijven dus terecht sneuvelen. De winst zit bij
station-ID's, tijdmeldingen, uurgrenzen en feiten over het vorige nummer.

Gemeten in de simulatie: na een gesneuvelde break staat de DJ na **één**
trackwissel weer klaar. Een gemiste break kost dus hooguit één nummer stilte.

### H-3 is niet aangepakt

De DJ met het scherm uit laten praten is een iOS-beperking waar vier
compensatielagen omheen staan, en het is niet te verifiëren zonder telefoon. Dat
een mislukte break definitief is, is een bewuste veiligheidskeuze: opnieuw
proberen midden in een overgang riskeert twee audio-eigenaren tegelijk. Beide
blijven staan.

### Hij staat aan

`MAIR_DJ_ENABLED` staat sinds 22 september standaard op **aan**, op verzoek van
Josh. De vlag volgt nu `djOverride !== '0'`: nooit ingesteld betekent aan, en een
toestel dat eerder `'1'` schreef blijft gewoon aan.

Uitzetten kan per toestel via **Instellingen → Geluid & DJ** of in Diagnostiek;
dat schrijft `'0'` en herlaadt MAIRFM.

Dit ging in tegen mijn advies, en dat blijft de eerlijke stand van zaken: niemand
heeft deze DJ met een echte Spotify-sessie gehoord. De code is groen in 27
gedragstests, maar dat is simulatie. De lijst hieronder is daarom geen
formaliteit — als één van die vijf punten niet klopt, zet hem dan uit en meld
wat je hoorde.

### Waar je op moet letten bij het luisteren

1. Praat hij op de overgang, niet middenin een nummer?
2. Hervat de muziek op het juiste nummer, zonder terugspoelen?
3. Kondigt hij nooit een nummer aan dat daarna niet speelt? (Dat is precies wat
   de H-4-fix moet garanderen.)
4. Klinkt de tekst uitgesproken — geen cijferreeksen, geen afkortingen?
5. Blijft de muziek doorspelen als de DJ faalt?

---

## 2b. Ducking — de DJ praat nu over de muziek heen

Auditpunt H-6 stap 2. Tot nu toe **stopte** de muziek als de DJ praatte: pauze,
stem, hervatten, en daarna de track terugspoelen naar nul. Nu zakt het volume
weg onder de stem en speelt het nummer door.

Wat je hoort verandert hierdoor merkbaar. Vroeger begon het nieuwe nummer
opnieuw na de break; nu spelen de eerste seconden zacht onder de DJ door, zoals
op echte radio. Dat is de opzet, maar het is wel het eerste dat je zult opmerken.

Drie dingen die de implementatie bewaakt:

- **Ducking is een fractie van jouw volume**, niet een vaste waarde. Staat MAIR
  al zacht, dan wordt de break niet ineens harder. De fractie is `DUCK_RATIO` in
  `playback-primary.js`, nu `.18`. Dat getal is een gok op basis van niets —
  klinkt het te zacht of te hard onder de stem, dan is dat de knop.
- **Het zakken gaat in zes stappen** over ruim een kwart seconde. Een harde
  sprong naar een vijfde klinkt onder een stem als een storing. De ramp draait
  alleen op de lokale speler; via de Web API zou hij zes HTTP-calls kosten in een
  pad dat een paar honderd milliseconden mag duren, dus daar is het één stap.
- **Het volume gaat altijd terug.** Ook als de stem faalt, ook als jij midden in
  een break een ander nummer kiest. Dat laatste was een echte bug in mijn eerste
  versie: bij pauzeren is niet-hervatten juist correct (jij koos een andere
  track), maar bij ducking is er niets gestopt om mee te vechten — alleen volume
  om te herstellen. Zonder die correctie bleef de muziek permanent op een vijfde
  staan. Een test bewaakt dat nu.

Kan de transportlaag niet ducken — geen speler en geen bekend apparaat — dan
valt de break terug op de oude pauzeroute, inclusief terugspoelen. Die route is
niet weggegooid.

**Wat dit opent:** de reden dat de DJ met het scherm uit zwijgt is dat pauzeren
de audio stopt, en een app die geen audio meer produceert kan door iOS worden
opgeschort — met de muziek permanent uit als gevolg. Ducking stopt de audio
nooit. Daarmee vervalt de belangrijkste reden achter die blokkade. Ik heb hem
niet weggehaald: dat is een aparte wijziging die je eerst met deze in je hand
wilt beoordelen.

De voice-check in Diagnostiek blijft bewust pauzeren. Daar wil je de stem juist
kaal horen.

---

## 3. Verder verbeterd

**Volumeregeling** (auditpunt H-6 stap 1). MAIR had er geen enkele; zachter
zetten kon alleen via de systeemknoppen of de Spotify-app. `playback-primary.js`
bezit hem nu: de lokale speler regelt dit apparaat, de Web API elk ander
apparaat, en de bewaarde stand wordt teruggezet zodra er een nieuw apparaat komt
(een nieuwe speler begint altijd op vol volume). Een mislukte volumezet stopt de
muziek nooit. De schuif staat in Instellingen, naast de twee bestaande schuiven —
dat is de plek waarvan ik zonder telefoon kan bewijzen dat hij zichtbaar is. Een
schuif direct bij de transportknoppen vraagt eerst een blik op een echt toestel.

**QR-bibliotheek meegeleverd** (M-7). Passenger Mode haalde `qrcodejs` van
`cdn.jsdelivr.net`: niet gecached, geen integriteitscontrole, en dus geen QR
zodra de dekking wegvalt — precies de situatie waarin je Passenger Mode gebruikt.
Staat nu in `vendor/` met herkomst en sha384, en in de PWA-cache. Gecontroleerd
op `eval`, `Function()`, netwerk-, cookie- en opslagtoegang: niets daarvan
aanwezig.

**Vier UI-pollers slapen met het scherm uit** (H-5). De terugnavigatie elke
600 ms, Passenger Mode en de reisplanner elke 1800 ms, de leerlaag elke 3000 ms —
samen ruim honderd wakeups per minuut voor een scherm dat niemand ziet. Ze
draaien eenmalig in bij terugkeer. De tik van 500 ms in `mair-sleep.js` is
bewust met rust gelaten: die móét doorlopen met het scherm uit.

**DJ-prompt.** De systeemprompt was geschreven voor een klein open-weight model
en verbood losse dingen — markdown, emoji, labels — zonder ooit de reden te
noemen: de tekst gaat rechtstreeks naar een stemmodel. Die reden staat er nu wel.
Het verbod op leveranciersnamen was een lijst die aantoonbaar aangroeit (ik moest
er zelf Claude en Anthropic aan toevoegen) en is nu het principe.
`MAIR_DJ_PROMPT_VERSION` staat op 1.1.0.

---

## 4. Nieuwe poorten in `npm run predeploy`

Alle vier zijn negatief getest: ze falen aantoonbaar als de eigenschap verdwijnt.

- `scripts/ai-degradation-check.mjs` (nieuw, 5 checks) — zonder sleutels, met
  beide aanbieders down, en met onbruikbare output moet elke AI-route antwoorden
  in plaats van hangen of 500 geven. Het uurjournaal houdt altijd zijn
  deterministische bulletin; de classifier blijft fail-closed.
- `profile-discovery-fixes-check` loopt nu ook de **DJ-aan-tak** van de bootgraaf
  af en eist dat elk bestand dat `loadDJ()` laadt in de PWA-cache staat. Zonder
  die poort breekt een vergeten bestand de DJ pas ná installatie, offline, zonder
  foutmelding.
- `mair-hardening-check` eist dat de vier UI-pollers naar `document.hidden`
  kijken én bij terugkeer indraaien.
- `api-failure-behavior` en `playback-package1` zijn uitgebreid met het
  Claude-pad, de weigering, de serverfout, Claude zonder Groq, en de vier
  volumegevallen.

De timeout-contractcheck volgt de code mee naar `api/_ai.js` in plaats van te
eisen dat elke route zijn eigen `fetch` bouwt.

---

## 5. Wacht op jouw beslissing

1. **Anthropic-sleutel** — zie sectie 1, inclusief het kostenpunt.
2. **DJ globaal aanzetten** — pas na een echte luistersessie.
3. **Veertien dode bestanden** (auditpunt M-3) — bevestigd: nul verwijzingen,
   niet in de cache, dus ze kosten tijdens gebruik niets. Verwijderen is
   destructief, dus dat wacht op jouw akkoord: `auth-ui-guard.js`,
   `bugfix-playback.js`, `dj-now-immediate-fix.js`, `mair-dj-retired.js`,
   `mair-mobile-hotfix-v1.js`, `mair-stations-config.js`,
   `release-hotfix-v224.js`, `stable-auth.js`, `start-sequence.js`,
   `mair-station-art-1.css` t/m `-4.css`, `api/icon.js`.
   `mair-dj-retired.js` is de opvallendste: als die ooit geladen wordt, zet hij
   de DJ die je net terugwilt permanent uit.
4. **Gastverzoeken zonder goedkeuring** (tweede helft M-7) — bewust niet
   gewijzigd. De sessiecode is zes tekens uit een alfabet van 32 en het
   hostgeheim komt uit `crypto.randomUUID()`, dus dit is geen lek maar een
   productkeuze: een verplichte goedkeuring betekent extra tikken tijdens het
   rijden.
5. **Twee promptvoorstellen die ik niet heb toegepast**, omdat ik ze hier niet
   kan meten en jouw voorwaarde was dat de DJ goed moet werken:
   - *"Je bent geen chatbot, assistent, commentator of technicus."* — een
     mitigatie uit het Groq-tijdperk. Op Claude kan een verbod tegen gedrag dat
     hij toch niet vertoont juist naar dat gedrag toe trekken. Test met en
     zonder.
   - *De clichélijst* — diezelfde afweging: door de clichés letterlijk te noemen
     zet je ze in de context.
   - Los daarvan: de JSON-instructies in `category-filter.js` en `discover.js`
     kunnen vervangen worden door structured outputs (`output_config.format`),
     wat de parse-en-repareer-laag overbodig maakt. Dat vraagt eerst uitzoekwerk
     naar de exacte schemavorm.

---

## 6. Wat een review van dit werk zelf opleverde

Ik heb de hele branch daarna nog eens kritisch laten nalopen. Dat leverde
bruikbare treffers op in mijn eigen werk — deze zijn opgelost:

- **De volumeregeling startte op stil.** `localStorage.getItem` geeft `null` als
  er niets staat, en `Number(null)` is `0`, niet `NaN`. Op elk toestel dat nog
  nooit volume had opgeslagen begon MAIR dus op nul, en het eerste apparaat
  kreeg dat actief opgelegd. Dat is precies de bug die een radio stil maakt
  zonder dat iemand begrijpt waarom. Er staat nu een test op die de oude versie
  aantoonbaar laat vallen.
- **De twee nieuwe kaarten in Instellingen waren onzichtbaar.** `mair-profile.js`
  dekt die hele tab af met `#tab-settings.mair-profile-tab>:not(#mairProfilePage)
  {display:none!important}` — precies de valkuil die in dat bestand al beschreven
  stond. Volume en de Live DJ-schakelaar staan nu in de profielpagina zelf, onder
  "Geluid & DJ".
- **Afgekapte Claude-tekst gold als succes.** Denken telt mee in `max_tokens`, dus
  een halve zin kwam er echt uit — en die zou letterlijk worden uitgesproken.
  `stop_reason: "max_tokens"` valt nu door naar Groq.
- **De classifier haalde zijn eigen terugval nooit.** De aanroeper breekt na 10
  seconden af terwijl Claude alleen al 12 kreeg, dus het zuiverheidsfilter stopte
  stilletjes met filteren. De hele keten past nu binnen 10 seconden.
- **Het uurjournaal kon voorbij de Vercel-limiet lopen** (9s Claude plus drie keer
  8,5s Groq), waardoor het deterministische bulletin aan het eind onbereikbaar
  werd. Claude staat nu op 6 seconden.
- **Anthropic ontbrak in de kwaliteitspoort** van de DJ. Toegevoegd. `claude`
  blijft er bewust uit: dat is ook een gewone voornaam.

Nog open, bewust niet meer aangeraakt op dit uur:

- De DJ-break heeft elf seconden. Claude neemt er nu vier, Groq houdt zeven. Dat
  is genoeg voor één Groq-model met een seconde marge, niet voor twee. Vóór deze
  branch kregen beide Groq-modellen een echte kans. Een uitgevallen eerste model
  kost nu dus de break.
- `mentionsTrack` is een gewone kleine-letters-substringtest. Een kromme
  apostrof, een "(Remastered 2011)"-achtervoegsel of een artiest van twee tekens
  (`U2`) glipt erdoor, en korte titels kunnen juist vals aanslaan.
- De `attempts`-lijst met upstream-foutteksten gaat mee in het antwoord van
  `/api/discover` en `/api/category-filter`, ook bij succes. Handig voor
  diagnose, maar het zijn onbeveiligde routes.
- De timeout-poort in `app-smoke-check` accepteert nu "importeert `_ai.js`" als
  bewijs. Dat is zwakker dan de oude eis en laat een toekomstige onbegrensde
  `fetch` erdoor.
- `/api/discover` heeft geen enkele aanroeper in de client. Het is levende dode
  code die nu ook onderhouden moet worden.

---

## 7. Wat ik níét heb geverifieerd

Geen enkele regel hiervan is op een iPhone, in een browser of tegen een echte
Spotify-sessie getest. Er is ook niet naar één seconde DJ-audio geluisterd. Wat
er staat is: `npm run predeploy` groen, 26/26 DJ-gedragstests, 17/17
playback-tests, 5/5 degradatietests — allemaal simulaties.

Er is ook niet gedeployed.
