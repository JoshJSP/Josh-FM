# MAIRFM testrapport 23-09-2026

- **Branch:** `claude/achtergrondgedrag-20260922` — niets naar `main`, niet gedeployed.
- **Release-gate:** `npm run predeploy` groen, `EXIT=0`, 518 PASS / 0 FAIL.
- **Budget:** **elf** betaalde DJ/TTS-aanroepen, één meer dan de tien die ik zelf had
  afgesproken. De oorzaak is een fout in mijn eigen testharnas: de budgetgrens las
  `window.__soakBudget || 3`, en in JavaScript is `0 || 3` gelijk aan `3` — de grens van
  nul stond dus nooit op nul. Zodra ik dat zag heb ik `dj-writer` en `tts` in de browser
  hard dichtgezet en aangetoond dat er niets meer de deur uit gaat: beide antwoorden nu
  lokaal met 429 en de netwerkteller van de pagina blijft staan. Verder deze nacht: nul.

---

## In het kort

De Live DJ die je twee commits geleden standaard aanzette, kón niet op de lucht komen. De
detectie van een natuurlijk trackeinde stelde een eis die de Spotify-SDK structureel niet
haalt, waardoor elke trackwissel als "extern" gold en de DJ nooit aftelde. Drie echte
wissels op productie, teller nul. Dat is gerepareerd, en vannacht om 01:36 heeft hij voor
het eerst volautomatisch gepraat — over de muziek heen, elf seconden, zonder dat de muziek
stopte.

Onderweg kwamen nog vier dingen boven die geen van de vijf bevindingen noemde. De
belangrijkste: een vastgelopen speler was voor **geen enkele** bewaking zichtbaar. De
muziek stond ruim twee minuten stil terwijl Spotify `is_playing: true` meldde en de
SDK-klok gewoon doorliep. Vijf plekken vertrouwden die vlag; alle vijf zijn dicht.

En de zender speelde in twintig minuten vier unieke nummers terwijl er 41 in de wachtrij
stonden. Oorzaak: na elke natuurlijke wissel zette MAIR er een seconde later een eigen
track overheen, op grond van een Spotify-lezing die nog de vorige track meldde (§11).

Verder: het achtergrondontwerp is uitgevoerd (één eigenaar, wake-protocol, keep-alive),
er staat een gemeten Content-Security-Policy op, de rate limit van de API-routes was met
één header te omzeilen en is dat niet meer, en zestien dode bestanden zijn weg.

En er is één ding dat ik gevonden heb maar bewust **niet** gerepareerd: Spotify speelt de
radioset niet. MAIR geeft dertig nummers mee, en twee tracks later bestaat Spotify's eigen
wachtrij uit een lus van drie nummers die geen van alle in MAIR's set van veertig staan.
Dat is het verschil tussen "mijn eigen radiozender" en "Spotify-radio met een MAIR-jasje",
en het is de eerste die ik morgen zou oppakken. Zie §12.

Wat je zelf moet doen staat in §7. Het succescriterium — praat de DJ door met het scherm
uit — is hier niet te bewijzen en staat daarom nergens als vinkje.

---

## 1. Hoe er getest is

Niet in simulatie. Tegen jouw echte Spotify Premium-sessie, met muziek die daadwerkelijk
uit de laptop kwam.

De Playwright-MCP bleek daar ongeschikt voor. Die start Chrome met
`--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows` en
`--disable-renderer-backgrounding` — precies de drie dingen die je bij achtergrondgedrag
wilt meten — en zonder Widevine kan hij geen noot Spotify afspelen
(`EMEError: No supported keysystem`). Daarom een eigen Chrome gestart met
`--remote-debugging-port` op hetzelfde testprofiel en daarop ingeprikt. Widevine werkte,
en MAIRFM speelde echt.

Om mijn eigen wijzigingen te kunnen testen draait de branch op `localhost:3100`, met
`/api/*` doorgestuurd naar productie. Zo draait de front-end die ik aanpas tegen de
echte backend zonder dat er een sleutel lokaal hoeft te staan. Je Spotify-sessie is
binnen de browser van het productie-tabblad naar localhost overgezet; die waarden zijn
nergens gelogd of weggeschreven.

Het **MAIR TEST LAB** is gebruikt, acht van de negen knoppen. `Test Complete Transition`
is via een echte muisklik in het paneel aangeklikt (Profiel → Diagnostiek), de rest via
dezelfde functies die die knoppen aanroepen.

| Knop | Uitkomst |
|---|---|
| Test Spotify | WARNING vóór het starten (geen actief apparaat), PASS met muziek aan: *"Speelt · FEVER DREAM"* |
| Test LLM | PASS — Groq `openai/gpt-oss-120b`, score 100 |
| Test TTS | PASS — Fish `s2.1-pro-free` |
| Generate Test Break | PASS — script geldig |
| Play Test Break | PASS — hoorbaar afgespeeld via Web Audio, muziek liep door |
| Test Complete Transition | PASS in 12,4 s — writer, TTS, Spotify pause (611 ms), DJ on air, hervat (342 ms) |
| Simulate Tracks | PASS — 100 normale transitions + 20 foutscenario's |
| Recovery Test | PASS — disconnect, resume-fout en netwerkfout blokkeren de muziek niet |
| Full Station Test | **niet gedraaid**, bewust: het is een samenstelling van Spotify + LLM + TTS + Simulate die hierboven allemaal los zijn gedraaid, en het zou twee betaalde aanroepen kosten voor informatie die ik al heb |

---

