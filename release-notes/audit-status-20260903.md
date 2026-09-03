# Auditstatus — 3 september 2026

De volledige audit ("MAIRFM Signaalcontrole", 31 augustus 2026, branch `main` @ 7a051b8)
bestond alleen als HTML-rapport in een tijdelijke werkmap. Dit bestand legt per bevinding
vast wat er inmiddels mee is gebeurd, zodat die kennis niet nog een keer verdwijnt.

De status per punt is geverifieerd tegen de code op deze branch, niet overgenomen uit het
rapport. "Opgelost" betekent: de oorzaak is uit de code weg. Het betekent **niet** dat het op
een iPhone is getest — zie de laatste sectie.

## Kritiek

| # | Bevinding | Status |
|---|-----------|--------|
| C-1 | Release gate en CI 25 commits rood door een hardcoded cacheversie | **Opgelost.** `scripts/release-cache.mjs` leest `const CACHE` uit `sw.js` en bewaakt dat `api/version.js` dezelfde versie meldt. `npm run predeploy` is groen. |
| C-2 | Automatisch doorspelen kan stilvallen of dezelfde track herhalen | **Opgelost.** `stability-core.js` heeft de tweede bewijsvorm (`collapsedFromEnd`: zelfde track, was nog spelend, binnen 3,5 s van het einde, positie teruggeklapt naar ~0), en `playback-primary.js` heeft `RESUME_GUARD_LIMIT` — na herhaald mislukt hervatten van hetzelfde nummer gaat de radio precies één keer gecontroleerd door. Dit is het gebied met de onaantastbare drempels; niet aangeraakt. |
| C-3 | Time Machine garandeert het jaarbereik niet in alle paden | **Opgelost voor alle drie de lekken.** `fallbackDirectWithContext()` filtert nu expliciet op `eligible()`, `prepareNextRotation()` filtert kandidaten via `modeEligible()` vóór de directoraanroep, en `originalYear()` wantrouwt veel meer heruitgave-signalen. **Nog open:** dat een *verzoek* de jaargrens wél mag doorbreken is nergens als besluit vastgelegd. |
| C-4 | Elf Car Mode-bestanden ontbraken in de service-worker-cache | **Opgelost.** Alle elf staan in `CORE`, en `boot()` laadt per module via `loadOptional()` met een eigen catch, zodat één ontbrekende module `ensureLauncher()` niet meer onbereikbaar maakt. |
| C-4b | `cacheCore()` liet de hele SW-installatie falen op één van 28 bestanden | **Opgelost.** `CRITICAL` is teruggebracht tot negen echte kernbestanden; de rest gaat via `Promise.allSettled`. |

## Hoog

| # | Bevinding | Status |
|---|-----------|--------|
| H-1 | Car Mode herschrijft zijn volledige DOM bij elk playback-event | **Open.** Het grootste openstaande punt, met vier compensatielagen eromheen. Hoort in een eigen branch met een visuele checklist per scherm, en de pleisterlagen mogen pas weg ná bevestiging op een iPhone. |
| H-2 | Car Mode-breakpoints dekken de iPhone 16 Pro Max niet | **Opgelost, vandaag afgemaakt.** Ronde 1 verhoogde twee van de drie bestanden naar 500 px; de stylesheet die `mair-car-70-30.js` zelf injecteert stond nog op 430 px. Nu slaan alle drie op dezelfde hoogte om. |
| H-3 | DJ praat niet met scherm uit; een mislukte break is verloren | **Bewuste keuze, nu eerlijk vastgelegd.** `PRE_DEPLOY.md` regel 8 beloofde een pending-retry die de code niet heeft; die regel beschrijft nu het werkelijke gedrag. De DJ staat sowieso uit (`MAIR_DJ_ENABLED=false`). |
| H-4 | Break wordt afgebroken zodra de volgende track niet de verwachte is | **Open.** Geen actuele impact zolang de DJ uit staat. |
| H-5 | Circa vijftig permanente timers, waarvan een deel sub-seconde | **Deels.** Vandaag geteld: 66 `setInterval`-aanroepen in runtimecode. Drie modules letten nu op `document.hidden`: `director.js` (3 s, DOM plus een Spotify-aanroep), `progress-clock-v226.js` (250 ms — de snelste van de hele app, vier DOM-updates per seconde voor een balk die je niet ziet) en de health-kaart in `debug-tts.js` (3 s `innerHTML`). Twee snelle timers zijn bewust met rust gelaten: de tik van 500 ms in `mair-sleep.js` móét met het scherm uit doorlopen, want die laat de sleeptimer afgaan, en `reconcile()` in `music-intelligence-v3.js` doet queue-werk in plaats van tekenwerk. Een gedeelde tick-bus is nog niet gebouwd; dat blijft het structurele antwoord. |
| H-6 | Geen volumeregeling en geen ducking, fade of crossfade | **Open.** Stap 1 (een volumeregelaar via `player.setVolume()`) staat op zichzelf en is laag risico; stap 2 (ducking) raakt de gevoeligste overgang in het product. |
| H-7 | Hoofdshell houdt geen rekening met notch, Dynamic Island en landschap | **Grotendeels een false positive; vangnet vandaag gedekt.** `mair-ux-v1.js` zet `body.mairfm-ux-v1` onvoorwaardelijk, en `mair-ux-v1.css` verbergt daarmee `.top` en `.tabs` en zet de shell-padding met `!important` inclusief eigen safe-area-waarden. De basisregels in `styles.css` leiden nu wél af uit `env(safe-area-inset-*)`, voor het geval die laag niet laadt. |
| H-8 | ~110 scripts in zes cascades, met load-order-afhankelijk patchen | **Open.** Structureel. Hoort cascade voor cascade, met een groene poort tussen elke stap. |

