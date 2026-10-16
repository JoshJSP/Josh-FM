# Sleep Mode: ideeën voor nieuwe features

Per idee: wat het doet, kan het met Spotify en de huidige code, en hoeveel werk (klein / middel / groot). Tussen haakjes staat in welk ontwerp het al te zien is.

1. Zacht uitfaden over langere tijd (ontwerp 3). Het volume zakt 1 tot 10 minuten in kleine stapjes voor de pauze. Kan: nu is er alleen een fade van 8 seconden (fadeOut), langer moet via setVolume in stapjes. Middel, en echt testen op iPhone.
2. Scherm helemaal zwart, tik voor de tijd (ontwerp 1). Alles uit behalve een tik die de klok even laat zien. Kan: puur scherm, geen Spotify nodig. Klein.
3. Rustige DJ zegt welterusten (ontwerp 3). De DJ zegt kort welterusten vlak voor de fade. Kan: DJ en TTS bestaan al, het mag de muziek niet stoppen als het mislukt. Middel.
4. Daarna MAIR SLEEP (ontwerp 2). Eerst je eigen muziek, dan het rustige station tot de timer afloopt. Kan: stationkeuze bestaat al. Klein tot middel.
5. Wakker-scherm (ontwerp 4). Na de pauze kan je met een tik verder, nog 15 min, volgend nummer of MAIR SLEEP. Kan: resume, next en scheduleMinutes bestaan. Klein tot middel.
6. Ruis of regen na de muziek (ontwerp 5). Na de timer speelt een ruis- of regenlijst van Spotify zacht door. Kan via een Spotify-lijst met playUri. Eigen ruis in de browser kan niet, die stopt op iPhone in de achtergrond. Middel.
7. Slaapstatistiek light (ontwerp 4). Een regel met wanneer MAIR deze week gemiddeld stopte. Kan: stopmomenten opslaan op de telefoon. Het meet geen echte slaap. Klein.
8. Onthoud je laatste timer. De knop bovenaan start meteen met de timer van gisteren. Kan: opslag bestaat al. Klein.
9. Ademhalingsbol (ontwerp 5). Een bol die rustig groot en klein wordt in plaats van een klok. Kan: alleen CSS. Moet pauzeren als het scherm dimt voor de accu. Middel.
10. Dubbeltik is nog 15 minuten. In het donker twee keer tikken ipv zoeken naar een knop. Kan: alleen scherm en bestaande timer. Klein.
11. Automatisch dimmen na 8 seconden (ontwerp 1). Dit kan MAIR nu al een beetje. Hier veel donkerder. Let op: de helderheid van de iPhone zelf kan een webapp niet aanpassen. Klein.
12. Wekker die zacht met muziek wekt. Afraden. Een webapp kan een iPhone niet betrouwbaar wakker maken als het scherm uit staat, en Spotify mag niet vanzelf starten. Een gewone wekker van iOS is veiliger. Groot en riskant.
