# MAIRFM testronde 22/23-09-2026 — bevindingen en overdracht

Geschreven aan het eind van een sessie die vanuit `C:\Users\joshk` draaide en daardoor
géén Playwright, chrome-devtools of de web-quality-skills had. De vervolgsessie draait
vanuit `C:\Users\joshk\Josh-FM` en heeft die wel.

**Branch:** `claude/achtergrondgedrag-20260922` (aangemaakt, nog niets aan productiecode
gewijzigd).

## Opdracht van Josh

1. Alles van MAIRFM zo goed mogelijk testen.
2. Per bevinding **eerst uitzoeken hóé het gerepareerd kan worden**, dan pas repareren.
3. Daarna een rapport met wat er gerepareerd is.

Niets naar `main`, niet deployen. Alles op de branch hierboven.

## Wat al gedaan is

| Test | Uitkomst |
|---|---|
| `npm run predeploy`, 44 scripts | groen — 272 PASS / 0 FAIL, smoke 167 PASS / 0 FAIL, soak 480 overgangen, `EXIT=0` |
| Zes productie-GET-endpoints | alle 200; Fish Audio `configured: true`, stem *"Vlotte Nederlandse Stem"*, `languages: ['nl']`, `dutchReady: true` |
| Productielogs (via Vercel CLI) | gelezen; zie bevinding 1 |
| Statische analyse | bevindingen 2 t/m 5 |

**Vercel:** de MCP-server geeft 403 (`scope "joshjsps-projects"` niet geautoriseerd op
het hergebruikte token). De **CLI werkt wel** — `vercel logs <url> --scope joshjsps-projects`.
Gebruik de CLI, niet de MCP, tenzij Josh opnieuw inlogt.

## Bevindingen

### 1. De 18 "errors" in de productielogs zijn ruis

Allemaal dezelfde regel: `[DEP0169] DeprecationWarning: url.parse()`. Geverifieerd:
`url.parse` komt nergens in MAIRFM's eigen code voor — dit komt uit de Vercel/Node-runtime.

Het echte probleem: Vercel merkt alles op stderr aan als `error`, dus elke échte fout
verdrinkt hierin. "Error" in deze logs betekent nu niets.

### 2. 382 stil weggeslikte fouten

Lege `catch{}`-blokken:

| Bestand | Aantal |
|---|---|
| `playback-primary.js` | 30 |
| `director.js` | 16 |
| `mair-dj-retired.js` | 13 |
| `release-hotfix-v224.js` | 13 |
| `mair-background-guard.js` | 12 |
| `spotify-test-config.js` | 12 |
| **totaal** | **382** |

Niet allemaal fout — `try{localStorage…}catch{}` is legitiem. Maar 30 in het bestand dat
afspelen bezit is geen toeval, en dit verklaart waarom de observability-ringbuffer leeg
blijft: de fout is al weggegooid voor hij geregistreerd kan worden.

**Aanpak:** niet alle 382 aanpakken. Begin bij `playback-primary.js` en
`mair-background-guard.js`, en alleen daar waar een fout gedrag verbergt in plaats van
een bekende, onschuldige storing afvangt. Route: `MAIRRuntime.record(...,'warn')`.

### 3. Dertien dode bestanden (~39 KB), al gemeld op 31-08-2026

```
auth-ui-guard.js · bugfix-playback.js · dj-now-immediate-fix.js · ios-dj-audio.js
mair-build-orchestrator.js · mair-category-purity.js · mair-dj-retired.js
mair-mobile-hotfix-v1.js · mair-playback-category-guard.js · mair-stations-config.js
release-hotfix-v224.js · stable-auth.js · start-sequence.js
```

`taken/audit-31-augustus-2026/…txt` meldde dit al woordelijk, inclusief
*"mair-station-art-1..4.css (57 KB dode CSS)"*. Drie weken later staat het er nog.

Vier ervan (`bugfix-playback`, `dj-now-immediate-fix`, `release-hotfix-v224`,
`mair-mobile-hotfix-v1`) staan in de release-notes beschreven als geleverde reparaties
maar draaien niet.

**Let op bij verwijderen:** `ios-dj-audio.js` wordt genoemd in
`scripts/dj-v2-regression.mjs`, dat bewaakt dat het uit blijft. Weghalen breekt die test.
Overleg met Josh voordat er iets verdwijnt — het zijn zijn bestanden.

