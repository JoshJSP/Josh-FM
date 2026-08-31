# capacitor-shell

Placeholder `webDir` voor de minimale Capacitor iOS-testwrapper.

Capacitor eist een bestaande `webDir` voor `cap copy` / `cap sync`, ook wanneer de
app via `server.url` een remote origin laadt. Deze map bevat daarom **geen**
MAIRFM-assets: alleen een offline fallbackpagina die zichtbaar wordt als de
remote origin niet bereikbaar is.

De echte app komt van de productie-Vercel-URL in `capacitor.config.json`.
Bundel hier pas MAIRFM-assets als er bewust voor een offline/native bundel
wordt gekozen.