## 2. Wat er kapot bleek en niet in de vijf bevindingen stond

Dit is het belangrijkste deel van dit rapport. De vijf bevindingen uit de overdracht
waren grotendeels statisch gevonden. Zodra de app tegen een echte sessie draaide, kwamen
er vijf andere dingen boven die zwaarder wegen.

### 2.1 De Live DJ kwam nooit op de lucht

Twee commits geleden is de Live DJ standaard aangezet. Hij zweeg.

`stability-core.js` meldde een natuurlijk trackeinde alleen als de **laatst gemeten**
positie binnen 2,5 seconde van de duur lag. De Spotify Web Playback SDK stuurt echter
geen positie-updates: hij meldt alleen echte toestandswisselingen. Gemeten om 00:35:05
kwam de laatste melding vóór een trackwissel dertien seconden voor het eind binnen —
*Osso*, 188 s van 201 s — en daarna pas de nieuwe track op 0. In ruim een minuut spelen
kwam er geen enkele tussenliggende melding. Die test kon dus vrijwel nooit slagen.

Zonder dat signaal classificeert `transition-controller.js` elke natuurlijke wissel als
`EXTERNAL_CHANGE` in plaats van `NATURAL_END`, en `mair-dj-v2.js` telt alleen
`NATURAL_END`. Drie echte trackwissels op productie, teller bleef nul, `remaining` bleef
op 2 staan. De DJ telde nooit af.

Gerepareerd door de positie met de wandklok door te rekenen vanaf de laatste meting. Een
gepauzeerde track schuift niet op, en een gebruikersactie wordt in
`transition-controller.js` altijd eerst gematcht, dus een skip blijft een skip. Na de
reparatie: zeven van zeven wissels geteld, classificatie `NATURAL_END` met vertrouwen
0,98, en het bewijs landde op 267389 ms van een track van 267458 ms — 69 ms verschil.

### 2.2 Een vastgelopen speler was voor niets en niemand zichtbaar

Tijdens het testen stond de muziek ruim twee minuten stil zonder dat MAIRFM het merkte.

De SDK meldde `position: 325665` op een track van `173976` ms, met `paused: false` en een
klok die gewoon doorliep. Spotify's Web API meldde ondertussen `is_playing: true` met de
positie geparkeerd op exact de duur. De watchdog in `playback-primary.js` eiste
`sdk.paused` en zag het dus niet; `endedPlayback()` eiste `!is_playing` en zag het ook
niet. Dit is precies de storing die je in de auto meemaakt: stilte, terwijl alles groen
staat.

Een positie voorbij de duur kan bij gezond afspelen niet voorkomen — dan is de volgende
track er al. Dat is nu een ondubbelzinnig einde-signaal, ook zonder `paused`.

Dezelfde blinde vlek zat op vijf plekken, en ze zijn alle vijf dicht:

| Plek | Wat er misging |
|---|---|
| `playback-primary.js` watchdog | eiste `sdk.paused`, zag de vastgelopen speler niet |
| `playback-primary.js` `endedPlayback()` | eiste `!is_playing`, dus herstel sloeg over |
| `playback-primary.js` `observedPlaying()` | zei "speelt", waardoor de play-knop zou pauzeren wat al stil stond |
| `mair-background-guard.js` `resumeFailOpen()` | concludeerde dat de muziek hervat was |
| `radio-core-health-v1.js` | de langesessie-monitor eiste `!isPlaying` en telde de stilstand dus niet als stall |

### 2.3 De achtergrondwacht geloofde diezelfde leugen

Bij terugkomst naar de voorgrond kwam `mair-background-guard.js` drie keer achter elkaar
terug met `visible-still-playing`, omdat Spotify `is_playing: true` zei. Er was geen
geluid. Een track die op zijn duur geparkeerd staat telt nu niet meer als spelend, en
dan loopt het gewone herstelpad alsnog.

### 2.4 Elke automatische break sneuvelde op een verouderde lezing

Nadat 2.1 gerepareerd was, kwam de DJ-keten eindelijk in beweging — en strandde meteen.
Zeven van zeven voorbereidingen faalden binnen één seconde met *"Track veranderde vóór
voorbereiding"*.

`prepare()` vergelijkt de zojuist begonnen track met een verse `/me/player`-lezing. Die
Web API loopt vlak na een wissel achter en meldt dan nog de vorige track. De bestaande
retry-lus ving alleen een *leeg* antwoord af, niet een *verouderd* antwoord. Een
verouderde lezing is geen trackwissel maar een bron die nog niet is bijgewerkt; die zit
nu in dezelfde lus, met vijf pogingen in plaats van drie.

Dit is geen randgeval. In de eerste veertien minuten van de nachtelijke soak stond
`trace.spotify.context-retry` met de melding *"Spotify meldde nog de vorige track"*
**drie keer** in de tijdlijn — één keer per voorbereiding, en alle drie hersteld. Vóór
deze reparatie waren dat drie verloren breaks geweest.

### 2.5 De diagnostiek loog over wat er gebeurd was

`emit(reason, extra)` in de achtergrondwacht zette `extra` achteraan, dus een aanroeper
die zelf een `reason` meegaf overschreef de **naam van het event**.
`emit('dj-skip-armed',{reason})` kwam in de tijdlijn terecht als `visibility-hidden`. Dat
kostte mij vannacht tien minuten zoeken naar een fout die er niet was. De naam van het
event wint nu altijd; de aanleiding heet `cause`.

---

## 3. De vijf bevindingen uit de overdracht