## Middel

| # | Bevinding | Status |
|---|-----------|--------|
| M-1 | Twee eigenaren van de sleeptimer | **Opgelost** in ronde 1. |
| M-2 | MediaSession-metadata wordt overmatig herschreven | **Opgelost** in ronde 1. |
| M-3 | Dertien dode bestanden in de actieve tree | **Open, wel geverifieerd.** Alle dertien bestaan nog en worden nergens geladen of gerefereerd, ook niet dynamisch: `auth-ui-guard.js`, `bugfix-playback.js`, `dj-now-immediate-fix.js`, `mair-dj-retired.js`, `mair-mobile-hotfix-v1.js`, `mair-stations-config.js`, `release-hotfix-v224.js`, `stable-auth.js`, `start-sequence.js`, `mair-station-art-1.css` t/m `-4.css`, `api/icon.js`. Let op: het actieve `mair-station-art.css` (zonder cijfer) is een ánder bestand en wordt wél geladen. Verwijderen is destructief en wacht op akkoord. |
| M-4 | Touch targets onder 44 px | **Opgelost vandaag.** |
| M-5 | "Even stil" bestaat wel in code, niet in de UI | **Deels.** `#skipTalk` bestaat niet in `index.html`; de verwijzingen in zes bestanden staan er nog maar zijn allemaal null-safe. Zolang de DJ uit staat hóórt de knop er ook niet te zijn. Wat resteert is opruimwerk. |
| M-6 | Car Mode-menu "Time Machine" opent de verkeerde functie | **Opgelost vandaag.** De knop sloot Car Mode en klikte de legacy `[data-mode="throwback"]` aan — een kaart die `director.js` juist verbergt — dus niet de Time Machine. Knop en dode handler zijn verwijderd uit zowel het prototype als de sticky-menukopie. Time Machine blijft bereikbaar in de hoofdapp. |
| M-7 | Passenger Mode observeert het hele document; QR-lib van een CDN | **Deels.** De observer kijkt nu alleen naar de radiotab en de Car Mode-overlay. **Nog open:** `qrcodejs` komt van `cdn.jsdelivr.net` (niet gecached, geen SRI, werkt niet offline) en gastverzoeken gaan zonder goedkeuring van de bestuurder de wachtrij in. |
| M-8 | `MAPBOX_PUBLIC_TOKEN` nergens gedocumenteerd | **Opgelost vandaag** in `README.md`; in `.env.example` stond hij al. |
| M-9 | Einde van een Time Machine-sessie onderbreekt de lopende track | **Open, bewust niet aangeraakt.** In `mair-modes.js` roept `stop()` altijd direct `JFMPlayback.playUri()` aan op de eerste track van de nieuwe set, ook bij `reason==='completed'` — dus midden in het nummer dat op dat moment speelt. De nette fix is een eenmalige overdracht op het eerstvolgende natuurlijke einde. Dat is meer machinerie dan "klein", het raakt doorspelen (prioriteit 1) en het is zonder toestel niet te valideren. |
| M-10 | Rate limiting werkt per lambda-instance | **Open.** De `RATE`-map staat in modulegeheugen in `api/dj-writer.js` en `api/tts.js`, dus de effectieve limiet is een veelvoud van de bedoelde 20/min. Alleen relevant als de app publiek bereikbaar is. |
| M-11 | `vercel.json` stelt geen cachebeleid in | **Opgelost vandaag.** `index.html`, `sw.js`, `version.js`, het manifest en `/` krijgen `no-store`. Bewust géén lange cache voor de scripts: die worden zonder contenthash geladen en zouden dan juist blijven hangen. |
| M-12 | `director.js` doet elke 3 s DOM-werk in een onzichtbare div | **Opgelost vandaag.** De boekhouding draait door; het tekenwerk en de Spotify-aanroep slaan over zolang `document.hidden` waar is, en draaien één keer bij terugkeer naar de voorgrond. |

