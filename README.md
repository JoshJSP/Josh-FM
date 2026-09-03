# MAIR

MAIR is een persoonlijke Nederlandse AI-radio boven op een Spotify Premium-account. De app programmeert een doorlopende radioset, beheert verzoeken en voegt op natuurlijke trackovergangen korte DJ-breaks toe.

## Architectuur

- Spotify OAuth gebruikt PKCE; er staat geen Spotify client secret in de browser.
- Eén Spotify Web Playback SDK-instance registreert het afspeeldevice.
- `playback-primary.js` is eigenaar van play/pause/previous/next, natuurlijke overgangen en herstel.
- `queue-core.js` serialiseert queue-wijzigingen; Spotify blijft de bron voor wat daadwerkelijk als volgende klaarstaat.
- `mair-dj-v2.js` plant en speelt DJ-breaks. `mair-dj-schedule-sync.js` levert één gededupliceerd fallback-signaal als een primair trackeinde-event ontbreekt.
- `/api/dj-writer` genereert uitsluitend Nederlandse DJ-copy via Groq. Als de writer faalt, blijft de muziek spelen en gebruikt MAIR een korte lokale Nederlandse fallback.
- `/api/tts` genereert MP3 via Fish Audio. Elke DJ heeft een eigen Nederlandse voice; ongeldige audio, timeouts en voicefouten blokkeren de muziek niet.
- De diagnosekaart toont playback-, queue-, DJ-, writer-, voice-, TTS-, cache- en herstelstatus zonder secrets te tonen.
- De service worker maakt de hoofdinterface installeerbaar als PWA en bewaakt release/cacheversies.

## Environment variables

Configureer secrets uitsluitend in Vercel of een vergelijkbare serveromgeving. Commit nooit keys of tokens.

Vereist voor de volledige ervaring:

- `SPOTIFY_CLIENT_ID`: publieke Spotify-app Client ID. Kan anders lokaal in Instellingen worden ingevoerd.
- `MAPBOX_PUBLIC_TOKEN`: Mapbox Directions + Geocoding voor de navigatie in Car Mode. Dit hoort een publiek `pk.`-token te zijn met een URL-restrictie op het eigen domein, want `/api/config` geeft het runtime aan de browser. Zonder dit token meldt Car Mode "Mapbox-token ontbreekt" en werkt bestemmingszoeken en routering niet; de radio zelf blijft normaal doorspelen.
- `GROQ_API_KEY`: Nederlandse DJ-copy via `/api/dj-writer`.
- `FISH_AUDIO_API_KEY`: Nederlandse DJ-audio via `/api/tts`.

Optioneel:

- `GROQ_DJ_MODEL`: expliciet ondersteund Groq-model. Zonder override probeert MAIR `openai/gpt-oss-120b` en daarna `openai/gpt-oss-20b`.
- `FISH_AUDIO_MODEL`: expliciet Fish-model. Zonder override probeert MAIR `s2.1-pro-free` en daarna `s2-pro`.
- `FISH_AUDIO_VOICE_JOSH`, `FISH_AUDIO_VOICE_MAYA`, `FISH_AUDIO_VOICE_MAX`, `FISH_AUDIO_VOICE_NOAH`: per-DJ voice override.
- `FISH_AUDIO_VOICE_ID`: algemene voice override als geen profieloverride bestaat.
- `OPENAI_API_KEY`: alleen nodig voor discovery/category-endpoints die OpenAI gebruiken; niet voor de DJ-writer of TTS.

Een ontbrekende AI- of TTS-key mag playback niet stoppen. MAIR slaat de break over of gebruikt lokale copy en meldt de oorzaak in Diagnose.

## Spotify en deployment

1. Maak een Spotify Developer-app en kopieer de Client ID.
2. Deploy de repository naar HTTPS; Vercel is ingericht via `vercel.json`.
3. Open de deployment. Kopieer in Instellingen de exacte Redirect URL en voeg die toe aan de Spotify-app.
4. Voeg de environment variables toe en redeploy.
5. Koppel Spotify in MAIR. Spotify Premium is vereist voor Web Playback SDK-streaming.

Wijzigingen worden ontwikkeld op een branch en met `npm run predeploy` gevalideerd. Gebruik een preview/branch deployment voor runtimevalidatie; merge of deploy niet rechtstreeks naar productie zonder bewuste releasebeslissing.

## Testen en diagnose

`npm run predeploy` voert de statische regressiepoort en gedragsimulaties uit voor playback, queue, requests, DJ-scheduling, voice, TTS en API-fouten.

Open in de app `Instellingen` → `Diagnose` voor:

- huidige en volgende track;
- laatste trackevent en Spotify-queue sync;
- DJ-fase, volgende beslissing en fallback-overgangssignalen;
- gebruikte writer/model en stem;
- TTS-status, route en laatste fout;
- playback-herstel, cacheversie en een veilige herstelactie.

## iPhone/PWA

Open de productie-URL in Safari, kies Deel → Zet op beginscherm. Start audio altijd eenmaal vanuit een zichtbare gebruikersactie; iOS vereist dat om audio te ontgrendelen. iOS kan webapps in de achtergrond bevriezen. Spotify kan blijven spelen en MAIR synchroniseert state en herstel bij terugkeer naar de voorgrond.

## Privacy

Spotify tokens, voorkeuren en luisterhistorie worden lokaal in de browser opgeslagen. Serverroutes ontvangen alleen de context die nodig is voor DJ-copy, discovery of spraak. Diagnose toont geen API-keys, OAuth-tokens of volledige credentials.
