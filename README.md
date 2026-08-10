# Josh FM v2

Een persoonlijke Nederlandse radioshow bovenop jouw eigen Spotify-account.

## Wat zit erin

- Spotify OAuth PKCE: geen Spotify client secret in de browser.
- Spotify playback: play/pauze/vorige/volgende en radiosets.
- Bronnen: Top Tracks, Recent Played, Saved Tracks en eigen/collaboratieve playlists.
- Spotify Search voor verzoeknummers; verzoek gaat rechtstreeks naar de Spotify queue.
- Nederlandse DJ die willekeurig praat, niet na ieder nummer.
- Praatfrequentie: Weinig / Normaal / Radio / Veel.
- Programma's: Normaal, Ochtend, Chill, Party, Throwback en Late night.
- Gecontroleerde trackfeitjes: eerst Nederlandse Wikipedia; fallback naar Spotify album/release-metadata.
- Feitenbron wordt zichtbaar bij het DJ-moment.
- Tijd en optioneel lokaal weer.
- Josh FM station-ID/jingles.
- Lokale skiphistorie; vaak geskipt materiaal krijgt minder prioriteit in een nieuwe radioset.
- Gratis Nederlandse apparaatstem.
- Optionele natuurlijkere AI-DJ + AI-stem via OpenAI serverless endpoints.
- PWA / Zet op beginscherm op iPhone.

## Belangrijke Spotify-2026 beperking

Development Mode vereist voor de app-eigenaar Spotify Premium en nieuwe apps hebben maximaal vijf geautoriseerde gebruikers. Dat is prima voor persoonlijk gebruik.

Playlist-inhoud is in Development Mode in 2026 alleen beschikbaar voor playlists die de ingelogde gebruiker bezit of waarop die gebruiker collaborator is. Josh FM v2 houdt hier rekening mee.

Spotify Content wordt niet gemixt, gewijzigd of gebroadcast. De DJ-break pauzeert Spotify, praat, en hervat Spotify daarna.

## Snelste installatie

### 1. Spotify Developer app
Maak één Spotify Developer-app, kopieer de Client ID.

### 2. Zet Josh FM online
Deploy de map naar een HTTPS-host. Vercel is de eenvoudigste optie voor de optionele `/api/dj` en `/api/tts` serverless functies.

### 3. Redirect URL
Open de online Josh FM. Onder Instellingen toont hij zijn exacte Redirect URL.
Voeg die URL exact toe in Spotify Developer Dashboard -> Redirect URIs.

### 4. Client ID
Plak de Spotify Client ID in Josh FM en kies `Koppel Spotify`.

### 5. Optioneel AI
Zonder OpenAI-key werkt Josh FM al: de tekst heeft een lokale fallback en de stem gebruikt iOS/browser TTS.
Wil je de beste versie, voeg in Vercel de environment variable `OPENAI_API_KEY` toe. De key staat dan niet in de browser.

## iPhone

Open de gedeployde URL in Safari -> Deel -> `Zet op beginscherm`.

iOS kan webapps die lang in de achtergrond staan bevriezen. De betrouwbaarste radiosessie is daarom met Josh FM geopend op de voorgrond of recent actief. De muziek zelf blijft via Spotify lopen.

## Privacy

Spotify tokens, voorkeuren en skiphistorie worden lokaal in de browser opgeslagen. De OpenAI serverless routes krijgen alleen de DJ-context die nodig is om een break/stem te maken. Zet nooit een OpenAI API-key in `app.js`.