## Laag

| # | Bevinding | Status |
|---|-----------|--------|
| L-1 | Kapotte HTML-entity `&quot` in vier `esc()`-functies | **Opgelost vandaag.** |
| L-2 | `AudioContext` op moduleniveau aangemaakt en nooit gesloten | **Open.** `debug-tts.js` regel 26. Lui aanmaken raakt de iOS-audio-ontgrendeling en is zonder toestel niet te valideren. |
| L-3 | Dode legacy DJ-code in `app.js` | **Open.** `djBreak()`, `makeDJScript()`, `fallbackScript()`, `getFact()`, `getWeather()`. Let op bij het opruimen: `makeDJScript` wordt door vier modules gewrapt (`dj-context.js`, `dj-context-v2.js`, `dj-quality-v2.js`, `mair-dj-persona.js`), dus dit is geen simpele knip. |
| L-4 | `renderHistory()` rendert in een verborgen container | **Opgelost.** De functie is leeg. Productregel: houden zo, niet terugzetten. |
| L-5 | Merknaam-drift "Josh FM" | **Deels.** Alle schermteksten die de gebruiker vandaag kan tegenkomen zijn om: Backup & Herstel, de locatiekaart, de zelftest, de wachtrijstatus, twee verzoekmeldingen, de onboarding en de systeeminstructie van `/api/discover`. In bestandskoppen, interne identifiers en opslagsleutels staat de oude naam nog — dat is bewust, want die sleutels wijzigen breekt bestaande installaties. |
| L-6 | Documentatiedrift | **Opgelost vandaag** in `AGENTS.md`, `MAIR_STABILITY_NOTES.md`, `PRE_DEPLOY.md` en `README.md`. |
| L-7 | Losse notitiebestanden in de repo-root | **Open.** `.release-note-20260812-0237.txt`, `release-note-v225.txt`, `release-ready.txt`, `README-hotfix.md`, `README_ICON_UPDATE.txt`, `icon-source-note.txt`, `radio-copy-notes.txt`. `PRE_DEPLOY.md` regel 11 verbiedt ze. Verplaatsen of verwijderen is destructief en wacht op akkoord. Let op: `ICON_VERSION.txt` hoort hier níét bij — die kan door de icon-scripts gebruikt worden. |
| L-8 | `body{overflow-x:hidden}` maskeert echte overflow | **Open.** Uitzetten legt overflowbugs bloot die dan per component opgelost moeten worden; dat is zichtbaar werk dat op een toestel gecontroleerd hoort te worden. |

## Nieuw opgemerkt tijdens deze ronde

Niet uit de audit, wel dezelfde soort valkuil als C-1: `window.JFM_ASSET_VERSION` staat als
letterlijke `'81'` in `version.js`, en `scripts/my-mair-preferences-check.mjs` controleert dat
met een hardcoded `/JFM_ASSET_VERSION='81'/`. Een assetbump breekt de poort dus opnieuw, precies
zoals de cachebump dat deed. Drie andere scripts (`app-smoke-check.mjs`,
`predeploy-check.mjs`, en de v362-variant) toetsen nog op `'39'` maar patchen die string eerst
weg, dus die vallen nu niet om. Dezelfde oplossing als bij de cacheversie ligt voor de hand: één
module die de waarde uit `version.js` leest.

## Wat hier niet in staat

Geen enkele wijziging hierboven is op een telefoon getest. `npm run predeploy` is een statische
poort plus gedragsimulaties in Node; die zegt niets over echte playback, het lockscreen,
Spotify-koppeling of Car Mode in een rijdende auto.
