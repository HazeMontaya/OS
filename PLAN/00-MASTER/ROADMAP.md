---
title: OS Roadmap — Reihenfolge bis Produktreife
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [roadmap, execution, milestones]
---

# OS Roadmap — Reihenfolge bis Produktreife

## M0 — Stabiler Ist-Stand

**Ziel:** Repository, portable Build, Tests und Dokumentation konsistent halten.

- [ ] Current main als Baseline taggen.
- [ ] Reproduzierbaren Build sicherstellen.
- [ ] Lockfiles/Dependency Pinning.
- [ ] Secret Scan + Dependency Audit.
- [ ] Runtime Config Schema validieren.

## M1 — Runtime State + Event Backbone

- [ ] SQLite Run Store.
- [ ] Event Bus.
- [ ] SSE/WebSocket Live Stream.
- [ ] Goal/Task/Run Schemas.
- [ ] Restart-Recovery.
- [ ] Queue + Concurrency.

**Gate:** laufender Task überlebt UI-Neuladen und Runtime-Neustart.

## M2 — Agent Runtime v2

- [ ] Planner.
- [ ] Task DAG.
- [ ] Parent/Child Agents.
- [ ] Agent Teams.
- [ ] Dependencies.
- [ ] Pause/Resume/Cancel.
- [ ] Retry/Backoff.
- [ ] Checkpoints.
- [ ] Reviewer/Verifier.

**Gate:** ein Goal wird parallel von mindestens 3 isolierten Agents abgeschlossen und unabhängig verifiziert.

## M3 — Security + Isolation

- [ ] Capability Broker.
- [ ] per-Agent permissions.
- [ ] Git worktrees.
- [ ] Process sandbox.
- [ ] Browser profiles.
- [ ] Secret broker.
- [ ] Admin elevation broker.
- [ ] Audit trail.
- [ ] Emergency stop.

**Gate:** kein Agent hat mehr implizit globale Shell-/Root-Rechte.

## M4 — Agent Control Center UI

- [ ] neue App Shell.
- [ ] Goals View.
- [ ] Agents View.
- [ ] Task DAG.
- [ ] Timeline.
- [ ] Artefakte.
- [ ] Approvals.
- [ ] Model Router UI.
- [ ] Security UI.

**Gate:** komplexer Run ist ohne Terminal verständlich und steuerbar.

## M5 — Computer Use

- [ ] Browser automation.
- [ ] visual browser mode.
- [ ] screen capture.
- [ ] keyboard/mouse.
- [ ] app/window control.
- [ ] screenshots/video.
- [ ] human takeover.

**Gate:** Agent kann eine Desktop-/Web-Aufgabe ausführen und visuell verifizieren.

## M6 — Model Router + Local Inference

- [ ] capability registry.
- [ ] benchmark telemetry.
- [ ] cost/latency/quality routing.
- [ ] local/cloud policy.
- [ ] fallback/circuit breaker.
- [ ] multi-model competition + judge.
- [ ] lokale Inference Engine.

**Gate:** OS wählt Modelle selbst und kann bei Ausfall wechseln.

## M7 — Memory v2 + Skills

- [ ] Hybrid Search.
- [ ] embeddings.
- [ ] Knowledge Graph.
- [ ] project memory.
- [ ] consolidation.
- [ ] conflict detection.
- [ ] learned skills.
- [ ] skill tests/versioning.

**Gate:** OS kann Erkenntnisse aus früheren Runs nachweisbar wiederverwenden.

## M8 — 24/7 Operations

- [ ] event triggers.
- [ ] schedule/condition watches.
- [ ] notifications.
- [ ] monitoring.
- [ ] auto repair.
- [ ] remote/mobile control bridge optional.

## M9 — Release Hardening

- [ ] E2E suite.
- [ ] stress/soak tests.
- [ ] security tests.
- [ ] crash recovery tests.
- [ ] upgrade/migration tests.
- [ ] signed Windows artifacts.
- [ ] release notes/changelog.
- [ ] rollback/recovery packaging.

## Reihenfolge-Regel

Kein großer UI-Polish vor M1/M2. Keine hochautonome Computersteuerung vor M3. Keine „Self-Learning Skills“ ohne Verifier und Audit.
