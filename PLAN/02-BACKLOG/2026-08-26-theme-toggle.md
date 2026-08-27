---
title: Theme Toggle (Dark/Light Mode)
status: geplant
priority: mittel
created: 2026-08-26
deadline:
tags: [feature, theme, dark-mode, light-mode, ui, css]
---

# Theme Toggle (Dark/Light Mode)

## Ziel
Wechsel zwischen Dark und Light Mode per Klick — mit Persistenz über Neustarts.

## Ausgangslage

| Aspekt | Aktuell | Ziel |
|---|---|---|
| Theme | Nur Dark Mode | Dark + Light |
| Umschalten | Nicht möglich | Toggle-Button |
| Persistenz | Keine | `localStorage` |
| System-Präferenz | Ignoriert | `prefers-color-scheme` |

## Aufgaben

### CSS: Light-Theme

- [ ] **Light-Theme CSS-Variablen**
  ```css
  [data-theme="light"] {
    --bg: #f8f9fa;
    --panel: #ffffff;
    --panel2: #f1f3f5;
    --line: #dee2e6;
    --muted: #6c757d;
    --text: #212529;
    --accent: #4c6ef5;
  }
  ```

- [ ] **Tailwind-Ausnahmen**
  - Code-Blöcke bleiben dunkel (auch im Light-Mode)
  - shadows angepasst
  - border-Farben angepasst

- [ ] **Übergang**
  ```css
  * {
    transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  }
  ```

### Frontend: Toggle

- [ ] **Toggle-Button in Header**
  ```html
  <button id="themeToggle" class="theme-toggle" title="Theme wechseln">
    <span class="icon-dark">🌙</span>
    <span class="icon-light">☀️</span>
  </button>
  ```

- [ ] **CSS für Toggle**
  ```css
  .theme-toggle {
    background: none;
    border: 1px solid var(--line);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  [data-theme="dark"] .icon-light { display: none; }
  [data-theme="light"] .icon-dark { display: none; }
  ```

- [ ] **`theme.js` Modul**
  ```javascript
  const STORAGE_KEY = 'os-theme';
  
  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }
  
  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  
  // Init
  setTheme(getPreferredTheme());
  
  // System-Änderungen überwachen
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  ```

### Persistenz

- [ ] **localStorage**
  - Theme wird unter `os-theme` gespeichert
  - Bei Laden: Zuerst `localStorage`, dann `prefers-color-scheme`

- [ ] **Electron-Speicherung** (optional)
  - `electron-store` für persistente Config
  - Theme überlebt `localStorage`-Löschung

### Extra: System-Integration

- [ ] **Electron: Theme an OS anpassen**
  ```javascript
  // main.cjs
  const { nativeTheme } = require('electron');
  nativeTheme.on('updated', () => {
    win.webContents.send('system:theme-changed', 
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    );
  });
  ```

- [ ] **Titlebar-Anpassung**
  - `titleBarStyle: 'hidden'` + `backgroundColor`
  - Dark: `#10141b`
  - Light: `#ffffff`

## Technische Details

### CSS-Struktur
```css
/* Dark (Standard) */
:root, [data-theme="dark"] {
  --bg: #07090d;
  --panel: #10141b;
  /* ... */
}

/* Light */
[data-theme="light"] {
  --bg: #f8f9fa;
  --panel: #ffffff;
  /* ... */
}
```

### Syntax-Highlighting Themes
```css
/* Dark */
[data-theme="dark"] .hljs { background: #080b10; color: #e1e8f0; }

/* Light */
[data-theme="light"] .hljs { background: #f6f8fa; color: #24292e; }
```

### Responsive
```css
/* Mobile: Kompakterer Toggle */
@media (max-width: 760px) {
  .theme-toggle { width: 28px; height: 28px; }
}
```

## Akzeptanzkriterien

- [ ] Dark und Light Mode funktionieren
- [ ] Theme-Wechsel ist sofort sichtbar
- [ ] Theme bleibt nach Neustart erhalten
- [ ] System-Präferenz wird erkannt
- [ ] Alle Elemente sind in beiden Themes lesbar
- [ ] Code-Blöcke bleiben dunkel (auch im Light-Mode)
- [ ] Toggle-Button ist erreichbar

## Abhängigkeiten

- CSS-Variablen müssen vorhanden sein (bereits der Fall)
- `localStorage` muss funktionieren
- Keine externen Dependencies

## Geschätzter Aufwand
- CSS Light-Theme: 2–3 Stunden
- Toggle-Button + JS: 1–2 Stunden
- Persistenz: 0.5 Stunden
- Testing: 1 Stunde
