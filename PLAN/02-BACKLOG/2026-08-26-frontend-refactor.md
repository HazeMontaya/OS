---
title: Frontend-Refactor
status: geplant
priority: mittel
created: 2026-08-26
deadline:
tags: [refactor, frontend, architecture, component-system]
---

# Frontend-Refactor

## Ziel
Die bestehende Vanilla-JS-Oberfläche in eine modularere, erweiterbare Architektur umwandeln — ohne Build-Tools oder schwere Frameworks.

## Ausgangslage

| Aspekt | Aktuell | Ziel |
|---|---|---|
| Architektur | Alles in einer Datei (~250 Zeilen) | Modulare Components |
| State | Kein State Management | Einfacher Store |
| DOM | `innerHTML`-Basiert | Component-Rendering |
| Events | Globale Listener | Component-scoped |
| Testbarkeit | Schlecht | Jede Component testbar |

## Aufgaben

### Architektur

- [ ] **Component-System (vanilla)**
  ```javascript
  // components/ChatMessage.js
  export function ChatMessage({ role, content, ts }) {
    const el = document.createElement('div');
    el.className = `message message-${role}`;
    el.innerHTML = `
      <div class="message-content">${renderMarkdown(content)}</div>
      <time>${formatTime(ts)}</time>
    `;
    return el;
  }
  ```

- [ ] **Einfacher State Store**
  ```javascript
  // store.js
  const state = { messages: [], sessions: [], currentSession: 'default' };
  const listeners = [];
  
  export function getState() { return state; }
  export function setState(patch) {
    Object.assign(state, patch);
    listeners.forEach(fn => fn(state));
  }
  export function subscribe(fn) { listeners.push(fn); }
  ```

- [ ] **Event-System**
  ```javascript
  // events.js
  export const events = {
    'chat:send': new CustomEvent('chat:send'),
    'chat:receive': new CustomEvent('chat:receive'),
    'session:switch': new CustomEvent('session:switch'),
  };
  ```

### Dateistruktur

```
Core/UI/
├── index.html
├── styles.css
├── app.js                    ← Entry Point
├── store.js                  ← State Management
├── events.js                 ← Event-System
├── api.js                    ← API-Layer (aus app.js extrahiert)
├── utils.js                  ← Hilfsfunktionen (esc, formatTime, etc.)
├── components/
│   ├── Header.js             ← Status-Anzeige
│   ├── Stats.js              ← Dashboard-Stats
│   ├── ChatInput.js          ← Eingabe-Formular
│   ├── ChatMessages.js       ← Nachrichten-Liste
│   ├── ChatMessage.js        ← Einzelne Nachricht
│   ├── MemoryPanel.js        ← Memory-Bereich
│   ├── WorkflowPanel.js      ← Workflows
│   ├── ToolsPanel.js         ← Tools-Liste
│   └── MetaPanel.js          ← Provider/MCP/Auto
└── renderer/
    ├── markdown.js           ← Markdown-Rendering
    └── code-highlight.js     ← Syntax-Highlighting
```

### Migration

- [ ] **Schritt 1: Extrahieren**
  - `api.js` aus `app.js` extrahieren
  - `utils.js` aus `app.js` extrahieren
  - State in `store.js` verschieben

- [ ] **Schritt 2: Components**
  - Jede Sektion als eigene Component
  - Components rendern ihren eigenen DOM
  - Components subscriben auf State-Änderungen

- [ ] **Schritt 3: Events**
  - Form-Submit → Custom Events
  - API-Callbacks → State-Updates → Component-Rendering

- [ ] **Schritt 4: Styling**
  - CSS-Modularisierung (BEM oder CSS-Modules-ähnlich)
  - CSS-Variablen für Theme (Vorbereitung für Theme-Toggle)

## Technische Details

### Component-Pattern
```javascript
// Jede Component ist eine Funktion die ein DOM-Element zurückgibt
export function ChatMessages() {
  const el = document.createElement('section');
  el.className = 'chat-messages';
  
  // Subscribe auf State-Änderungen
  subscribe((state) => {
    el.innerHTML = '';
    state.messages.forEach(msg => {
      el.appendChild(ChatMessage(msg));
    });
  });
  
  return el;
}
```

### API-Layer (refactored)
```javascript
// api.js
const BASE = '';

export async function health() { return get('/api/health'); }
export async function models() { return get('/api/models'); }
export async function chat(data) { return post('/api/chat', data); }
export async function memory(params) { return get('/api/memory', params); }
export async function addMemory(data) { return post('/api/memory', data); }

async function get(url, params) { /* ... */ }
async function post(url, data) { /* ... */ }
```

## Vorteile

| Aspekt | Vorher | Nachher |
|---|---|---|
| Wartbarkeit | Schwierig (eine Datei) | Gut (modular) |
| Testbarkeit | Schlecht | Jede Component testbar |
| Erweiterbarkeit | Komplett | Components hinzufügen |
| State-Management | Verstreut | Zentral |
| Performance | InnerHTML-Basiert | Gezielte DOM-Updates |

## Akzeptanzkriterien

- [ ] Alle Components funktionieren wie zuvor
- [ ] Keine visuellen Änderungen (Refactor, kein Redesign)
- [ ] State ist zentral verwaltet
- [ ] Components sind unabhängig testbar
- [ ] Neue Components können einfach hinzugefügt werden

## Abhängigkeiten

- Keine externen Dependencies
- Muss mit bestehendem CSS funktionieren
- Keine Breaking Changes in der API

## Geschätzter Aufwand
- Phase 1 (Extrahieren): 2–3 Stunden
- Phase 2 (Components): 4–6 Stunden
- Phase 3 (Events): 2–3 Stunden
- Phase 4 (Styling): 1–2 Stunden