### Bevinding 1 — de logruis: anders dan gedacht

De achttien "errors" komen inderdaad uit de Vercel-runtime (`DEP0169`, `url.parse`) en
niet uit onze code: de enige runtime-afhankelijkheid is `@vercel/functions` en `url.parse`
komt nergens voor.

Maar ze verdrinken geen echte fouten. **Er waren geen echte fouten in het log.** In het
hele backend-oppervlak stond precies één `console.error`, in `api/passenger.js`. Als de DJ
onderweg zweeg, stond er in Vercel niets dat dat verklaarde — en dat is het werkelijke
gat.

`/api/dj-writer` en `/api/tts` laten nu bij elke storing één regel achter met prefix
`MAIRFM!`, vindbaar met:

```bash
vercel logs <url> --scope joshjsps-projects | grep 'MAIRFM!'
```

Zonder prompt, zonder tekst, zonder sleutels — route, status, aanbieder, model,
foutmelding. De deprecation-ruis is **bewust niet onderdrukt**: hij is niet van ons, en
`--no-deprecation` zou ook toekomstige waarschuwingen dempen.

### Bevinding 2 — weggeslikte fouten

Zeventien plekken laten nu een regel achter waar eerder niets stond, alleen waar een fout
gedrag verbergt. In de twee bestanden die het afspelen bezitten ging het aantal lege
`catch`-blokken van 28 en 12 naar 20 en 7. In `playback-primary.js` gaat het om de vier
plekken waar de SDK-route faalt en stil wordt teruggevallen op de Web API, het niet kunnen
bijwerken van de afspeelwaarheid, en drie mislukte SDK-herstelpogingen. In
`mair-background-guard.js` werd elke netwerkfout op
`/me/player` een stille "er speelt niets", waarna die wacht een herstelactie begon voor
een probleem dat er niet was.

Het gedrag verandert nergens. Geverifieerd in de browser: een gesimuleerde netwerkfout
verschijnt nu als `background.remote-read-failed` met de echte melding erbij, waar eerder
niets stond.

De overige ~359 zijn niet aangeraakt. `try{localStorage…}catch{}` is legitiem en het
massaal openbreken daarvan levert ruis op, geen inzicht.

### Bevinding 3 — dode bestanden

Twaalf bestanden en vier stylesheets verwijderd, samen **94.868 bytes**. Geen ervan stond
in `index.html`, `sw.js`, `version.js`, `build7.js` of `capacitor.config.json`, en geen
ervan verscheen in de modulelijst van de draaiende app. `ios-dj-audio.js` is verwijderd in
plaats van uitgezet; de regressietest bewaakt nu dat het bestand niet terugkomt.

**Eén van de dertien staat er bewust nog: `mair-category-purity.js`.** Ik heb dit eerst te
sterk gesteld en corrigeer mezelf, want het maakt voor jouw beslissing uit.

Het bestand is geen dode hotfix maar een functie die nooit is aangesloten: **niets in de
app roept `window.MAIRCategoryPurity` aan.** Het bevat een lokaal, deterministisch filter
tegen witte ruis, regengeluid en ASMR, plus ontdubbeling en een minimum-aantal-terugval.

Wat ik aanvankelijk schreef — dat weggooien "dat filter weggooit" — klopt niet. De
Sleep-zender wordt namelijk al wél gefilterd: `channel-click-fix.js` stuurt elke zender
met `semantic:true` door `/api/category-filter`, en sleep staat daar met een
vertrouwensdrempel van 0,95. De AI-filtering is dus live; wat ontbreekt is de goedkope
lokale voorwacht die niet van een AI-aanroep afhangt.

De twee testscripts die het bestand noemen lezen alleen de **brontekst** — ze zouden ook
slagen als de module nooit draait, wat precies is wat er nu gebeurt. Dat is dezelfde
testzwakte als hieronder in §6.

De keuze is dus kleiner dan ik eerst schreef, maar nog steeds die van jou: aansluiten als
je een deterministische voorwacht wilt naast de AI, of schrappen samen met die twee
controles.

### Bevinding 4 — `[depth-limit]` in het diagnosepaneel

Root cause gevonden. Er waren **twee** sanitizers: `MAIRRuntime.safe` kapte op `depth>3`,
`MAIRObservability.sanitize` op `depth>4`, en de laatste delegeert naar de eerste. In
beide stond de diepte-check **vóór** de primitieve-check. `snapshot()` sanitiseert
bovendien het hele object nóg een keer, waardoor `trace[i].detail.status` — precies wat
het paneel toont — op diepte 4 belandde en verdween.

Het was ook meer dan cosmetisch: in `Simulate Tracks` waren alle invarianten
(`musicBlocked`, `duplicateAirs`, `staleAirs`, `overlappingBreaks`, `wrongTrackAirs`)
`[depth-limit]`. De belangrijkste uitkomst van die test was onleesbaar.

Een getal, een boolean of een korte string kan geen recursie veroorzaken en gaat nu op
elke diepte mee; alleen containers worden nog afgekapt, met een regel die zegt wat er
stond. Dubbel saniteren in `trace()` is weg. In de draaiende app: 34 keer `[depth-limit]`
vóór, **nul** erna, en het paneel toont weer `Spotify hervat · 342 ms`, `DJ on air · PASS`,
`spotify · pause · 611 ms`.

### Bevinding 5 — het Test Lab

Gebruikt, zie tabel in §1. Het paneel zit niet in Instellingen maar achter
**Profiel → Diagnostiek**; daar wordt de kaart naartoe verplaatst.

