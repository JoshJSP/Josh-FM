# MAIR stability cleanup

Deze branch is de actuele release-candidate voor de kern van MAIR. Productie wordt bewust niet automatisch gemerged.

## Actieve runtime-eigenaren
- Playback/transport: `playback-primary.js`
- Reload hoorbaarheid: `mair-reload-audibility.js`
- DJ state machine/timing: `mair-dj-v2.js`
- DJ copy: `api/dj-writer.js`
- DJ-profielen: `mair-foundation.js` + `mair-dj-profile-polish.js`
- TTS/voice cast: `mair-voice-engine.js` + `api/tts.js`
- Stationselectie: MAIR station controller / station policy
- PWA/cache: `pwa-platform.js` + `sw.js`

Oudere JFM/DJ-bestanden blijven alleen staan waar ze nog als compatibility/fallback worden geladen. Nieuwe fixes mogen geen tweede transport-, DJ- of voice-owner introduceren.

## Deze release-candidate fixt
- vaste Fish Audio-cast per DJ met expliciete voice-override opt-in
- duidelijk verschillende presentatiestijlen voor Josh, Maya, Max en Noah
- radio-clock-aware DJ-copy voor Morning, Daytime, Drive, Evening, Late Night en After Hours
- minder voorspelbare “Dat was X, nu Y”-breaks
- lokale Web Playback SDK-verificatie na reload, ook als Spotify remote al `is_playing=true` meldt
- natuurlijke trackwissel tijdens reload zonder terugspoelen naar de oude track
- reload-audio observability in Diagnose
- service-worker cache rotatie naar v89
- regressietests voor voice cast, DJ personality/radioklok en reload-audibility

## Cleanup
- oude PR #22 en #28 gesloten
- losse voice PR #80 gesloten en vervangen door release PR #81
- runtime ownership expliciet gemaakt in `mair-runtime-core.js`

## Bewust niet gedaan
- geen automatische productie-merge
- geen secrets/API keys aangepast
- geen werkende legacy-bestanden blind verwijderd zolang een compatibility-pad ze nog kan aanspreken
- geen globale click/transport overrides toegevoegd

## Release gate
Voor merge moet `npm run predeploy` volledig groen zijn en de Vercel-preview succesvol bouwen.