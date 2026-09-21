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

### Hoe je hem aanzet

De schakelaar staat nu op twee plekken: **Instellingen → Live DJ** en in
Diagnostiek. Aanzetten schrijft `mair_dj_enabled_v1` en herlaadt MAIRFM.

De globale standaard blijft **uit**. Dat is opzet: de code is groen, maar niemand
heeft deze DJ met een echte Spotify-sessie gehoord, en de voorwaarde was dat hij
goed moet werken. Zet hem per toestel aan, luister een half uur, en zet dan pas
`window.MAIR_DJ_ENABLED` hard op `true` in `brand-config.js` als hij bevalt.

### Waar je op moet letten bij het luisteren

1. Praat hij op de overgang, niet middenin een nummer?
2. Hervat de muziek op het juiste nummer, zonder terugspoelen?
3. Kondigt hij nooit een nummer aan dat daarna niet speelt? (Dat is precies wat
   de H-4-fix moet garanderen.)
4. Klinkt de tekst uitgesproken — geen cijferreeksen, geen afkortingen?
5. Blijft de muziek doorspelen als de DJ faalt?

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

## 6. Wat ik níét heb geverifieerd

Geen enkele regel hiervan is op een iPhone, in een browser of tegen een echte
Spotify-sessie getest. Er is ook niet naar één seconde DJ-audio geluisterd. Wat
er staat is: `npm run predeploy` groen, 26/26 DJ-gedragstests, 17/17
playback-tests, 5/5 degradatietests — allemaal simulaties.

Er is ook niet gedeployed.