---

## 4. Het achtergrondontwerp

Uitgevoerd volgens `2026-09-22-achtergrondgedrag-design.md`, smalle variant.

**Eén eigenaar.** `mair-background-guard.js` is nu de enige module die
`visibilitychange` bindt. De zes genoemde modules binden er nul. De overige zestien
luisteraars elders in de app blijven staan, zoals afgesproken.

**Wake-protocol.** `mair:wake` vuurt in drie fases — `reconcile`, `refresh`, `paint` —
en een luisteraar met werk duwt zijn promise in `detail.tasks`, die de eigenaar afwacht
voor hij de volgende fase begint. Een falende fase houdt de volgende niet tegen.
`mair:sleep` is de tegenhanger.

Eén ding is tijdens het testen toegevoegd dat niet in het ontwerp stond: gaat het scherm
tijdens de reeks alweer uit, dan stopt de reeks. Gemeten liep er een wake-reeks door
terwijl de pagina al verborgen was.

**Keep-alive.** In `debug-tts.js`, zoals de correctie in het ontwerp voorschreef. Tien
seconden echte stilte in een lus, alleen in de native shell, gekoppeld aan `expectedLive`,
en hij stopt gegarandeerd. Het fragment wordt in code gebouwd in plaats van als data-URI
opgenomen: tien seconden 8-bits mono als base64 kost ruim honderd kilobyte aan iedere
bezoeker, ook aan de browsers die het nooit gebruiken.

In de echte browser bewezen: zonder Capacitor weigert hij te starten, óók als je het
expliciet vraagt; met een nagebootste native shell draait hij; en hij volgt `expectedLive`
in beide richtingen.

**De aanname uit paragraaf 7** staat in de tijdlijn: `audio.native-shell-probe` legt vast
of `window.Capacitor?.isNativePlatform?.()` waar is. Op desktop is dat een `warn`. Faalt
die aanname op je iPhone, dan is de keep-alive niet stuk maar nooit actief — en dat zie je
dan meteen.

**Buiten het ontwerp, en daarom apart te lezen.** Het ontwerp noemde ze niet, maar er
stonden twee harde grendels in de weg:

1. `ensureVoiceReady()` in `mair-dj-v2.js` gooide onvoorwaardelijk een fout zodra
   `visibilityState === 'hidden'`.
2. `mair-background-guard.js` brak elke lopende break af en armde `skipNext` bij elke
   verborgen trackwissel.

Zolang die twee er onvoorwaardelijk staan, zwijgt de DJ met het scherm uit — hoe goed de
keep-alive ook werkt. Beide zijn nu voorwaardelijk op een **aantoonbaar lopende**
keep-alive in de native shell. Overal anders — Safari, PWA, desktop — staat het oude
gedrag ongewijzigd: muziek wint. Sinds de DJ over de muziek heen praat in plaats van hem
te pauzeren (commit 2d82744) is de ergste uitkomst bovendien zachte muziek in plaats van
stilte, en de `finally` in `air()` zet het volume altijd terug.

**Vangnet.** Alle zes de modules die hun luisteraar inleverden houden een eigen ritme —
een interval of `pageshow`. Laadt de eigenaar niet, dan valt er dus niets stil; het wordt
alleen weer ongecoördineerd, zoals het was.

---

## 5. Beveiliging

`vercel.json` zette alleen `Referrer-Policy` en `X-Content-Type-Options`. Er is nu een
**Content-Security-Policy**, plus `Permissions-Policy` en `X-Frame-Options`.

De policy is niet bedacht maar gemeten: alle 250 verzoeken van een draaiende sessie zijn
geïnventariseerd, en daarna is de app onder die policy lokaal opnieuw gedraaid. Opstarten,
de Spotify Web Playback SDK, albumhoezen, een echte zender, de DJ-schrijver, de
stemvoorbereiding en een hoorbaar afgespeelde testbreak gaven samen **nul** overtredingen.
`script-src` staat op `'self'` plus `sdk.scdn.co`, zonder `unsafe-inline` en zonder
`unsafe-eval`. `scripts/predeploy-check.mjs` bewaakt dat de koppen blijven staan en dat de
CSP niet stilletjes wordt opgerekt.

**De rate limit was met één header te omzeilen.** Alle vijf de AI/TTS-routes sloegen hun
teller op `x-forwarded-for`, en namen daar het **eerste** element van. Dat is precies de
waarde die een client zelf meestuurt: met een willekeurige `X-Forwarded-For` per verzoek
telde elke aanroep als een nieuwe bezoeker en gold er in de praktijk geen limiet.
`x-real-ip` wordt door het platform gezet en is niet door de client te kiezen; daar hangt
de teller nu aan, met als terugval het laatste element van de keten in plaats van het
eerste.

Aangetoond in `scripts/api-failure-behavior-check.mjs`: eenentwintig verzoeken met steeds
een ander verzonnen `x-forwarded-for` maar hetzelfde `x-real-ip` lopen nu tegen een 429
aan, en een echt ander adres wordt nog gewoon bediend. Met de oude code faalt die test —
dat is nagelopen door hem er even in terug te zetten.

**Niet aangeraakt, wel gemeld.** `/api/dj-writer`, `/api/discover`, `/api/category-filter`
en `/api/news-bulletin` zijn nog zonder authenticatie bereikbaar, en hun rate limit is een
`Map` in het geheugen van de lambda — die schaalt dus mee omhoog zodra Vercel opschaalt.
Zolang Groq het werk gratis doet is misbruik hooguit vervelend; zodra er een betaalde
sleutel in gaat kost het geld. Allebei vragen een beslissing van jou en geen stille
wijziging vannacht. `/api/config` geeft de Spotify client-id en een Mapbox `pk.`-token;
allebei publieke waarden die in de client horen — geen lek.

