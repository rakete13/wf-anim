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
<script src="https://cdn.jsdelivr.net/gh/rakete13/wf-anim@1.8.0/src/wf-anim.min.js"></script>
```

Bequem für eigene und betreute Projekte. Die Seite hängt dann aber an diesem Repo und an jsDelivr, und die IP-Adresse der Besucher geht an jsDelivr (in der Datenschutzerklärung erwähnen). Bei Übergabe an einen Kunden besser auf den eingebetteten Footer Code wechseln.

## Startbildschirm und Intro

Elemente, die beim Laden schon im sichtbaren Bereich (oder darüber) liegen, bleiben ruhig und sind sofort sichtbar. Animiert wird nur, was beim Scrollen neu ins Bild kommt. Das verhindert Aufblitzen, verbessert die Ladezeit-Werte und ist besser für Screenreader.

Soll ein Element im Startbildschirm trotzdem animieren (z. B. die Hero-Headline), bekommt es zusätzlich das Attribut `data-anim-intro`. Dafür ist der Head Code nötig.

Mit `data-anim-intro="load"` startet die Animation sofort beim Laden der Seite, unabhängig von Position und Scrollen (bei Preloader: wenn er verschwindet). Ideal für die Stage: Elemente fahren beim Laden an ihre Position oder blenden sich ein. Reihenfolge über `data-anim-delay`. Gilt für Einblende-Animationen, nicht für Scroll-Effekte.

| Element kommt von … | `data-anim` | `data-anim-distance` | Sanftere Variante | `data-anim-intro` | `data-anim-duration` | Hinweis |
|---|---|---|---|---|---|---|
| unten | `fade-up` | `100vh` | `30vh` | `load` | `1.2` | Stage auf Overflow: Hidden, sonst wird die Seite kurz länger |
| oben | `fade-down` | `100vh` | `30vh` | `load` | `1.2` | Stage ganz oben oder Overflow: Hidden, sonst fährt es über die Navbar |
| rechts | `fade-left` | `100vw` | `40vw` | `load` | `1.2` | Stage auf Overflow: Hidden, sonst wird die Seite kurz seitlich scrollbar |
| links | `fade-right` | `100vw` | `40vw` | `load` | `1.2` | Stage auf Overflow: Hidden, sonst wird die Seite kurz seitlich scrollbar |
| nur einblenden | `fade-in` | – | – | `load` | `0.9` (Standard) | – |

Der Name beschreibt die Bewegungsrichtung: `fade-left` bewegt sich nach links, kommt also von rechts. Mit den Werten unter `data-anim-distance` startet das Element komplett außerhalb des Bildschirms, mit der sanfteren Variante fährt es nur das letzte Stück herein.

## Barrierefreiheit

- Noch nicht eingeblendete Elemente sind nur durchsichtig (`opacity: 0`), nicht versteckt. Screenreader lesen sie vor, die Browser-Suche findet sie.
- Bekommt ein Link oder Button in einem noch unsichtbaren Element den Tastatur-Fokus, erscheint das Element sofort.
- `counter` und `scramble` geben Screenreadern immer den fertigen Text.
- Bei aktivierter Systemeinstellung „Bewegung reduzieren“ wird nichts animiert.

## Animationen

| Kategorie | Werte für `data-anim` |
|---|---|
| Reveals | `fade-in` `fade-up` `fade-down` `fade-left` `fade-right` `scale-in` `blur-in` `clip-up` `clip-down` `clip-left` `clip-right` `image-curtain` |
| Gruppen | `stagger` `grid-stagger` |
| Text | `split-lines` `split-words` `split-chars` `scramble` `highlight` `rotate-words` `typewriter` |
| Scroll | `parallax` `parallax-element` `image-zoom` `image-expand` `image-shrink` `box-expand` `box-shrink` `text-fill` `progress-bar` `pin` `horizontal` `stack` `cover` `scrolly` |
| Funktional | `counter` `marquee` `draw-svg` `video` `accordion` `menu` |
| Seite & Navigation | `preloader` `nav-hide` `bg-color` `cursor` · Smooth Scroll global über `data-anim-smooth` am body oder `WFAnimConfig.smoothScroll` |

Globale Modifier: `data-anim-intro`, `data-anim-delay`, `data-anim-duration`, `data-anim-ease`, `data-anim-start`, `data-anim-end`, `data-anim-distance`, `data-anim-stagger`, `data-anim-repeat`, `data-anim-scrub`, `data-anim-mobile="false"`. Details und alle Optionen je Animation stehen in der Doku.

## Debug-Modus

Zeigt Start- und Endmarken jeder Scroll-Animation, eine Übersicht in der Konsole und typische Einrichtungsfehler (Bild beim Parallax nicht höher als der Wrapper, Section mit eigenem Hintergrund bei `bg-color`, zusätzliche Webflow Interaction am selben Element usw.).

- `?wfanim-debug` an die Seitenadresse hängen (z. B. `https://projekt.webflow.io/?wfanim-debug`), ohne etwas in Webflow zu ändern
- `data-anim-debug` am body (alle Animationen) oder an einem einzelnen Element (nur dieses)
- oder `WFAnimConfig.debug = true`

## Hinweise zu einzelnen Effekten

