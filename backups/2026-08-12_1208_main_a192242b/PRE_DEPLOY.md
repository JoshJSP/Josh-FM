# Josh FM pre-deploy gate

Elke productie-deploy moet eerst deze audit doorlopen. Een FAIL betekent: niet naar `main`.

## Fouten die niet opnieuw mogen terugkomen

1. **Eén Spotify player.** Er mag maar één `new Spotify.Player(...)` in actieve runtime-code bestaan.
2. **Eén transport-eigenaar.** Start, play/pauze, volgende en vorige worden uiteindelijk alleen door `playback-primary.js` afgehandeld. Legacy handlers mogen alleen bestaan als ze daarna door de primary controller worden vervangen.
3. **iPhone user gesture.** `activateElement()` moet direct vanuit de tik worden aangeroepen, vóór een `await`.
4. **Geen destructieve device-transfer.** Voor play/skip/terug mag niet standaard eerst `play:false` naar het actieve Josh FM-device worden gestuurd. Alleen transfereren wanneer het device werkelijk verschilt, en de bestaande speelstatus behouden.
5. **Spotify-acties verifiëren.** Play/pauze/next/previous zijn pas geslaagd nadat Spotify de nieuwe state bevestigt. Bij mislukking moet de UI een fout tonen.
6. **Jingle/DJ music-first.** Een DJ-break mag muziek pas pauzeren als audio voorbereid is. Bij TTS/Fish-fout blijft of hervat muziek. De startjingle komt vóór de muziekstart.
7. **Top 40 uniek.** Deduplicatie gebeurt op genormaliseerde titel + artiest(en), niet alleen op Spotify track-ID. Meerdere releases van hetzelfde nummer tellen als één hitlijstpositie.
8. **Top 40 apart wisbaar.** De knop onder Instellingen wist alleen Top 40-telemetrie/snapshot en niet de Spotify-koppeling of ander persoonlijk geheugen.
9. **PWA cache meenemen.** Bij runtimewijzigingen moet de service-worker cacheversie omhoog en moeten nieuwe kernscripts in `CORE` staan.
10. **Geen tijdelijke testbestanden.** `.noop`, `.placeholder` en vergelijkbare deploy-trigger/testbestanden horen niet in een releasewijziging.
11. **Geen fix op één tijdelijke externe fout.** Een eenmalige Fish/Spotify-fout eerst reproduceren. Externe transient errors niet verwarren met een structurele appbug.
12. **Station Health controleren.** Voor productie moeten de essentiële controllerchecks PASS zijn; relevante WARNs moeten verklaard zijn.
13. **Deploystatus controleren.** Na merge naar `main` geldt een deploy pas als afgerond wanneer Vercel `success/Ready` meldt.

## Verplichte volgorde

1. `npm run predeploy`
2. Diff van branch tegen `main` controleren op onverwachte bestanden.
3. Playback-architectuur controleren: één SDK-player en één primary transport-controller.
4. iPhone/PWA-flow controleren: Start → jingle → muziek → play/pauze → volgende → vorige.
5. DJ-test: Fish stem → DJ-break → gegarandeerde hervatting muziek.
6. Top 40-test: geen duplicaten en `Wis Top 40` onder Instellingen.
7. Station Health Self Test uitvoeren.
8. Pas daarna naar `main` en Vercel-status controleren.
