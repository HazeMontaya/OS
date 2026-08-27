---
title: Streaming (Server-Sent Events)
status: geplant
priority: hoch
created: 2026-08-26
deadline:
tags: [feature, streaming, sse, api, ui]
---

# Streaming (Server-Sent Events)

## Ziel
KI-Antworten sollen live im UI erscheinen (Chunk-by-Chunk), statt als Ganzes nach Abschluss.

## Ausgangslage

| Komponente | Aktuell | Ziel |
|---|---|---|
| `/api/chat` | POST → wartet auf volle Antwort → JSON | POST → SSE-Stream |
| Frontend | `await api()` → zeigt Ergebnis | EventSource/ReadableStream → live |
| Provider | `fetch()` → komplett | `fetch()` mit `ReadableStream` |

## Aufgaben

### Backend: Server

- [ ] **Neuer Endpunkt: `/api/chat/stream`**
  - Methode: POST
  - Response: `Content-Type: text/event-stream`
  - Format: `data: {"type":"chunk","text":"..."}\n\n`
  - Am Ende: `data: {"type":"done","provider":"...","model":"..."}\n\n`

- [ ] **Provider-Streaming in `providers.mjs`**
  - OpenAI-Transport: `stream: true` im Payload
  - Anthropic-Transport: `stream: true`
  - Chunk-Parsing: `choices[0].delta.content` (OpenAI) / `content_block_delta` (Anthropic)
  - Fallback: Provider ohne Streaming → simulierter Stream ( Wort für Wort)

- [ ] **Agent-Loop mit Streaming**
  - Tool-Call-Ergebnisse werden als eigene Events gesendet
  - Status-Events: `{"type":"tool_call","tool":"..."}`
  - Fehler-Events: `{"type":"error","message":"..."}`

### Frontend: Client

- [ ] **Stream-Reader in `app.js`**
  - `fetch()` mit `response.body.getReader()`
  - `TextDecoder` für Chunk-Dekodierung
  - Live-Update des `#answer` Elements

- [ ] **UI-Feedback**
  - Cursor/Blink-Indikator während Stream
  - "Arbeite…" wird durch live-Text ersetzt
  - Tool-Call-Status anzeigen

- [ ] **Fallback für alte Browser**
  - Prüfe ob `ReadableStream` unterstützt wird
  - Falls nicht: klassischer POST-Request

## Technische Details

### SSE-Format
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"start","provider":"openai","model":"gpt-5.6-terra"}

data: {"type":"chunk","text":"Hallo"}
data: {"type":"chunk","text":", "}
data: {"type":"chunk","text":"wie kann ich helfen?"}

data: {"type":"done","iterations":1,"provider":"openai","model":"gpt-5.6-terra"}
```

### Provider-Streaming-Implementierung
```javascript
// OpenAI
const response = await fetch(url, {
  ...options,
  body: JSON.stringify({ ...payload, stream: true })
});
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const line = new TextDecoder().decode(value);
  // Parse SSE lines, extract delta content
}
```

### Frontend-Reader
```javascript
const response = await fetch('/api/chat/stream', { method: 'POST', body: ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Parse SSE data lines, update DOM
  answerEl.textContent += chunk;
}
```

## Akzeptanzkriterien

- [ ] KI-Antworten erscheinen live (Wort für Wort)
- [ ] Streaming funktioniert mit OpenAI- und Anthropic-Providern
- [ ] Fallback für Provider ohne Streaming
- [ ] UI zeigt Ladezustand während Stream
- [ ] Tool-Calls werden live angezeigt
- [ ] Stream kann abgebrochen werden (Client disconnected)
- [ ] Kein Memory-Leak bei vielen Stream-Verbindungen

## Abhängigkeiten

- Provider müssen `stream: true` unterstützen
- Node.js `http`-Modul unterstützt Streaming (Response mit `write()`)
- Frontend: `ReadableStream` API (alle modernen Browser)

## Geschätzter Aufwand
- Backend: 3–4 Stunden
- Frontend: 2–3 Stunden
- Test: 1–2 Stunden