---

## 6. Wat ik bewust heb laten liggen

| Wat | Waarom |
|---|---|
| `mair-category-purity.js` verwijderen | Geen dode code maar een niet-aangesloten functie met echt gedrag. Jouw keuze. Zie §3. |
| De overige ~359 lege `catch`-blokken | Het merendeel is legitiem. Massaal openbreken levert ruis op. |
| De zestien overige `visibilitychange`-luisteraars | De smalle variant, zoals je koos. Ze zijn nog niet schuldig bevonden. |
| Authenticatie op de vier AI-routes | Gedragswijziging op een pad dat de app kan breken. Beslissing van jou. |
| De rate limit gedeeld maken | Vraagt gedeelde opslag; dat is infrastructuur, geen nachtwerk. |
| Blokovergangen | Eigen ontwerp, volgende ronde — zoals afgesproken. |
| `Full Station Test` | Samenstelling van vier tests die los al gedraaid zijn; zou twee betaalde aanroepen kosten voor niets nieuws. |
| **Spotify speelt de radioset niet** (§12.1) | De zwaarste vondst van de nacht, en juist daarom niet om vier uur 's nachts aangeraakt. MAIR doet maar één `play`-aanroep; wie Spotify's wachtrij daarna vult heb ik niet vastgesteld. Een gok hier kost je de muziek. |
| **De CHILL-zender vol vulmuziek** (§12.2) | Een selectieprobleem, geen bug in de code die ik vannacht bekeek. Vraagt een keuze over hoe zenders gevuld worden. |
| De Web Playback SDK op iOS meten | Aparte meting, staat als zodanig in het ontwerp. |

Eén opmerking over de testsuite zelf, want die verdient aandacht: **vier van de tests die
ik moest bijwerken controleerden een letterlijke regel broncode, geen gedrag.** Ze
faalden omdat ik de tekst veranderde, niet omdat ik iets brak. Zo kan 27 keer groen samen
bestaan met een DJ die nooit op de lucht kwam. De uitgebreide
`background-guard-behavior-check.mjs` draait wél echt gedrag in een VM — dat is het model
dat navolging verdient.

---

## 7. Wat alleen jij kunt natesten, op je iPhone

Dit staat hier expliciet en níét als vinkje. Een groene browsertest op deze laptop zegt
niets over iOS: desktop-Chrome bevriest een achtergrondtabblad fundamenteel anders dan
iOS Safari een PWA, en de keep-alive is er juist voor het geval dát iOS wil bevriezen.

1. **Praat de DJ door met het scherm uit?** Dit is het succescriterium van het hele
   ontwerp en het enige dat hier niet te bewijzen valt. Installeer de app, start muziek,
   vergrendel het scherm en luister of er een break komt.
2. **Staat `audio.native-shell-probe` op `isNativePlatform: true`?** Kijk in
   Profiel → Diagnostiek → Event timeline. Staat daar `false`, dan injecteert Capacitor
   zijn brug niet in de externe `server.url` en is de keep-alive nooit actief — dan is er
   verder niets stuk, maar werkt het ook niet.
3. **Blijft de muziek doorspelen tijdens een break met het scherm uit?** De DJ duckt nu in
   plaats van te pauzeren. Als er iets misgaat hoort de muziek zacht te worden, niet stil.
4. **Duwt de keep-alive de Spotify-app weg?** Dit is het risico dat ik niet kan meten en
   dat je meteen hoort. De keep-alive speelt een lus van stilte *vanuit de webview*. Een
   webview kan zijn audiosessie-categorie niet zelf kiezen, dus het is mogelijk dat iOS
   die stilte als "deze app speelt nu audio" opvat en de Spotify-app dempt of onderbreekt.
   Merk je dat de muziek zachter wordt of hapert zodra MAIRFM opent, zet hem dan uit met
   `window.JFMDJAudio.keepAliveStop()` in de console, of meld het en ik haal hem eruit.
   Gaat er niets mis, dan is dit het hele punt van het ontwerp.
5. **Klopt het scherm bij terugkomst?** Geen sprong, geen inhaalslag, geen late DJ. Dat is
   wat het wake-protocol moet oplossen.
6. **Car Mode in een echte auto**, met bluetooth-overdracht, een tunnel en mobiele data.
7. **Hoe het klínkt.** Dat een verzoek vuurde en een element speelde is aantoonbaar; of de
   stem goed klinkt en of de DJ iets zinnigs zegt, niet.
8. **Twee apparaten tegelijk** (`deviceHandovers` in `playback-primary.js`).

Eén praktisch ding: in het testprofiel stond `mair_dj_enabled_v1` op `'0'`, dus de DJ was
daar uitgezet. Ik heb hem aangezet om te kunnen testen. Controleer op je telefoon of de
schakelaar daar aan staat, anders zoek je naar een DJ die per instelling zwijgt.

---

## 8. De DJ is op de lucht geweest

Om 01:36 ging de DJ voor het eerst volautomatisch op de lucht, zonder dat ik iets
aanraakte. Het volledige spoor uit de tijdlijn:

```
01:33:38  dj.break-created            PREPARING
01:33:38  trace.spotify.context-retry WARNING     <- de verouderde lezing, opnieuw gevraagd
01:33:39  trace.spotify.context       PASS        <- en nu wel de juiste track
01:33:39  trace.brain.decision        PASS        cadence, time-since-break,
                                                  defensible-music-link, next-track-known
01:33:40  trace.llm.response          PASS        1.155 ms
01:33:40  trace.validation            PASS
01:33:46  trace.tts.response          PASS        5.943 ms
01:33:46  trace.break.armed           PASS
   ... twee en een halve minuut wachten op de trackwissel ...
01:36:04  transition.classified       NATURAL_END
01:36:05  trace.spotify.duck          PASS        203 ms   <- zachter, niet gepauzeerd
01:36:05  trace.tts.playback-start    PASS
01:36:16  trace.tts.playback-end      PASS        11.164 ms
01:36:16  trace.spotify.unduck        PASS        221 ms
01:36:16  dj.break-terminal           COMPLETED   played
```

`gespeeld: 1`, `gemist: 0`, totale handoff 12.176 ms, route `web-audio`, provider `fish`,
`playbackSuccess: true`. De muziek is geen moment gestopt: `playing` bleef `true`,
`ducked` ging van `false` naar `true` naar `false`.

De tekst die hij uitsprak:

> *"Na 'Bare Minimum' van Frsh, KM en LA\$\$A, gaan we meteen door naar 'Feels Pt. twee'
> van Son Mieux, beide uit twee duizend zesentwintig."*

Drie van de vijf reparaties uit §2 zijn hier tegelijk zichtbaar. Zonder 2.1 was
`transition.classified` `EXTERNAL_CHANGE` geweest en had de teller nooit 2 gehaald. Zonder
2.4 was de voorbereiding om 01:33:38 gesneuveld op die `context-retry` — die regel staat
er als `WARNING` omdat de Web API op dat moment inderdaad nog de vorige track meldde. En
dat `duck` in plaats van `pause` is de commit die je zelf gisteren maakte, nu voor het
eerst in het wild waargenomen.

Wat dit **niet** bewijst: hoe het klonk, en of hij dit ook doet met het scherm uit op een
iPhone. Zie §7.

## 9. Wat de soak liet zien

De app heeft veertig minuten aan één stuk doorgespeeld met de DJ aan, inclusief een
venster van zes minuten met het scherm uit. Daarna is hij opnieuw gestart in Car Mode
voor de rest van de nacht, met de betaalde routes dichtgezet.

**Classificatie van trackwissels.** Over de hele ronde: **veertien keer `NATURAL_END`
tegen twee keer `EXTERNAL_CHANGE`**. Vóór de reparatie was die verhouding nul tegen drie.
Eén van de twee is de zenderstart (er is dan geen vorige track om een einde van te zijn),
de andere viel in het verborgen venster.

**Degradatie, in het echt.** Toen het budget op was, weigerde mijn grendel vijf betaalde
aanroepen. Wat de app deed: `trace.llm.fallback` tweemaal — de writer viel terug op zijn
veilige Nederlandse noodtekst —, `trace.tts.retry` driemaal, en drie breaks die netjes
terminal gingen. **De muziek stopte geen moment.** Dat is de eerste regel uit `CLAUDE.md`,
nu niet in simulatie maar in de draaiende app.

**Zes minuten met het scherm uit** (01:58:30–02:04:30). De muziek speelde door, de tracks
wisselden gewoon, en bij terugkomst was er geen inhaalslag. Eén wissel in dat venster werd
als `EXTERNAL_CHANGE` gezien, waarop de DJ zijn aftelling terugzette. Dat is op desktop
zonder gevolg — daar mag de DJ toch niet praten met het scherm uit — maar op je iPhone
met een werkende keep-alive betekent het dat de DJ af en toe opnieuw begint te tellen.
Vóór vannacht telde hij helemaal nooit af, dus dit is winst, geen regressie. Noem het als
het je op de weg opvalt.

**Spotify gaf 429.** Na een nacht intensief pollen en spoelen ging Spotify's Web API mij
rate-limiten. Dat is mijn schuld, geen productfout, maar het leverde wel een gratis test
op: onder een echte 429-storm bleef `failures: 0`, `lastError` leeg en de muziek spelen.
`spotify-api-budget.js` doet zijn werk.

**Koude start op de definitieve code.** Service worker weg, caches leeg, alles opnieuw:
137 modules geregistreerd, nul mislukte installaties, nul dubbel geblokkeerd, nul
verzoeken naar de zestien verwijderde bestanden, nul 4xx op statics, nul
CSP-overtredingen, nul consolefouten.

## 10. Eén open waarneming die ik niet heb kunnen dichttimmeren

In de tweede soakronde, ná mijn eigen Spotify-rate-limit, zag ik dit patroon:

```
02:14:18  NATURAL_END      FEVER DREAM -> andere track
02:14:19  EXTERNAL_CHANGE  andere track -> FEVER DREAM     (één seconde later, terug)
```

Daarna speelde FEVER DREAM opnieuw helemaal af, en het herhaalde zich. Elke terugsprong
telt als `transition-external_change`, en `miss()` zet de aftelling van de DJ op nul —
dus in die toestand komt de DJ nooit meer aan de beurt. De teller liep naar veertien
gemiste wissels.

**Wat ik heb uitgesloten:**

- Het is niet mijn watchdog-wijziging: `primary-sdk-watchdog-stalled` heeft in die sessie
  **nul** keer gevuurd.
- Het is geen `fastNaturalAdvance`: de bronnen `primary-natural-auto`, `-fast` en `-end`
  staan alle drie op nul.
