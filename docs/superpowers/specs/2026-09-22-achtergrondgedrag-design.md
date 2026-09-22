# Achtergrondgedrag: één eigenaar, een wake-protocol en een levende audiosessie

- **Datum:** 22/23-09-2026
- **Branch:** `claude/achtergrondgedrag-20260922`
- **Status:** ontwerp goedgekeurd door Josh (richting B, smalle variant). Nog geen code geschreven.

## 1. De eis

Josh: *"ik wil geen verschil tussen app op scherm en niet"*, en op navraag specifiek
**de DJ moet doorpraten als het scherm uit is**.

Waargenomen vandaag: de muziek speelt door, maar de timing klopt niet, de DJ komt op
een raar moment, en het scherm klopt niet bij terugkomst.

## 2. Gemeten oorzaken

| Meting | Waarde |
|---|---|
| Bestanden met een eigen `visibilitychange` / `document.hidden` | 24 |
| `progress-clock-v226.js` | `setInterval(tick,250)` — iOS knijpt af of bevriest |
| `playback-primary.js` watchdog | `setInterval(...,5000)` — idem |
| `station-clock.js` | 15 s met `Date.now()` — herstelt zichzelf, in orde |
| DJ-planning in `mair-dj-v2.js` | 64× `Date.now()` plus `remaining()` — wandkloktijd, in orde |

De tijdrekening is niet stuk; de coördinatie is dat. Elke module wordt los wakker met
een zelfgekozen vertraging:

```js
playback-primary.js          if(!document.hidden) setTimeout(()=>recover('visible'), 450)
mair-dj-break-owed-guard.js  if(visibilityState==='visible') setTimeout(refresh, 400)
director.js                  if(!document.hidden) paintWhenVisible()
progress-clock-v226.js       if(!document.hidden){ anchor=performance.now() ... }
```

`director.js` tekent op 0 ms met verouderde gegevens; `playback-primary` vraagt Spotify
pas op 450 ms wat er speelt. Vandaar de sprong.

Tweede oorzaak: iOS houdt een webpagina in de achtergrond alleen levend zolang er geluid
uit de pagina zelf komt. De muziek komt uit de Spotify-app, dus vanuit iOS maakt MAIRFM
geen geluid en mag hij slapen. Daarom zwijgt de DJ.

## 3. Wat er al goed staat

- `ios/App/App/Info.plist` bevat al `UIBackgroundModes: [audio]`.
- `playback-primary.js:51` dempt al via `/me/player/volume`.
- `debug-tts.js` ontgrendelt audio al met een stil fragment.
- `mair-dj-v2.js` zet spraak al vooraf klaar (`prepared`, `prepareSpeech`).
- `scripts/background-guard-behavior-check.mjs` bestaat al als testhaak.

Bevestigd door vergelijkbare projecten: TrueRadio (Android, AI-host over eigen Spotify)
lost dit op met een foreground service; agent-radio schrijft expliciet *"iOS forbids
background microphone access for web apps but happily plays a background audio stream
forever."*

## 4. Doel en grenzen

**Succescriterium:** de DJ praat door met het scherm uit in de geïnstalleerde
iPhone-app, en bij terugkomst is er geen inhaalslag, geen late DJ en geen springend
scherm.

**Buiten scope, bewust:**

- Safari/PWA krijgt de keep-alive **niet**. Apple mag die sessie opruimen; een PWA die
  stil batterij verbruikt zonder te werken is erger dan niets.
- De 18 overige `visibilitychange`-luisteraars blijven staan tot ze bewezen schuldig
  zijn. Josh koos expliciet de smalle variant.
- Of de Web Playback SDK in `stability-core.js` op iOS iets doet, is een aparte meting.
- Blokovergangen zijn de volgende ronde, met een eigen ontwerp.

## 5. Ontwerp

### 5.1 Eén eigenaar

