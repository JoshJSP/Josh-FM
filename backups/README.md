# Josh FM backups

Voor iedere deployment wordt eerst een volledige snapshot van de huidige production-versie opgeslagen in deze map.

Naamgeving: `YYYY-MM-DD_HHMM_main_<short-sha>`.

Elke snapshot bevat de volledige repository-tree van de versie die op dat moment op `main` stond. Daardoor kan een eerdere production-versie snel worden teruggezet zonder de fixes opnieuw te reconstrueren.

Deployregel: geen update van `main` zonder dat de voorafgaande production-versie hier als snapshot staat.
