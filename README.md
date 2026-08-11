# Josh FM v2

A personal AI radio show on top of your own Spotify account.

## What is included

- Spotify OAuth PKCE: no Spotify client secret in the browser.
- Spotify playback: play/pause/previous/next and generated radio sets.
- Sources: Top Tracks, Recently Played, Saved Tracks and owned/collaborative playlists.
- Spotify Search for requests; requests can be added directly to the Spotify queue.
- English AI DJ that talks naturally between selected tracks, not after every song.
- Talk frequency: Low / Normal / Radio / High.
- Programs: Normal, Morning, Chill, Party, Throwback and Late Night.
- Track facts with source-aware fallbacks.
- Time and optional local weather context.
- Josh FM station IDs/jingles.
- Local skip history so frequently skipped material can be deprioritized.
- Browser/device TTS fallback.
- OpenAI serverless endpoint for DJ copy.
- Fish Audio serverless endpoint for the main DJ voice.
- PWA / Add to Home Screen on iPhone.

## AI architecture

Josh FM keeps API secrets on the server.

- `/api/dj` generates the English DJ script with OpenAI when `OPENAI_API_KEY` is configured.
- `/api/tts` turns the script into MP3 speech with Fish Audio.
- Fish Audio voice ID: `b347db033a6549378b48d00acb0d06cd`.
- Fish Audio model: `s2-pro` by default.
- No Fish Audio key is stored in the repository or browser.

## Environment variables

### Required for Fish Audio voice

`FISH_AUDIO_API_KEY`

Add this only as a secret/environment variable on the deployment platform. Never put it in `app.js`, commit it to GitHub, or expose it in frontend code.

### Optional Fish Audio overrides

`FISH_AUDIO_VOICE_ID`

Defaults to:

`b347db033a6549378b48d00acb0d06cd`

`FISH_AUDIO_MODEL`

Defaults to:

`s2-pro`

### DJ text generation

`OPENAI_API_KEY`

Used only by `/api/dj` for the AI-written radio breaks. Without it, Josh FM can fall back to local script generation.

Optional:

`OPENAI_TEXT_MODEL`

## Spotify setup

### 1. Spotify Developer app

Create a Spotify Developer app and copy the Client ID.

### 2. Deploy Josh FM

Deploy this repository to an HTTPS host. Vercel is the intended setup for the serverless `/api/dj` and `/api/tts` routes.

### 3. Redirect URL

Open the deployed Josh FM. In Settings it shows the exact Redirect URL. Add that URL exactly in Spotify Developer Dashboard under Redirect URIs.

### 4. Client ID

Add the Spotify Client ID to Josh FM and connect Spotify.

### 5. Fish Audio

The Fish Audio integration and selected voice are already configured in the code. The final required step is adding `FISH_AUDIO_API_KEY` to the deployment environment and redeploying.

## iPhone

Open the deployed URL in Safari, tap Share, then Add to Home Screen.

iOS can freeze web apps that remain in the background for a long time. Spotify playback itself can continue, but the most reliable DJ experience is with Josh FM active or recently active.

## Privacy

Spotify tokens, preferences and skip history are stored locally in the browser. Serverless routes receive only the context required to generate DJ copy or speech. API keys must remain server-side.
