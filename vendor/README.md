# vendor/

Externe bibliotheken die MAIRFM meelevert in plaats van tijdens het gebruik op
te halen. Alleen bestanden die hier niet zelf geschreven zijn.

## qrcode.min.js

- Bibliotheek: qrcodejs 1.0.0 (davidshimjs)
- Opgehaald van: `https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js`
- Datum: 21 september 2026
- sha384: `3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU`

Passenger Mode laadde dit bestand rechtstreeks van het CDN (auditpunt M-7):
niet in de service-worker cache, geen integriteitscontrole, en dus geen QR
zodra de verbinding wegvalt. Dat is precies de situatie waarin Passenger Mode
wordt gebruikt: in de auto, met wisselende dekking.

Het bestand staat nu in `CORE` van `sw.js` en wordt geladen als
`./vendor/qrcode.min.js`. Gecontroleerd op `eval`, `Function()`, netwerk-,
cookie- en opslagtoegang: geen van alle aanwezig. De drie `http://`-adressen
erin zijn XML-namespaces voor de SVG-uitvoer.

Bij vervangen: haal het bestand opnieuw op, noteer de nieuwe sha384 hierboven
en bump de cacheversie in `sw.js` en `api/version.js` in dezelfde commit.
