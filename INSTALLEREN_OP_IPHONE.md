# Josh FM installeren vanaf je iPhone

De code staat volledig in deze repository. Voor gebruik heb je alleen nog een HTTPS-deployment en je eigen Spotify Client ID nodig.

1. Open Vercel in Safari en log in met GitHub.
2. Importeer de repository `JoshJSP/Josh-FM`.
3. Kies Deploy.
4. Open daarna de Vercel-URL van Josh FM.
5. Ga in Josh FM naar `Instellingen` en kopieer de Redirect URL.
6. Open Spotify for Developers, maak een app en voeg die Redirect URL exact toe aan de Redirect URIs.
7. Kopieer de Spotify Client ID naar Josh FM en kies `Koppel Spotify`.
8. Open de site in Safari en kies Deel -> `Zet op beginscherm`.

## Beste AI-DJ en stem

Voeg in Vercel onder Project Settings -> Environment Variables toe:

`OPENAI_API_KEY` = jouw OpenAI API-key

Optioneel kun je de modellen/stem aanpassen met:

- `OPENAI_TEXT_MODEL=gpt-5-mini`
- `OPENAI_TTS_MODEL=gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE=cedar`

Zonder OpenAI API-key blijft Josh FM werken met ingebouwde Nederlandse fallbackteksten en de Nederlandse stem van het apparaat.

Zet nooit je echte API-key in GitHub, `app.js`, `.env.example` of een ander publiek/bewaard bestand. Gebruik uitsluitend Vercel Environment Variables.
