# MAIR pre-deploy gate

Elke productie-deploy moet eerst deze audit doorlopen. Een FAIL betekent: niet naar `main`.

## Herstelpunt vóór iedere deploy

MAIR bewaart **geen volledige repositorykopieën meer in een `backups/` map**. Git is de bron voor versiegeschiedenis en rollback.

Voordat de update branch naar `main` wordt gemerged, wordt de huidige `main` commit-SHA gecontroleerd en blijft die commit het directe herstelpunt. Een rollback gebeurt door die vorige productiecommit opnieuw als release te gebruiken of de release-merge terug te draaien. Zo houden we geen honderden dubbele bestanden in de actieve repository.

## Fouten die niet opnieuw mogen terugkomen

1. **Eén Spotify player.** Er mag maar één `new Spotify.Player(...)` in actieve runtime-code bestaan.
2. **Eén transport-eigenaar.** Start, play/pauze, volgende en vorige worden uiteindelijk alleen door `playback-primary.js` afgehandeld.
3. **Eén MediaSession-eigenaar.** Alleen `pwa-platform.js` schrijft metadata, playbackState en position state voor iPhone/lockscreen. De Spotify SDK krijgt `enableMediaSession:false`.
4. **iPhone user gesture.** `activateElement()` moet direct vanuit de tik worden aangeroepen, vóór een `await`.
5. **Geen destructieve device-transfer.** Voor play/skip/terug mag niet standaard eerst `play:false` naar het actieve MAIR-device worden gestuurd.
6. **Spotify-acties verifiëren.** Play/pauze/next/previous zijn pas geslaagd nadat Spotify de nieuwe state bevestigt.
7. **Natuurlijk track-einde blijft live.** Als Spotify/iOS na het einde van een track gepauzeerd blijft staan, moet MAIR direct één keer naar de volgende station-track gaan.
8. **DJ-overgang is veilig en hoorbaar.** De DJ-break mag pas als voltooid gelden nadat de stem werkelijk is afgespeeld; mislukte breaks blijven pending voor een veilige retry.
9. **Top 40 uniek.** Deduplicatie gebeurt op genormaliseerde titel + artiest(en), niet alleen op Spotify track-ID.
10. **PWA cache meenemen.** Bij runtimewijzigingen moet de service-worker cacheversie omhoog en moeten nieuwe kernscripts in `CORE` staan.
11. **Geen tijdelijke deploybestanden.** `.noop`, `.placeholder`, `.vercel-redeploy`, build-triggerbestanden en vergelijkbare bestanden horen niet in een release.
12. **Geen repository-backupmap.** Herstel loopt via Git; `backups/` hoort niet in de actieve tree.
13. **Geen fix op één tijdelijke externe fout.** Externe transient errors niet verwarren met een structurele appbug.
14. **Station Health controleren.** Voor productie moeten de essentiële controllerchecks PASS zijn.
15. **Deploystatus controleren.** Na update van `main` geldt een deploy pas als afgerond wanneer Vercel `success/Ready` meldt.

## Verplichte volgorde

1. Noteer/controleer de huidige productiecommit op `main` als rollbackpunt.
2. `npm run predeploy` op de update branch.
3. Diff van update branch tegen `main` controleren op onverwachte bestanden.
4. Playback-architectuur controleren: één SDK-player, één primary transport-controller en één MediaSession-eigenaar.
5. iPhone/PWA-flow controleren: Start → jingle → muziek → play/pauze → volgende → vorige → natuurlijk einde gaat automatisch door.
6. DJ-test: geplande break → hoorbare voice → muziek veilig hervat; bij failure blijft break pending.
7. Lockscreen-test: correcte titel/cover en realistische verstreken/resterende tijd.
8. Strikte stations controleren, met extra aandacht voor Nederlandstalig en jaartalcategorieën.
9. Station Health Self Test uitvoeren.
10. Alleen na expliciete toestemming de update branch naar `main` mergen en Vercel-status controleren.

Laatste handmatige productie-retrigger: 2026-08-15 20:46 CEST.