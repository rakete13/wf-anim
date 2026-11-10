# WF Anim

Attribut-basierte GSAP-Animationen für Webflow. Element auswählen, unter **Custom Attributes** `data-anim` mit einem Wert wie `fade-up` setzen, fertig.

Die Übersicht aller Animationen mit Live-Demo liegt in [`docs/index.html`](docs/index.html).

## In ein Webflow-Projekt einbauen

1. **GSAP aktivieren:** im Projekt unter *Settings → GSAP integration* GSAP einschalten und die Plugins **ScrollTrigger, SplitText, ScrambleText und DrawSVG** anhaken.
2. **Head Code:** Inhalt von [`webflow/head-code.html`](webflow/head-code.html) in *Site Settings → Custom Code → Head Code* einfügen.
3. **Footer Code:** Inhalt von [`webflow/footer-code.html`](webflow/footer-code.html) in *Site Settings → Custom Code → Footer Code* einfügen.
4. Veröffentlichen. Custom Code läuft nur auf der veröffentlichten Seite, nicht im Designer.

Die Library ist komplett in den Footer Code eingebettet. Ein Webflow-Projekt hängt dadurch weder an diesem Repo noch an einem externen Server.

### Alternative: aus GitHub laden

Statt des langen Footer Codes reicht diese eine Zeile (Head Code und GSAP-Integration bleiben gleich):

```html
<script src="https://cdn.jsdelivr.net/gh/rakete13/wf-anim@1.2.0/src/wf-anim.min.js"></script>
```

Bequem für eigene und betreute Projekte. Die Seite hängt dann aber an diesem Repo und an jsDelivr, und die IP-Adresse der Besucher geht an jsDelivr (in der Datenschutzerklärung erwähnen). Bei Übergabe an einen Kunden besser auf den eingebetteten Footer Code wechseln.

## Startbildschirm und Intro

Elemente, die beim Laden schon im sichtbaren Bereich (oder darüber) liegen, bleiben ruhig und sind sofort sichtbar. Animiert wird nur, was beim Scrollen neu ins Bild kommt. Das verhindert Aufblitzen, verbessert die Ladezeit-Werte und ist besser für Screenreader.

Soll ein Element im Startbildschirm trotzdem animieren (z. B. die Hero-Headline), bekommt es zusätzlich das Attribut `data-anim-intro`. Dafür ist der Head Code nötig.

## Barrierefreiheit

- Noch nicht eingeblendete Elemente sind nur durchsichtig (`opacity: 0`), nicht versteckt. Screenreader lesen sie vor, die Browser-Suche findet sie.
- Bekommt ein Link oder Button in einem noch unsichtbaren Element den Tastatur-Fokus, erscheint das Element sofort.
- `counter` und `scramble` geben Screenreadern immer den fertigen Text.
- Bei aktivierter Systemeinstellung „Bewegung reduzieren“ wird nichts animiert.

## Animationen

| Kategorie | Werte für `data-anim` |
|---|---|
| Reveals | `fade-in` `fade-up` `fade-down` `fade-left` `fade-right` `scale-in` `blur-in` `clip-up` `clip-down` `clip-left` `clip-right` |
| Gruppen | `stagger` `grid-stagger` |
| Text | `split-lines` `split-words` `split-chars` `scramble` `highlight` |
| Scroll | `parallax` `parallax-element` `image-zoom` `text-fill` `progress-bar` `pin` `horizontal` |
| Funktional | `counter` `marquee` `draw-svg` |

Globale Modifier: `data-anim-intro`, `data-anim-delay`, `data-anim-duration`, `data-anim-ease`, `data-anim-start`, `data-anim-end`, `data-anim-distance`, `data-anim-stagger`, `data-anim-repeat`, `data-anim-scrub`, `data-anim-mobile="false"`. Details und alle Optionen je Animation stehen in der Doku.

## Hover-Effekte

Eigenes Attribut `data-hover` an die Card oder den Button, mehrere Effekte mit Leerzeichen trennen:

```
card-item        ← data-hover = img-zoom lift arrow
  ├── img-wrapper
  │     └── img    ← wird skaliert (automatisch)
  └── card-body
        └── icon   ← data-hover-target = arrow
```

| Bereich | Werte für `data-hover` |
|---|---|
| Bilder | `img-zoom` `img-zoom-out` `img-darken` |
| Cards | `lift` `reveal` `tilt` |
| Links & Buttons | `underline` `arrow` `fill` `text-roll` `magnetic` |

- Das Ziel findet die Library selbst (Bild-Effekte: erstes `img`, sonst das Element selbst). Ein anderes Ziel markierst du mit `data-hover-target`, bei mehreren Effekten mit dem Namen als Wert (`data-hover-target="arrow"`). `reveal` braucht immer ein markiertes Ziel.
- Modifier: `data-hover-scale`, `data-hover-brightness`, `data-hover-distance`, `data-hover-shadow`, `data-hover-color`, `data-hover-text-color`, `data-hover-direction`, `data-hover-thickness`, `data-hover-strength`, `data-hover-max`, `data-hover-duration`, `data-hover-ease`. Sie können an der Card oder am Ziel stehen.
- Läuft mit Maus/Trackpad und bei Tastatur-Fokus. Auf Touch-Geräten aus. Bei „Bewegung reduzieren“ bleiben nur Farbeffekte.
- `data-anim="magnetic"` und `data-anim="tilt"` aus Version 1.0/1.1 funktionieren weiter.
- Webflow-Dropdowns nutzen selbst `data-hover`, dort keinen Effekt setzen.

Beim Ausdünnen per `build.js` bekommen Hover-Effekte das Präfix `hover:`, z. B. `node build.js fade-up,hover:img-zoom`.

## Aufbau

```
src/wf-anim.js         Quellcode der Library
build.js               erzeugt den Webflow-Code (voll oder ausgedünnt)
webflow/head-code.html fertiger Head Code
webflow/footer-code.html fertiger Footer Code (Vollversion)
docs/index.html        Doku- und Demo-Seite
```

## Ausgedünnte Version bauen

Für ein Projekt, das nur einige Animationen nutzt:

```bash
node build.js fade-up,parallax,counter ./ausgabe-ordner
```

Benötigt Node.js und TypeScript (`npm i -g typescript`). Ohne Ordnerangabe wird die Vollversion nach `webflow/` geschrieben.

## Versionen

Stabile Stände werden als Release markiert (`1.0.0`, `1.1.0`, …). Bestehende Webflow-Projekte ändern sich nicht automatisch, ein Update wird bewusst neu eingefügt.