- Het is geen reload-herstel: `reloadRestores: 0`.
- Het is niet Spotify's repeat: `repeat_state: "off"`.

**Wat ik niet heb kunnen vaststellen:** wie de track dan wél terugzet. De omgeving was op
dat moment niet schoon — Spotify gaf 429 door mijn eigen testverkeer, er stond een verzoek
in de wachtrij, shuffle stond aan en `context` was `null` omdat MAIR een losse
`uris`-lijst afspeelt in plaats van een playlist-context. Verder graven zou een gokje
opleveren in plaats van een antwoord, en een verkeerde conclusie in dit rapport is erger
dan een open punt.

**Wat er daarna gebeurde.** Ik heb het schone experiment alsnog gedaan: het openstaande
verzoek uit de opslag gehaald, de pagina vers geladen, een andere zender gestart en
daarna niets meer aangeraakt — geen gespoel, geen gepol richting Spotify. Uitkomst:

```
02:32:52  tel: 2   gemist: 0   geen terugsprong
```

Twee opeenvolgende natuurlijke wissels correct geteld, nul gemiste, en de track bleef
staan waar hij hoorde. **Het gedrag is niet reproduceerbaar op een schone pagina.**

Let op wat dat wel en niet zegt. Er veranderden drie dingen tegelijk — het verzoek eruit,
de rate-limit uitgewerkt, een andere zender — dus ik kan zeggen dat het niet terugkwam,
niet wat het veroorzaakte. Mijn beste kandidaat is het samenspel van een gewapend verzoek
met Spotify-antwoorden die 429 gaven, maar dat is een vermoeden en geen bewijs. Als je
ooit merkt dat een nummer zich herhaalt terwijl er een verzoek openstaat: dat is dit.

## 11. De zender speelde vier nummers in twintig minuten

Dit vond ik pas in de laatste soakronde, en het raakt de luisterervaring directer dan
alles hierboven.

MAIR programmeert zijn eigen volgorde. `mair-radio-sequencer.js` spreidt de lijst in
lagen, bewaakt een herhaalvenster van 24 tracks en zet nooit twee nummers van dezelfde
artiest achter elkaar. Die zorgvuldig gebouwde lijst gaat vervolgens naar Spotify.

Gemeten: de zender had **41 tracks** in de wachtrij met een herhaalvenster van 24, en
speelde in twintig minuten **vier unieke nummers**, steeds in dezelfde ronde.

Mijn eerste verklaring was Spotify's eigen shuffle, die aan stond terwijl MAIR die nergens
uitzette. Ik heb dat gerepareerd — alle drie de plekken waar MAIR een lijst aan Spotify
geeft zetten shuffle nu eerst uit, en de test die ik erbij schreef vond meteen een derde
pad dat ik zelf vergeten was. Live bevestigd: `shuffle: true` vóór het starten,
`shuffle: false` erna.

**Maar dat was niet de oorzaak.** Met shuffle uit bleef de herhaling gewoon bestaan: een
nummer kwam terug na één tussenliggende track. Toen die variabele weg was, werd het
mechanisme wél zichtbaar:

```
02:55:37  NATURAL_END      A -> B     Spotify ging zelf door naar B
02:55:38  EXTERNAL_CHANGE  B -> C     één seconde later zet MAIR er C overheen
```

Het is **dezelfde verouderde Spotify-lezing als in §2.4**, maar dan in
`playback-primary.js`. Na een natuurlijk einde vraagt `fastNaturalAdvance` wat er speelt.
De Web API meldt de eerste seconde nog de track die net afgelopen is. MAIR leidt daaruit
af dat Spotify niet is doorgegaan, en zet er een eigen track overheen — over een
natuurlijke wissel die prima was. Daardoor bleef de zender rondcirkelen in een handvol
nummers, en telde elke wissel als `external_change`, wat de aftelling van de DJ steeds op
nul zette.

De lezing krijgt nu vier pogingen met de bestaande `verify`-lus voordat MAIR concludeert
dat Spotify stilstaat. Gedragstest erbij, en gecontroleerd door de reparatie er even uit
te halen: dan faalt hij.

Dat ik eerst de verkeerde oorzaak aanwees staat hier expliciet, want de shuffle-wijziging
blijft er wel in — op eigen merites, niet omdat hij dit probleem oploste.

### En er lag er nog één onder

Met de misclassificatie weg (`gemist: 0` over zes wissels) bleef de zender alsnog in
dezelfde vier nummers rondcirkelen. Toen ik ging kijken wat MAIR eigenlijk aan Spotify
geeft:

```
wachtrij:            42 tracks
huidige track:       staat er NIET in  (index -1)
stationContext():    1 track
```

MAIR gaf Spotify dus **één nummer per keer**. Spotify speelt dat af en kiest daarna zelf
verder — en omdat die volgende keuze ook niet in de set staat, blijft het een lijst van
één. De drie nummers die achter elkaar speelden zaten geen van alle in de wachtrij van
42; die had Spotify gekozen. De hele programmering van `mair-radio-sequencer.js` —
gespreid, herhaalvenster 24, geen twee nummers van dezelfde artiest achter elkaar — kwam
niet bij de luisteraar aan.

De schuldige is één regel in `stationContext()`:

```js
if(i<0) return uri?[uri]:[];   // speelt er iets buiten de set: geef alleen dat
```

Dat is op zichzelf verdedigbaar — er is geen positie om vanaf te snijden — maar het
resultaat is een doodlopende lijst. Nu staat wat er speelt vooraan en de set erachter:
eerst dit, dan de radio verder.

