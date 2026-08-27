---
title: Chat-Verlauf (Persistente Historie)
status: geplant
priority: hoch
created: 2026-08-26
deadline:
tags: [feature, chat, history, persistence, ui]
---

# Chat-Verlauf (Persistente Historie)

## Ziel
Chat-Nachrichten bleiben nach Neustart erhalten. UI zeigt eine scrollbare Nachrichten-Historie.

## Ausgangslage

| Komponente | Aktuell | Ziel |
|---|---|---|
| Nachrichten-Speicherung | Keine | `Data/Chat/history.jsonl` |
| UI | Nur letzte Antwort `<pre>` | Scrollbare Nachrichtenliste |
| Session | Keine | Session-basierte Gruppierung |

## Aufgaben

### Backend: Speicherung

- [ ] **Neues Modul: `chat.mjs`**
  - `addMessage({ role, content, provider, model, timestamp })`
  - `getHistory(sessionId, limit?)` — letzte N Nachrichten
  - `getSessions()` — alle Sessions auflisten
  - `clearHistory(sessionId?)` — Verlauf löschen
  - Speicherort: `Data/Chat/history.jsonl`

- [ ] **Schema**
  ```json
  {
    "id": "uuid",
    "sessionId": "default",
    "role": "user | assistant | system | tool",
    "content": "Nachrichtentext",
    "provider": "openai",
    "model": "gpt-5.6-terra",
    "iterations": 3,
    "toolResults": [...],
    "ts": "2026-08-26T22:00:00Z"
  }
  ```

- [ ] **API-Endpunkte erweitern**
  - `GET /api/chat/history?session=default&limit=50`
  - `DELETE /api/chat/history?session=default`
  - `POST /api/chat` speichert automatisch

### Backend: Integration

- [ ] **`server.mjs` anpassen**
  - Chat-Endpunkt speichert User- und Assistant-Nachrichten
  - Session-ID via Header oder Body

- [ ] **`agent.mjs` erweitern**
  - Verlauf wird in System-Prompt eingefügt (Context)
  - Tool-Ergebnisse werden ebenfalls gespeichert

### Frontend: UI

- [ ] **Chat-Bereich in `index.html`**
  ```html
  <section class="chat">
    <div id="chatMessages" class="messages"></div>
    <form id="chatForm">...</form>
  </section>
  ```

- [ ] **Nachrichten-Rendering in `app.js`**
  - User-Nachrichten: links, blau
  - Assistant-Nachrichten: links, grau
  - Tool-Calls: eingerückt, monospace
  - Zeitstempel als Tooltip

- [ ] **Auto-Scroll**
  - Neueste Nachricht immer sichtbar
  - Scrollen nach oben lädt ältere Nachrichten (Lazy Load)

- [ ] **Session-Management**
  - Dropdown für Session-Auswahl
  - "Neue Session" Button
  - Session umbenennen/löschen

### Frontend: Styling

- [ ] **Chat-CSS**
  - Nachrichten-Bubbles mit CSS
  - User: Hintergrund `var(--accent)`, Text weiß
  - Assistant: Hintergrund `var(--panel2)`, Text `var(--text)`
  - Tool: Hintergrund dunkler, monospace,缩进

## Technische Details

### JSONL-Speicher
```javascript
// Data/Chat/history.jsonl
{"id":"...","sessionId":"default","role":"user","content":"...","ts":"..."}
{"id":"...","sessionId":"default","role":"assistant","content":"...","ts":"..."}
```

### API-Response
```json
GET /api/chat/history?session=default&limit=50
{
  "session": "default",
  "messages": [
    {"id":"...","role":"user","content":"...","ts":"..."},
    {"id":"...","role":"assistant","content":"...","ts":"..."}
  ],
  "total": 12
}
```

### UI-Struktur
```
┌─────────────────────────────────────────┐
│ Session: [default ▾]  [Neue Session]   │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Du: Wie geht es dir?               │ │
│ │                        22:15        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ OS: Mir geht es gut!               │ │
│ │                                     │ │
│ │ [tool: system.info]                 │ │
│ │                                     │ │
│ │                        22:15        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Textarea...                    ] [▶]  │
└─────────────────────────────────────────┘
```

## Akzeptanzkriterien

- [ ] Nachrichten bleiben nach Neustart erhalten
- [ ] UI zeigt scrollbare Nachrichtenliste
- [ ] User- und Assistant-Nachrichten sind visuell getrennt
- [ ] Tool-Calls werden angezeigt
- [ ] Auto-Scroll funktioniert
- [ ] Session-Wechsel funktioniert
- [ ] Verlauf kann gelöscht werden

## Abhängigkeiten

- `server.mjs` — Chat-Endpunkt muss erweitert werden
- `agent.mjs` — Verlauf muss in Context eingefügt werden
- Keine externen Dependencies

## Geschätzter Aufwand
- Backend: 2–3 Stunden
- Frontend: 3–4 Stunden
- Styling: 1–2 Stunden