### 4. `[depth-limit]` lekt naar het diagnosepaneel

In het Event timeline-paneel staat *"Trackwissel gedetecteerd — Break station ·
[depth-limit]"*. Dat is `sanitize()` die op diepte > 4 afkapt; de gebruiker ziet een
serialisatie-artefact waar informatie hoort. Cosmetisch maar zichtbaar.

### 5. De app heeft een eigen Test Lab dat nog niet gebruikt is

In de app (`mair-test-lab.js`) zit een paneel **MAIR TEST LAB** met negen knoppen:
Test Spotify, Test LLM, Test TTS, Generate Test Break, Play Test Break,
Test Complete Transition, Simulate Tracks, Recovery Test, Full Station Test.

Waarschuwing in de app zelf: *"Simulaties verstoren playback niet. Alleen 'Play Test
Break' en 'Test Complete Transition' maken hoorbaar geluid; de complete transition kan
Spotify kort pauzeren."*

Dit is de beste beschikbare test tegen een echte sessie. Gebruik dit in plaats van
zelfbedachte tests.

## Klaargezet voor de volgende sessie

- **Spotify-login is gedaan** in het Chrome-profiel `C:\Users\joshk\.mair-test-profile`.
  Er is een levende sessie (de app detecteerde om 00:07:31 een trackwissel). Chrome is
  gesloten en het `lockfile` is weg, dus Playwright kan het profiel overnemen.
- De Playwright-MCP is hierop ingesteld:
  `npx -y @playwright/mcp@latest --browser chrome --user-data-dir C:/Users/joshk/.mair-test-profile`
- **Budget:** maximaal tien betaalde DJ/TTS-aanroepen samen. Door Josh niet zelf genoemd;
  door mij gekozen en aan hem gemeld.

## Wat niet getest kan worden

Zeg dit in het eindrapport expliciet, niet als "groen":

1. **Geluid.** Dat een verzoek vuurde en een element speelt is aantoonbaar; of het goed
   klínkt niet.
2. **iPhone, Capacitor-app, vergrendeld scherm, Car Mode in een auto.** Geen toestel
   aanwezig. Dit is precies het succescriterium van het ontwerp.
3. **Echte omstandigheden:** mobiele data, tunnels, bluetooth-overdracht, een lange rit.
4. **Twee apparaten tegelijk** (`deviceHandovers` in `playback-primary.js`).
5. **Of de DJ goed schrijft.** Vorm wel, smaak niet.

Desktop-Chrome bevriest een achtergrondtabblad anders dan iOS Safari een PWA. Een groene
browsertest zegt niets over de eis "DJ praat door met scherm uit".

## Nog niet gedaan, wel beloofd

**Beveiligingscontrole op de vier open AI-routes.** Stond op de lijst van de vorige
sessie en is er niet van gekomen. Wat er ligt:

- `/api/dj-writer`, `/api/discover`, `/api/category-filter` en `/api/news-bulletin` zijn
  zonder authenticatie bereikbaar.
- De rate limit in die routes is een `Map` in het geheugen van de lambda, dus hij werkt
  **per instance** — bij opschaling schaalt de limiet mee omhoog.
- Zolang Groq het werk gratis doet is misbruik hooguit vervelend. Zodra er een betaalde
  sleutel in gaat, kost het geld. Beslis dit vóór die sleutel erin gaat.
- Er is **nergens een Content-Security-Policy**: niet in `vercel.json` (dat zet alleen
  `Referrer-Policy` en `X-Content-Type-Options`) en niet als meta-tag in `index.html`.
- `/api/config` geeft ongeauthenticeerd de `spotifyClientId` en een Mapbox `pk.`-token.
  Allebei publieke waarden die in de client horen — geen lek, wel het vermelden waard.

Draai `/security-review` hierop en leg de uitkomst aan Josh voor voordat er iets
verandert.

## Volgorde die Josh heeft goedgekeurd

1. Achtergrondgedrag, **smalle variant** — zie
   `2026-09-22-achtergrondgedrag-design.md` in deze map.
2. Blokovergangen (de DJ kondigt een blokwissel aan) — eigen ontwerp, nog te maken.
3. Daarna pas de opruiming (dode bestanden, weggeslikte fouten) als Josh dat wil.
