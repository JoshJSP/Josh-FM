# Josh FM pre-deploy gate

Elke productie-deploy moet eerst deze audit doorlopen. Een FAIL betekent: niet naar `main`.

## Verplichte backup vóór iedere deploy

**Voordat `main` wordt aangepast, wordt eerst de huidige production-versie volledig opgeslagen in `backups/`.**

Naamgeving: `backups/YYYY-MM-DD_HHMM_main_<short-sha>/`.

De snapshot bevat de volledige repository-tree van de commit die vóór de nieuwe deploy op `main` stond. Geen deploy zonder zo'n herstelpunt. De backup wordt nooit achteraf gemaakt, omdat hij dan niet meer betrouwbaar de vorige production-versie vertegenwoordigt.

## Fouten die niet opnieuw mogen terugkomen

1. **Eén Spotify player.** Er mag maar één `new Spotify.Player(...)` in actieve runtime-code bestaan.
2. **Eén transport-eigenaar.** Start, play/pauze, volgende en vorige worden uiteindelijk alleen door `playback-primary.js` afgehandeld.
3. **Eén MediaSession-eigenaar.** Alleen `pwa-platform.js` schrijft metadata, playbackState en position state voor iPhone/lockscreen. De Spotify SDK krijgt `enableMediaSession:false`.
4. **iPhone user gesture.** `activateElement()` moet direct vanuit de tik worden aangeroepen, vóór een `await`.
5. **Geen destructieve device-transfer.** Voor play/skip/terug mag niet standaard eerst `play:false` naar het actieve Josh FM-device worden gestuurd.
6. **Spotify-acties verifiëren.** Play/pauze/next/previous zijn pas geslaagd nadat Spotify de nieuwe state bevestigt.
7. **Natuurlijk track-einde blijft live.** Als Spotify/iOS na het einde van een track gepauzeerd blijft staan, moet Josh FM direct één keer naar de volgende station-track gaan. De gebruiker hoeft de app nooit opnieuw te openen om muziek te hervatten.
8. **DJ-overgang is mute → DJ → rewind → unmute.** Het volgende nummer moet eerst actief spelen, dan direct op JoshFM-volume 0, Fish praat, dezelfde nieuwe track gaat terug naar 0:00, daarna volume terug naar 1. De queue mag niet worden vervangen of gepauzeerd voor de overgang.
9. **Top 40 uniek.** Deduplicatie gebeurt op genormaliseerde titel + artiest(en), niet alleen op Spotify track-ID.
10. **Top 40 apart wisbaar.** De knop onder Instellingen wist alleen Top 40-telemetrie/snapshot.
11. **PWA cache meenemen.** Bij runtimewijzigingen moet de service-worker cacheversie omhoog en moeten nieuwe kernscripts in `CORE` staan.
12. **Geen tijdelijke testbestanden.** `.noop`, `.placeholder` en vergelijkbare deploy-trigger/testbestanden horen niet in een releasewijziging.
13. **Geen fix op één tijdelijke externe fout.** Externe transient errors niet verwarren met een structurele appbug.
14. **Station Health controleren.** Voor productie moeten de essentiële controllerchecks PASS zijn.
15. **Deploystatus controleren.** Na update van `main` geldt een deploy pas als afgerond wanneer Vercel `success/Ready` meldt.

## Verplichte volgorde

1. Maak volledige backup van de huidige `main` in `backups/YYYY-MM-DD_HHMM_main_<short-sha>/`.
2. `npm run predeploy`.
3. Diff van branch tegen `main` controleren op onverwachte bestanden.
4. Playback-architectuur controleren: één SDK-player, één primary transport-controller en één MediaSession-eigenaar.
5. iPhone/PWA-flow controleren: Start → jingle → muziek → play/pauze → volgende → vorige → natuurlijk einde gaat automatisch door.
6. DJ-test: volgend nummer start → mute → Fish DJ → track terug naar 0:00 → unmute.
7. Lockscreen-test: correcte titel/cover en realistische verstreken/resterende tijd.
8. Top 40-test: geen duplicaten en `Wis Top 40` onder Instellingen.
9. Station Health Self Test uitvoeren.
10. Pas daarna naar `main` en Vercel-status controleren.
