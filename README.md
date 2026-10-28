# Einarmiger Bandit · New York 1925

Tischwerkzeug für *Masken des Nyarlathotep* (Call of Cthulhu 7): ein Spielautomat im Stil der 1920er, statisch, ohne Server.

## Regeln am Tisch

- **Ein Besuch pro In-Game-Tag**, 20 Münzen im Beutel. Gewinne fallen in die Schale und werden nicht nachgeworfen.
- **Kleingeld** (5 ¢): reiner Zeitvertreib, Finanzkraft bleibt.
- **Großer Einsatz** (1 $, zusammen ein Wochenlohn): nur zwei Ereignisse bewegen die Finanzkraft, beide beenden den Besuch sofort:
  - drei Glocken = Jackpot → **+1 Finanzkraft**
  - drei Zitronen = Pechsträhne → **−1 Finanzkraft**
- Am Ende steht eine **Quittung** mit Prüfcode. Der Spielleiter fügt sie unter „Quittung prüfen“ ein; das Werkzeug spielt den Besuch aus dem Seed nach und bestätigt jede Zeile.

## Balance (gemessen mit `node check.mjs`)

| Wert | Ergebnis |
|---|---|
| Jackpot pro Besuch (Großer Einsatz, alle 20 Züge) | ~4,2 % |
| Pechsträhne pro Besuch | ~6,4 % |
| Erwartung | −0,02 Finanzkraft pro Besuch, nach 50 Besuchen ≈ −1 (Streuung ±2) |
| Auszahlungsquote der Münzen | 86 % |

Niemand wird reich, niemand verarmt; das Haus gewinnt leicht.

## Grenzen

Ehrlichkeitsbasis unter Freunden: Der Code ist öffentlich, ein entschlossener Spieler könnte eine Quittung fälschen. Neuladen würfelt nicht neu (der Besuch liegt im `localStorage`), ein privates Fenster aber schon.

## Entwicklung

Kein Build. `node check.mjs` prüft Balance und Quittungsprüfung. Lokal: `python -m http.server` im Ordner.
