# Nachtronde 12-10-2026

Branch `claude/nachtronde-20261012`, gemerged naar `main`. Tests en `npm run predeploy` groen, `npm run e2e` groen (59 checks).
Echt luisteren met Spotify op een toestel is niet gedaan. Dat moet Josh zelf doen.

## Wat er al klaarstond

`main` liep achter op de live deploy. De branch met de achtergrondreparaties, de DJ-keten en de AI-poort
(`claude/ai-routes-20261007`) was nooit gemerged maar wel live gezet. Dat staat nu gelijk.

## Kapot en gerepareerd

Elk punt hieronder is eerst met `npm run e2e` of een test stuk gezien en daarna groen.

- Een skip tijdens een DJ-break telde als Fish-storing. Daarna zweeg de DJ 30 seconden tot 5 minuten (`dj-audio-guard.js`).
- Faalde het volumeherstel na een break halverwege, dan bleef de muziek op ongeveer 16% hangen (`playback-primary.js`).
- Een mislukte devices-lookup (429, timeout) koppelde de werkende speler los (`stability-core.js`).
- Een dubbele tik op een zoekresultaat gaf twee verzoeken van hetzelfde nummer (`request-manager.js`).
- Gedeeltelijk director-geheugen gaf een TypeError elke drie seconden (`director.js`).
- De discovery-slider begon op 0% in plaats van 50% bij een verse start (`discovery.js`).
- De slaaptimer werd weggegooid als de pagina bevroor en pas terugkwam na het verlopen (`mair-sleep.js`).
  Een mislukte pauze werd ook elke halve seconde herhaald.
- Terug uit de achtergrond op hetzelfde nummer telde als nieuwe start en soms dubbel als voltooid (`personal-top40.js`).
- De update-controle kon in een lus lopen van elke 350 ms (`version.js`).
- Een nieuwe service worker herlaadde de pagina midden in een nummer (`pwa-platform.js`).
- Het Spotify-SDK ging door de 10-seconden-afbreker van de service worker (`sw.js`).
- De kop op Radio, Stations en Profiel zat onder de zwarte afdekking boven in beeld.
- De hoes op een laptop was zo groot dat de afspeelknop onder de vouw stond.
- Het inlogscherm, de zoekknop en de verzoektelling waren nog blauw. De tegels op het inlogscherm hadden twee maten.
- De labels in de onderbalk waren 8 en 11 pixels. Nu allemaal 10.
- Elke paginalaad deed vier TTS-health-aanroepen voor een kaart die niemand ziet (`mair-voice-lab.js`).
- Passenger en Profiel tekenden zichzelf opnieuw onder je vingers (QR knipperde, slider brak af).
- Een verlopen QR-link liet een passagier niet meer een andere code invullen.
- Er stond "Koppel Spotify" terwijl Spotify al gekoppeld was.
- Beveiliging: `/api/tts` en `/api/fact` zitten nu achter dezelfde poort als de AI-routes. De DJ-prompt noemt
  titels en artiesten als data. Sessiecodes zijn echt willekeurig. Het foutlog wist e-mail en OAuth-codes.
  De service worker bewaart geen inlog-URL's meer.

## Nieuw

- Sneltoetsen op de Radio-tab: spatie, pijl links en rechts, pijl omhoog en omlaag voor het volume.
- Deel je week: Profiel, Deel je week. Maakt een plaatje van je weekoverzicht.
- De DJ-stem volgt de volumeschuif (begonnen in de wip-commit van de dj-test-branch). Op iPhone is het volume van een
  audio-element vast. Daarom schaalt `mair-voice-gain.js` de samples zelf voor het afspelen, zodat het ook daar werkt.
  Bij elke fout speelt de originele stem. Alleen in headless Chrome met een iPhone-useragent getest, niet op een echte iPhone.
- De slaaptimer faadt acht seconden uit voor hij pauzeert.
- Car Mode houdt het scherm aan zolang het open staat.
- Foutlog kopiëren in Diagnostiek.
- Zachte entree voor de verzoek-sheet, de DJ-sheet en de slaapweergave.
- `npm run e2e`: de echte app tegen een nep-Spotify (`scripts/e2e/`).

## Bewust niet gedaan

- `window.queue` bestaat niet. `personal-learning-v4.js` en `music-intelligence-v3.js` lezen die en doen daardoor niets.
  Aanzetten verandert wat de zender speelt. Dat is een keuze van Josh.
- 429-afhandeling in `playback-primary.js` (`remote()` slikt de fout). Zonder echt toestel te riskant.
- Opnieuw koppelen met een oude refresh-token (`app.js`, `stability-core.js`). Raakt de inlog.
- Tussenstops blijven in de Car Mode-route na aankomst.
- Uurjournaal op apparaattijd in plaats van Europe/Amsterdam.
- `MAIR_ALLOWED_SPOTIFY_USERS` zetten. Dat is een Vercel-variabele en dus aan Josh.
- Een review-vondst over MY MAIR bleek niet te kloppen en is niet doorgevoerd.

## Zelf testen

Zie het rapport op het Bureaublad.