- **box-expand / box-shrink:** Wie image-expand, aber ohne Bild-Zoom: Die Box wächst, der Inhalt bleibt frei. So lässt sich darin z. B. ein Image-Wrapper mit `data-anim="parallax"` kombinieren: Box (`box-expand`) › Image-Wrapper (`parallax`) › Bild.
- **image-expand / image-shrink:** Wrapper im Layout voll breit anlegen, eine clip-path-Maske schneidet ihn zu. `data-anim-inset="container"` richtet den kleinen Zustand am Element mit `data-anim-container` aus.
- **stack:** Container ohne `overflow: hidden` (auch nicht darüber), sonst greift das Festkleben nicht.
- **cover:** Die nachfolgende Section braucht eine Hintergrundfarbe.
- **bg-color:** Die Section selbst transparent lassen. Farben auch als Variablen `--anim-bg` / `--anim-text`.
- **nav-hide:** Navbar auf fixed oder sticky. Setzt die Klasse `is-scrolled` zum Gestalten.
- **cursor:** Element in Webflow gestalten (Position fixed, Deckkraft 0). Klassen `is-hover` und `is-text`, Text aus `data-cursor="…"` landet im Kind mit `data-cursor-label`.
- **preloader:** In Webflow auf Display none stellen, der Head Code zeigt ihn beim Laden. Kinder `data-preloader-counter` und `data-preloader-bar`. `data-anim-once="session"` zeigt ihn nur einmal pro Besuch. Intro-Animationen warten, bis er verschwindet.
- **scrolly:** Abschnitte `data-scrolly-step`, Bilder `data-scrolly-media` gemeinsam in einem Wrapper. Kein `overflow: hidden` darüber.
- **accordion:** Einträge `data-accordion-item` mit `data-accordion-trigger`, `data-accordion-content` und optional `data-accordion-icon`. Innenabstände an ein inneres Element im Inhalt.
- **menu:** Bei der Webflow Navbar an das Nav Menu, bei eigenen Menüs an das Panel, das ein- und ausgeblendet wird.
- **video:** An `<video>` oder das Webflow Background Video.
- **Größe:** Die eingebettete Vollversion hat rund 53.500 Zeichen und passt damit nicht mehr komplett in Webflows Limit von 50.000. Entweder über jsDelivr laden oder mit `build.js` auf die genutzten Effekte ausdünnen.
- **Head Code:** Seit 1.4.0 enthält er Zeilen für Preloader und Akkordeon, seit 1.7.0 zwei für die Navigation. Bei einem Update von älteren Versionen bitte ersetzen.

## Navigation

Eigene Navigation per Attributen (ohne Webflows Navbar-Komponente). `data-nav` kommt an den Header.

```
header             ← data-nav
  ├── Logo
  ├── Burger         ← data-nav-toggle
  ├── Overlay        ← data-nav-backdrop (optional)
  └── Menü-Panel     ← data-nav-menu
        └── Link-Liste
              ├── Indikator   ← data-nav-indicator (optional, Wert pill = Hintergrundfläche)
              ├── Link
              └── Dropdown    ← data-nav-dropdown
                    ├── Auslöser ← data-nav-dropdown-toggle (Icon: data-nav-dropdown-icon)
                    └── Liste    ← data-nav-dropdown-list
```

- **Mobile-Menü** unter dem Umschaltpunkt (`data-nav-breakpoint`, Standard 991): Burger wird zum X, Panel öffnet als `down` (Standard), `side`, `side-left`, `circle` oder `fade` (`data-nav-open`), Links erscheinen nacheinander. Panel in Webflow auf Tablet so gestalten, wie es geöffnet aussieht; der Head Code blendet es geschlossen aus.
- **Dropdowns / Mega-Menüs:** Desktop bei Hover mit Verzögerung (`data-nav-hover-delay`, `data-nav-close-delay`), Klick und Tastatur; auf dem Handy Akkordeon.
- **Indikator:** gleitet zum Link unter der Maus und zurück zum aktiven (`w--current` bzw. `is-active`).
- **Scroll-Spy:** `data-nav-spy` am Header markiert bei Ankerlinks die sichtbare Section (`is-active`, `aria-current`).
- **Nav-Farbe je Section:** Farben einmal an der Navigation festlegen, z. B. `data-nav-theme-dark="transparent, #ffffff"` (Hintergrund, Schrift, optional Rahmen; Variablen erlaubt). Sections bekommen `data-nav-theme="dark"`. Berührt eine solche Section die Navigation (runter: Unterkante, hoch: Oberkante), wechseln die Farben in 0,25 s (`data-nav-theme-duration`), dazu kommt die Klasse `is-dark`. Über anderen Sections gilt die Gestaltung aus Webflow. Bei offenem Mobile-Menü bleiben die Standardfarben. Links und Burger-Linien auf `inherit`/`currentColor`, Logo als eingebettetes SVG mit `fill="currentColor"`.
- **Klassen:** `is-open` (Header, Panel, offenes Dropdown), `is-active` (Link), `is-static` (Panel auf Desktop).
- **Barrierefreiheit (fest eingebaut):** `aria-expanded`/`aria-controls`, Beschriftung des Burgers (`data-nav-label-open`/`-close`), Bedienung per Tastatur (Enter, Leertaste, Pfeiltasten, Esc), Fokusfalle und `inert` für die Seite dahinter, Scroll-Sperre, Fokus zurück zum Burger, Schließen bei Linkklick und beim Wechsel auf Desktop, `aria-current` am aktiven Link, ohne Animation bei „Bewegung reduzieren“. `data-nav-modal="false"` schaltet Fokusfalle, Sperre und Scroll-Sperre ab (nur für Sonderfälle).
- **Umschaltpunkt geändert?** Dann die Zahl 991 in der Nav-Zeile des Head Codes ebenfalls ändern.

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
