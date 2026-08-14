# MAIR stability cleanup

Deze branch ruimt de eerste post-release regressies structureel op zonder opnieuw een globale mobiele override te introduceren.

## In scope
- dubbele legacy live/show UI verwijderen bij de bron
- MAIR-branding in radio/PWA runtime herstellen
- iPhone safe-area veilig toepassen via stijl-injectie zonder klikhandlers
- station artwork een niet-zwarte fallback geven
- service-worker cache roteren en oude Josh FM caches verwijderen
- Nederlandse Fish Audio-config behouden
- regressietests toevoegen voor navigatie, TTS click safety, branding en PWA-cache

## Bewust niet gedaan
- geen productie-merge
- geen fullscreen overlay
- geen interval dat onclick-handlers steeds overschrijft
- geen globale click handler met preventDefault/stopPropagation