Gecontroleerd dat het niet aan het starten ligt: bij een verse start staat de huidige
track op positie 0 met een context van 30, en bij een zenderwissel ook. Het treedt pas op
als het afspelen van de set is afgedwaald, en dáár kwam MAIR er nooit meer uit.

**Dit is de enige wijziging van vannacht die een instelling van je Spotify-account
aanraakt.** Een radiozender hoort zijn eigen volgorde te bepalen, dus ik vind het
verdedigbaar — maar het is jouw account. Wil je het niet, dan gaat het om de aanroepen
van `disableSpotifyShuffle` in `playback-primary.js`; die weghalen kost één minuut en de
test vertelt je precies welke drie.

## 12. Twee dingen die ik heb gevonden maar bewust niet heb gerepareerd

Deze twee raken de luisterervaring hard, maar ik heb de oorzaak niet ver genoeg
teruggevolgd om er om vier uur 's nachts in te snijden. Het bewijs staat er wel, zodat je
er morgen meteen mee verder kunt.

### 12.1 Spotify speelt de radioset niet

Het scherpste bewijs van de nacht. MAIR gaf Spotify bij het starten netjes **30 nummers**
mee — één `play`-aanroep, gecontroleerd met een onderschepte `fetch`, en er kwam er daarna
geen tweede. Twee nummers later vroeg ik Spotify wat er in zijn eigen wachtrij staat:

```
speelt nu:  Repeat It
daarna:     My Body Isn't Ready → Note To Self → Repeat It →
            My Body Isn't Ready → Note To Self → Repeat It
```

Een lus van drie nummers. **Geen enkele daarvan staat in MAIR's set van veertig.**

Dus: MAIR programmeert een lijst, geeft die door, en Spotify speelt er het eerste nummer
van en gaat daarna zijn eigen gang. Dit verklaart alles wat ik eerder zag — vier unieke
nummers in twintig minuten, tracks die niet in de wachtrij staan, de misclassificaties.

Wat ik niet heb kunnen vaststellen: wie die lus in Spotify's wachtrij zet. MAIR doet maar
één `play`-aanroep. Mijn beste hypothese is dat een `uris`-lijst op een Web Playback
SDK-device niet als volwaardige wachtrij blijft staan en dat Spotify's eigen autoplay het
overneemt. Als dat zo is, is de oplossing structureel — een echte context (een playlist)
in plaats van een losse `uris`-lijst — en dat is een ontwerpbeslissing, geen nachtwerk.

**Dit zou ik als eerste oppakken.** Het is het verschil tussen "mijn eigen radiozender"
en "Spotify-radio met een MAIR-jasje".

### 12.2 De CHILL-zender staat vol vulmuziek

Toen ik MAIR's eigen set bekeek, bleek het probleem niet alleen bij Spotify te liggen:

| Positie | Titel | Artiest |
|---|---|---|
| 0 | Chill Pop | Rick Elmore |
| 2 | Chill Pop | Ashish Shiva Ram Kumar |
| 3 | Chill Pop | Jazz Funk Studio, Popyoursoul |
| 4 | Chill Pop | Male Jazz Background Tracks |
| 8 | Chill Pop | SnukiChan |
| 26–29 | Soft Pop | Blinds Closed / Acoustic Guitar / AXS Music / Glued |

Vijf verschillende nummers die allemaal letterlijk *"Chill Pop"* heten, en vier *"Soft
Pop"* achter elkaar. Dit is productiebibliotheek-muziek, geen echte songs.

De ontdubbeling werkt correct — het zijn verschillende track-id's — en het herhaalvenster
van 24 wordt dus formeel niet overtreden. Het probleem zit in de **selectie**: de zender
haalt op een titel die precies zo'n bibliotheek oplevert. De semantische filter in
`/api/category-filter` laat het door, want "rustig, ontspannen en warm" klopt gewoon.

Er stond overigens ook een *Freek-A-Leek* in de chill-set, op positie 33.

Dit geeft ook een concreet antwoord op de vraag uit §3 over `mair-category-purity.js`: er
is wel degelijk een kwaliteitsgat, al richt dat filter zich op slaapgeluid en niet op
vulmuziek.

## 13. Verzoeken en Car Mode

Beide vielen buiten de vijf bevindingen maar staan hoog in de prioriteitenlijst van
`CLAUDE.md`, dus ze zijn alsnog aangeraakt.

**Verzoeken (prioriteit 2).** Gezocht op *Rolling in the Deep*, echte Spotify-resultaten
terug, de Adele-versie aangevraagd. Het verzoek komt binnen als `status: planned` met
`remaining: 2`, verschijnt in de lijst met `±2 ✓` en telt bij de eerstvolgende
trackwissel af naar `remaining: 1`. Daarna liep ik tegen Spotify's 429 aan en heb ik het
niet verder kunnen versnellen; **of het verzoek daadwerkelijk als derde track speelt is
dus niet aangetoond.** De boekhouding eromheen klopt wel.

**Car Mode (prioriteit 7).** Opent vanuit de radiopagina, toont het keuzescherm
(*"Muziek eerst. Route wanneer je hem nodig hebt."*), en `Start zonder route` geeft het
rijscherm met grote hoes, nu/volgende en transport. Muziek liep door, nul
CSP-overtredingen. Niet getest: in een echte auto, liggend op een telefoon, met
bluetooth. De nachtelijke soak draait bewust ín Car Mode, zodat dat scherm de lange
sessie meemaakt.
