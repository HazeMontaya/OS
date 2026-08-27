---
title: Custom Titlebar
status: geplant
priority: mittel
created: 2026-08-26
deadline:
tags: [feature, electron, titlebar, ui, design]
---

# Custom Titlebar

## Ziel
Electron-eigenen Titelleisten durch eine eigene, gestaltete Titelleiste ersetzen — mit OS-Branding und Fenster-Controls.

## Ausgangslage

| Aspekt | Aktuell | Ziel |
|---|---|---|
| Titelleiste | Electron-Standard (Windows) | Custom HTML/CSS |
| Fenster-Controls | Betriebssystem-standard | Eigene Controls |
| Dragging | Standard | Custom Drag-Region |
| Branding | Keins | OS-Logo + Name |

## Aufgaben

### Electron: Main Process

- [ ] **`main.cjs` anpassen**
  ```javascript
  const win = new BrowserWindow({
    frame: false,              // Standard-Titelleiste ausblenden
    titleBarStyle: 'hidden',
    // Windows: Titelleiste in Content integriert
    titleBarOverlay: false,
    // ... andere Optionen
  });
  ```

- [ ] **Fenster-Controls via IPC**
  ```javascript
  // main.cjs
  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', () => win.close());
  ```

### Frontend: Titlebar

- [ ] **HTML-Struktur**
  ```html
  <header class="titlebar" data-drag>
    <div class="titlebar-brand">
      <span class="titlebar-logo">⬡</span>
      <span class="titlebar-title">OS</span>
      <span class="titlebar-version">v0.8.0</span>
    </div>
    <div class="titlebar-controls">
      <button class="titlebar-btn" data-action="minimize">─</button>
      <button class="titlebar-btn" data-action="maximize">□</button>
      <button class="titlebar-btn titlebar-close" data-action="close">✕</button>
    </div>
  </header>
  ```

- [ ] **CSS für Titelleiste**
  ```css
  .titlebar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 36px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    padding: 0 12px;
    -webkit-app-region: drag;    /* Fenster-Dragging */
    user-select: none;
  }
  .titlebar-btn {
    -webkit-app-region: no-drag; /* Buttons nicht draggable */
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .titlebar-btn:hover { background: rgba(255,255,255,0.1); }
  .titlebar-close:hover { background: #e81123; color: white; }
  ```

- [ ] **IPC-Integration in `app.js`**
  ```javascript
  // Titelleiste-Buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.electron?.send(`window:${btn.dataset.action}`);
    });
  });
  ```

### Electron: preload.js

- [ ] **Context Bridge für IPC**
  ```javascript
  // preload.cjs
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('electron', {
    send: (channel) => ipcRenderer.send(channel),
    platform: process.platform
  });
  ```

### Extra: Plattform-Unterschiede

- [ ] **Windows**
  - Traffic-Lights links (standard)
  - Controls rechts

- [ ] **macOS**
  - Traffic-Lights links (rot/gelb/grün)
  - Titelleiste 28px hoch

- [ ] **Linux**
  - Controls rechts (standard)
  - Eigenes Styling

## Technische Details

### CSS-Variablen für Titelleiste
```css
:root {
  --titlebar-height: 36px;
  --titlebar-bg: var(--panel);
  --titlebar-border: var(--line);
  --titlebar-text: var(--text);
  --titlebar-muted: var(--muted);
}
```

### Drag-Region
```css
[data-drag] {
  -webkit-app-region: drag;
}
[data-drag] button,
[data-drag] input,
[data-drag] select {
  -webkit-app-region: no-drag;
}
```

### Maximized-State
```css
.titlebar.maximized .titlebar-btn[data-action="maximize"]::before {
  content: "❐";  /* Restore-Icon */
}
```

## Akzeptanzkriterien

- [ ] Standard-Titelleiste ist ausgeblendet
- [ ] Custom Titelleiste zeigt OS-Logo und Version
- [ ] Fenster-Dragging funktioniert (auf Titelleiste)
- [ ] Minimize/Maximize/Close funktionieren
- [ ] Titelleiste passt zum Dark Theme
- [ ] Funktioniert auf Windows, macOS, Linux

## Abhängigkeiten

- Electron `frame: false` oder `titleBarStyle: 'hidden'`
- `preload.cjs` für IPC
- Keine externen Dependencies

## Geschätzter Aufwand
- Electron-Config: 1 Stunde
- HTML/CSS: 2–3 Stunden
- IPC-Integration: 1–2 Stunden
- Plattform-Testing: 1–2 Stunden