`mair-background-guard.js` wordt de enige module die `visibilitychange` bindt. Geen
nieuw bestand: die module claimt de rol al in zijn eerste regel (*"music always wins
when the PWA is hidden"*) en heeft al `snapshot()`, `onVisible()` en `resumeFailOpen()`.

Deze zes leveren hun eigen luisteraar in:

1. `playback-primary.js`
2. `progress-clock-v226.js`
3. `director.js`
4. `mair-dj-break-owed-guard.js`
5. `pwa-platform.js`
6. `live-ui.js`

### 5.2 Wake-protocol

Over de bestaande `mair:*`-eventbus (waar al tien events op lopen):

- `mair:sleep` zodra het scherm uitgaat.
- `mair:wake` bij terugkomst, in drie fases, één tijdlijn bij de eigenaar.

| Fase | Wie | Wat |
|---|---|---|
| 1. `reconcile` | `playback-primary` | praat met Spotify, stel de waarheid vast |
| 2. `refresh` | `mair-dj-break-owed-guard` | haal op wat verouderd is |
| 3. `paint` | `director`, `progress-clock-v226`, `pwa-platform`, `live-ui` | teken pas nu |

Abonneren met `addEventListener('mair:wake', ...)` plus een controle op
`e.detail.phase`. Geen nieuw registratiesysteem.

Eerst weten, dan tonen. Dat is de kern.

### 5.3 Keep-alive

**Plaats: `debug-tts.js`.** Let op — een eerdere versie van dit ontwerp zei
`ios-dj-audio.js`; dat is fout. Dat bestand is een uitgezette dubbele stembrug die
nergens geladen wordt, en `scripts/dj-v2-regression.mjs` bewaakt actief dat het uit
blijft:

```js
ok(... && !resume.includes("s.src='./ios-dj-audio.js"),
   'Duplicate iOS voice bridge must remain disabled');
```

`debug-tts.js` is de actieve stemroute (geladen in `index.html`, vier audio-aanroepen)
en draagt dezelfde `SILENT`-constante en ontgrendelcode.

| | Nu | Straks |
|---|---|---|
| Stiltefragment | 44 bytes (enkele ms) | circa 10 s, zodat de lus niet duizenden keren per seconde herstart |
| `audio.loop` | niet gebruikt | `true` |
| Na afspelen | `pause()` | blijft lopen |
| Actief wanneer | bij ontgrendelen | alleen als `window.Capacitor?.isNativePlatform?.()` |
| Aan/uit gekoppeld aan | niets | `expectedLive` uit `playback-state.js` |

De keep-alive luistert bewust **niet** naar `mair:sleep`; juist dan moet hij doorlopen.
Hij stopt alleen als `expectedLive` uit gaat, in een `finally`.

## 6. Storingsgedrag

Leidend blijft `CLAUDE.md`: *"Music must keep playing when AI/TTS features fail."*

| Storing | Gedrag |
|---|---|
| `window.Capacitor` ontbreekt | keep-alive slaat over, app werkt als nu, regel in de diagnostiek |
| iOS ruimt de sessie toch op | DJ zwijgt tot terugkomst; `mair:wake` herstelt volgens 5.2 |
| Keep-alive blijft hangen | `expectedLive` uit stopt hem altijd, ook bij een fout |
| Fase 1 faalt | fase 2 en 3 gaan door met een `WARNING` (fail-open, als `resumeFailOpen()`) |

## 7. Aanname die eerst gemeten wordt

`capacitor.config.json` laadt de app via `server.url` van `https://josh-fm.vercel.app`,
met `limitsNavigationsToAppBoundDomains: false`. Capacitor injecteert zijn brug normaal
ook in een externe pagina, maar dat is in deze opstelling niet vanzelfsprekend.

**Daarom eerst:** een regel die de uitkomst van `window.Capacitor?.isNativePlatform?.()`
in de diagnostiek zet, vóór er gedrag aan hangt. Faalt die aanname, dan is de keep-alive
niet stuk maar nooit actief — precies het soort stille mislukking dat je pas na een rit
ontdekt.

## 8. Testen

Uitbreiding van `scripts/background-guard-behavior-check.mjs`, dat al aan
`npm run background-behavior` hangt. Geen nieuw testraamwerk.

**Aantoonbaar zonder telefoon:**

1. De eigenaar is de enige die `visibilitychange` bindt; de zes andere binden niets meer.
2. `mair:wake` vuurt de drie fases in volgorde.
3. Fase 1 faalt: fase 2 en 3 gaan toch door.
4. Keep-alive start bij `expectedLive` en stopt gegarandeerd bij uit.
5. Zonder `Capacitor` start de keep-alive niet.

Daarna `npm run predeploy` in zijn geheel.

**Alleen Josh kan aantonen:** of de DJ daadwerkelijk praat met de telefoon op slot.

Dit staat er expliciet omdat het eerder misging: 27 groene gedragstests voor de Live DJ
waren simulatie, en niemand had hem gehoord. Groene tests bewijzen dit succescriterium
niet.

## 9. Hierna

1. **Blokovergangen** — de DJ kondigt een wissel van muziekblok aan. Door Josh gekozen
   als volgende ronde. Eigen ontwerp; raakt `station-clock.js`,
   `mair-station-director.js` en `api/dj-writer.js`.
2. De 18 overgebleven `visibilitychange`-luisteraars, als ze last blijken te geven.
3. De meting of de Web Playback SDK op iOS iets doet.
