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

## Car Mode 20-10-2026: ritstart en flitsers

Ritstart-praatje bleef stil:
- [x] Oorzaak: dezelfde als bij het nieuws. De ritstart vroeg de stem via prepareSpeech, en die weigert tijdens de backoff van dj-audio-guard (30 s tot 5 min na één mislukte DJ-stem) zonder verzoek. Doordat Edge kapot was, mislukte er vaak een stem en stond die backoff vaak aan. Nu gaat de ritstart direct naar de TTS. e2e rideintrobackoff (oude code faalt).
- [x] Zelfde gat bij het welterusten van Sleep, ook gefixt.
- [ ] Let op: het praatje komt alleen als je een route start (Start-knop). Car Mode openen zonder route geeft geen praatje. Dat is zo gebouwd; zeg het als dat anders moet.

Flitsers:
- [x] Bron is OpenStreetMap via Overpass (node highway=speed_camera en enforcement-relaties), per vak van ~11 x 10 km, 40 km vooruit langs de route.
- [x] Fout gevonden: de vraag eindigde op `out tags geom`. Dan geeft Overpass relaties zonder leden terug. Alle 80 trajectcontroles in NL kwamen daardoor binnen als losse flitser of helemaal niet. Nu `out body geom`, nieuwe cache-sleutel zodat oude vakken opnieuw worden opgehaald. De nep-Overpass in de e2e doet nu hetzelfde als de echte (oude code: 17 fouten).
- [x] Ook losse punten met alleen enforcement=maxspeed/average_speed (16 in NL) tellen nu mee.
- [x] Josh' route gecontroleerd (auto IJsselstein - Sleeuwijk Tol Oost - Fellenoordstraat Breda, route via OSRM, 66 km; bus 500/502 rijdt door dezelfde strook over de A27). OSM heeft in die hele strook 3 vaste flitsers, de dichtstbijzijnde 810 m van de route (Vianen/IJsselstein 52.0276, 5.0684, 50 km/u; Breda 51.6014, 4.7776, 70 km/u; 52.0061, 4.9624, 80 km/u). Op de route zelf staat in OSM geen enkele vaste flitser. Er bestaat geen officiële open lijst (OM publiceert er geen).
- [ ] Mist Josh een flitspaal die hij kent, dan ontbreekt hij in OpenStreetMap zelf. Toevoegen kan in OSM (highway=speed_camera). Niet zelf verzinnen.
- [ ] De reserve-Overpass (overpass.private.coffee) had op 20-10 data van 15-07. De VM krijgt 406 van overpass-api.de, dus de echte telefoon-route is niet vanaf hier te testen.
- [ ] Rit-test in de auto staat in de Courant.

