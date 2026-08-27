---
title: Markdown-Renderer
status: geplant
priority: hoch
created: 2026-08-26
deadline:
tags: [feature, markdown, rendering, ui]
---

# Markdown-Renderer

## Ziel
KI-Antworten werden als formatiertes Markdown gerendert — mit Überschriften, Listen, Code-Blöcken und Syntax-Highlighting.

## Ausgangslage

| Komponente | Aktuell | Ziel |
|---|---|---|
| Antwort-Darstellung | `<pre>` (roher Text) | Gerendertes Markdown |
| Code-Blöcke | Kein Highlighting | Syntax-Highlighting |
| Listen | Keine Formatierung | Aufzählungen, nummeriert |
| Links | Keine | Klickbare Links |

## Aufgaben

### Frontend: Renderer

- [ ] **Markdown-Library einbinden**
  - Empfehlung: `marked` (klein, ~30KB, keine Dependencies)
  - Alternative: `markdown-it` (erweiterbar)
  - Einbindung via `<script>` (kein Build-Tool nötig)

- [ ] **HTML-Sanitization**
  - Library: `DOMPurify` (schützt vor XSS)
  - Nur erlaubte HTML-Tags: `p, h1-h6, ul, ol, li, code, pre, blockquote, table, a, strong, em`
  - Keine `<script>`, `<iframe>`, `<object>` erlaubt

- [ ] **Code-Syntax-Highlighting**
  - Library: `highlight.js` (~25KB, 190+ Sprachen)
  - Theme: `github-dark` (passt zum Dark Theme)
  - Erkannte Sprache aus ````sprache` Block

### Frontend: Integration

- [ ] **`app.js` erweitern**
  - `renderMarkdown(text)` Funktion
  - Wird auf Assistant-Antworten angewendet
  - User-Nachrichten bleiben als Plain Text

- [ ] **CSS für Markdown-Elemente**
  - `h1-h6`: Abgestufte Größe, Akzentfarbe
  - `code`: Inline-Hintergrund, monospace
  - `pre > code`: Block-Darstellung mit Padding
  - `blockquote`: Linker Rand, gedämpfte Farbe
  - `table`: Rahmen, Zebra-Streifen
  - `a`: Akzentfarbe, Underline

- [ ] **Copy-Button für Code-Blöcke**
  - Button oben rechts bei jedem `<pre>` Block
  - Kopiert Inhalt in Zwischenablage
  - Feedback: "Kopiert!" für 2 Sekunden

### Frontend: Erweitert

- [ ] **LaTeX/Math-Support** (optional)
  - Library: `KaTeX` (schneller als MathJax)
  - Erkennung: `$...$` und `$$...$$`
  - Für wissenschaftliche Inhalte

- [ ] **Bilder in Antworten** (optional)
  - Base64-kodierte Bilder werden gerendert
  -最大 Größe: 500x500px
  - Thumbnail mit Klick-zoom

## Technische Details

### Renderer-Pipeline
```
Rohes Markdown
  → marked.parse()        → HTML
  → DOMPurify.sanitize()  → Sicheres HTML
  → highlight.js.highlight() → Code-Blöcke formatiert
  → In DOM einfügen
```

### CSS-Variablen
```css
.md h1 { color: var(--text); font-size: 1.8em; }
.md h2 { color: var(--text); font-size: 1.4em; }
.md code { background: var(--panel2); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
.md pre { background: #080b10; padding: 16px; border-radius: 10px; overflow-x: auto; }
.md pre code { background: none; padding: 0; }
.md blockquote { border-left: 3px solid var(--accent); padding-left: 12px; color: var(--muted); }
.md a { color: var(--accent); }
.md table { border-collapse: collapse; width: 100%; }
.md th, .md td { border: 1px solid var(--line); padding: 8px; }
.md tr:nth-child(even) { background: var(--panel2); }
```

### marked-Konfiguration
```javascript
marked.setOptions({
  breaks: true,           // Zeilenumbrüche → <br>
  gfm: true,              // GitHub Flavored Markdown
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});
```

## Akzeptanzkriterien

- [ ] Markdown wird korrekt gerendert (Überschriften, Listen, Tabellen)
- [ ] Code-Blöcke haben Syntax-Highlighting
- [ ] XSS-Schutz durch DOMPurify funktioniert
- [ ] Copy-Button funktioniert
- [ ] Rendering ist schnell (<100ms für typische Antworten)
- [ ] Keine visuellen Bugs bei langen Antworten

## Abhängigkeiten

- Externe Libraries: `marked`, `DOMPurify`, `highlight.js`
- Keine Backend-Änderungen nötig

## Geschätzter Aufwand
- Renderer + Sanitization: 2–3 Stunden
- CSS + Styling: 1–2 Stunden
- Code-Highlighting: 1 Stunde
- Copy-Button: 0.5 Stunden
