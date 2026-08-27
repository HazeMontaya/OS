---
title: Persistenter Runtime-State und Event Bus
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [state, events, telemetry, persistence]
---

# Persistenter Runtime-State und Event Bus

- [ ] SQLite initialisieren
- [ ] migrations
- [ ] goals/tasks/runs/tool_calls/model_calls/artifacts/checkpoints Tabellen
- [ ] append-only event log
- [ ] event emitter / command bus
- [ ] SSE oder WebSocket für UI
- [ ] replay nach reconnect
- [ ] runtime restart recovery
- [ ] idempotente state transitions
- [ ] timestamps + correlation IDs

## Akzeptanz
UI kann einen laufenden Run schließen, neu öffnen und aus Events + State vollständig rekonstruieren.
