# MAIRFM testrapport 23-09-2026

- **Branch:** `claude/achtergrondgedrag-20260922` — niets naar `main`, niet gedeployed.
- **Commits:** vier, elk met een eigen onderwerp.
- **Release-gate:** `npm run predeploy` groen, `EXIT=0`, 516 PASS / 0 FAIL.
- **Budget:** 7 van de 10 betaalde DJ/TTS-aanroepen gebruikt, 3 gereserveerd voor de
  nachtelijke soak en hard afgegrendeld in de browser.

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
| Test Spotify | WARNING vóór het starten (geen actief apparaat), PASS erna |
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

Veertien van de 373 lege `catch`-blokken aangepast, alleen waar een fout gedrag verbergt.
In `playback-primary.js` de vier plekken waar de SDK-route faalt en stil wordt
teruggevallen op de Web API, het niet kunnen bijwerken van de afspeelwaarheid, en drie
mislukte SDK-herstelpogingen. In `mair-background-guard.js` werd elke netwerkfout op
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

**Eén van de dertien staat er bewust nog: `mair-category-purity.js`.** Dat is geen dode
hotfix maar een functie die nooit is aangesloten. Het bevat het filter dat witte ruis,
regengeluid en ASMR uit de Sleep-zender houdt, en twee testscripts
(`scripts/dj-v2-regression.mjs`, `scripts/user-reported-hotfix-check.mjs`) eisen dat
gedrag nog woordelijk. Weggooien betekent dat filter weggooien. Er zijn twee zinnige
keuzes — aansluiten of samen met de tests schrappen — en allebei zijn het jouw keuze, geen
opruimactie om vier uur 's nachts.

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
4. **Klopt het scherm bij terugkomst?** Geen sprong, geen inhaalslag, geen late DJ. Dat is
   wat het wake-protocol moet oplossen.
5. **Car Mode in een echte auto**, met bluetooth-overdracht, een tunnel en mobiele data.
6. **Hoe het klínkt.** Dat een verzoek vuurde en een element speelde is aantoonbaar; of de
   stem goed klinkt en of de DJ iets zinnigs zegt, niet.
7. **Twee apparaten tegelijk** (`deviceHandovers` in `playback-primary.js`).

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

## 9. Nachtelijke soak

Zie `soak.log` in de scratchpad van deze sessie. De app speelt door op `localhost:3100`
met de DJ aan, wisselt elk half uur zes minuten naar verborgen en terug, en heeft een
harde grens van drie betaalde aanroepen — is die op, dan worden `dj-writer` en `tts`
geweigerd. Dat is meteen de echte degradatietest: de muziek hoort dan gewoon door te
spelen.
