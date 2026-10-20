# Verbeterplan MAIRFM

Doel: MAIRFM is een radio die gewoon doorspeelt, ook met het scherm uit en in de auto. De DJ en het nieuws zijn er als extra. Valt een extra weg, dan speelt de muziek door.

Volgorde van belang (uit CLAUDE.md): muziek blijft spelen, wachtrij klopt, Spotify-sessie blijft, DJ-timing, stem, achtergrond/iPhone, Car Mode, diagnostiek, uiterlijk, nieuwe functies.

## Wat we weten (20-10-2026)

- Uit de Vercel-logs van 18 t/m 20 oktober: om 12:00 werd het journaal acht keer opgehaald en niet gehoord. Om 13:00 werd het opgehaald, daarna stopte de app met verzoeken (scherm uit of app dicht).
- Elke stem-aanvraag faalde eerst bij Edge ("non-101") en ging dan naar Fish. Microsoft heeft de token veranderd.
- In twee dagen geen enkele aanvraag naar /api/dj-writer. De DJ praat bewust niet met het scherm uit (BACKGROUND_DJ=false in mair-dj-v2.js en mair-background-guard.js, sinds 15-10). Josh luistert vooral met het scherm uit, dus hij hoort de DJ bijna nooit.

## Scherm uit op iPhone: wat kan en wat niet

- Werkt (gebouwd, moet nog op de iPhone getest): speelt de muziek via de MAIRFM-speler in de app zelf, dan blijft de pagina met het scherm uit draaien. Dat zie je in de logs: om 6 uur 's nachts liep de app elke 15 seconden door. Het nieuws wordt dan op de achtergrond klaargezet. Bij de eerste wissel gaat de muziek zachter, komt het nieuws eroverheen en gaat het volume terug. Spotify wordt niet gepauzeerd.
- Onzeker: iOS kan weigeren om met het scherm uit een nieuw geluid te starten. Dan gaat het volume meteen terug en blijft het nieuws staan tot het scherm weer aan gaat.
- Werkt niet: speelt de muziek in de Spotify-app (Spotify Connect), dan bevriest iOS de web-app na ongeveer 30 seconden. Dan draait er niets meer, dus ook geen nieuws. Dat kan een web-app niet oplossen.
- Werkt niet: het nieuws in de Spotify-stroom zelf zetten. Die stroom is beveiligd en zit in een venster van Spotify zelf.
- Media Session API helpt hier niet. Die regelt alleen de knoppen en de tekst op het vergrendelscherm, geen nieuw geluid.
- Echt oplossen kan alleen met de native app (Capacitor in ios/) met een audio-sessie die blijft lopen. Die keep-alive bestaat al, maar staat uit.

## Stappen

- [x] Nieuws: niet meer blokkeren door de backoff van de DJ-stem (dj-audio-guard). Eén journaal per uur, niet elke 45 seconden een nieuw.
- [x] Nieuws: klaarzetten mag met het scherm uit.
- [x] Nieuws met het scherm uit: muziek zachter, nieuws eroverheen, niet pauzeren. Bij weigering volume terug. Pauzeert iOS Spotify toch, dan zet de app hem weer aan.
- [x] Nieuws: time-out van 25 s op het journaal-verzoek.
- [x] Edge-stem weer werkend: Sec-MS-GEC v2 (port van edge-tts 7.3.1), met check tegen het Python-origineel.
- [x] e2e draait ook op de VM (MAIR_E2E_BUNDLED=1, Chromium van Playwright).
- [x] e2e: newsGuardBackoff, newsScreenOff, newsScreenOffRefused, newsScreenOffInterrupt.
- [ ] Luistertest op de iPhone: uurnieuws met scherm aan, en met scherm uit (zie de Courant).
- [ ] Werkt het nieuws met het scherm uit op de iPhone, dan de DJ-break op dezelfde manier (zachter in plaats van pauzeren) zodat de DJ ook met het scherm uit praat.
- [ ] Werkt het niet: native app met keep-alive aanzetten en testen (BACKGROUND_DJ), of accepteren dat nieuws alleen met het scherm aan komt.
- [ ] Edge kan weer veranderen. Een dagelijkse check die één korte zin via Edge maakt en een melding geeft als hij faalt.
- [ ] Diagnostiek: het nieuws-status (lastError, bgRefused) zichtbaar in de diagnostiek, zodat we na een rit kunnen zien waarom het stil bleef.

## Testronde 20-10-2026

Getest met Playwright (MAIR_E2E_BUNDLED=1) op de VM:
- predeploy: alles groen.
- playback e2e (start, DJ-break, stem kapot, writer kapot, skip, achtergrond, sessie, nieuws): 153 ok, 0 mislukt.
- rondgang e2e (alle tabbladen, zender wisselen, DJ-schakelaar en nieuws, stem kapot, rare tekst, CSP): 14 ok.
- Car Mode e2e: 522 ok, 2 mislukt. Sleep e2e: 86 ok, 1 mislukt. sw-update: 5 ok.

- [x] Gevonden: onder het nummer stond "Current past in de komende MAIR-programmering" (interne code op het scherm). Nu Nederlands.
- [x] Gevonden: e2e kon niet op de VM draaien (geen Google Chrome op arm64). Nu met MAIR_E2E_BUNDLED=1.
- [ ] Layout-checks die op de VM-browser net niet passen: Car Mode C2 667x375 aanwijzingstekst, Car Mode "na herstel: pijl en kaart volgen", Sleep-knoppen op 390x844 (811-853 van 844). Zelfde uitkomst op main zonder mijn wijzigingen, dus niet door deze ronde. Op de laptop met echte Chrome nog eens draaien (Hestia).
