# WF Anim

Attribut-basierte GSAP-Animationen für Webflow. Element auswählen, unter **Custom Attributes** `data-anim` mit einem Wert wie `fade-up` setzen, fertig.

Die Übersicht aller Animationen mit Live-Demo liegt in [`docs/index.html`](docs/index.html).

## In ein Webflow-Projekt einbauen

1. **GSAP aktivieren:** im Projekt unter *Settings → GSAP integration* GSAP einschalten und die Plugins **ScrollTrigger, SplitText, ScrambleText und DrawSVG** anhaken.
2. **Head Code:** Inhalt von [`webflow/head-code.html`](webflow/head-code.html) in *Site Settings → Custom Code → Head Code* einfügen.
3. **Footer Code:** Inhalt von [`webflow/footer-code.html`](webflow/footer-code.html) in *Site Settings → Custom Code → Footer Code* einfügen.
4. Veröffentlichen. Custom Code läuft nur auf der veröffentlichten Seite, nicht im Designer.

Die Library ist komplett in den Footer Code eingebettet. Ein Webflow-Projekt hängt dadurch weder an diesem Repo noch an einem externen Server.

## Animationen

| Kategorie | Werte für `data-anim` |
|---|---|
| Reveals | `fade-in` `fade-up` `fade-down` `fade-left` `fade-right` `scale-in` `blur-in` `clip-up` `clip-down` `clip-left` `clip-right` |
| Gruppen | `stagger` `grid-stagger` |
| Text | `split-lines` `split-words` `split-chars` `scramble` `highlight` |
| Scroll | `parallax` `parallax-element` `image-zoom` `text-fill` `progress-bar` `pin` `horizontal` |
| Funktional | `counter` `marquee` `draw-svg` `magnetic` `tilt` |

Globale Modifier: `data-anim-delay`, `data-anim-duration`, `data-anim-ease`, `data-anim-start`, `data-anim-end`, `data-anim-distance`, `data-anim-stagger`, `data-anim-repeat`, `data-anim-scrub`, `data-anim-mobile="false"`. Details und alle Optionen je Animation stehen in der Doku.

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
