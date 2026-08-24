# MAIR installeren op iPhone

1. Open de gedeployde MAIR-URL in Safari.
2. Ga naar `Instellingen` en kopieer de getoonde Redirect URL.
3. Voeg die URL exact toe aan Redirect URIs in je Spotify Developer-app.
4. Zorg dat `SPOTIFY_CLIENT_ID`, `GROQ_API_KEY` en `FISH_AUDIO_API_KEY` als Vercel Environment Variables zijn ingesteld en redeploy na een wijziging.
5. Kies in MAIR `Koppel Spotify` en rond Spotify OAuth af.
6. Start MAIR eenmaal via een zichtbare tik; daarmee mag iOS muziek en DJ-audio afspelen.
7. Kies in Safari Deel → `Zet op beginscherm`.

De DJ-writer gebruikt Groq; Fish Audio verzorgt de vier Nederlandse DJ-stemmen. `OPENAI_API_KEY` is alleen nodig voor optionele discovery- en categoriefilters, niet voor DJ-copy of TTS.

Bij problemen open je `Instellingen` → `Diagnose`. Controleer daar Spotify-device, playback, queue, DJ-writer, stem en TTS-status. `Herstel MAIR` synchroniseert veilig cache, device, playerstate en wachtrij zonder persoonlijke voorkeuren te wissen.

iOS kan een PWA in de achtergrond tijdelijk bevriezen. Spotify-playback kan doorlopen; bij terugkeer synchroniseert MAIR opnieuw. Als Safari audio blokkeert, open MAIR en tik eenmaal op play.

Zet nooit API-keys, Spotify-tokens of credentials in GitHub, frontendcode of gedeelde logs. Gebruik uitsluitend server-side Environment Variables.
