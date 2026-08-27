---
title: Agent Runtime v2 — Planner, Teams, DAG, Recovery
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [agents, runtime, planner, orchestration]
---

# Agent Runtime v2

## Ziel
Den aktuellen Single-Agent Tool-Loop durch eine persistente Multi-Agent-Runtime ersetzen.

## Muss-Komponenten
- [ ] Goal schema
- [ ] Task schema
- [ ] DAG planner
- [ ] Orchestrator
- [ ] agent spawn/kill
- [ ] parent/child relationships
- [ ] roles/profiles
- [ ] queue/concurrency
- [ ] dependencies
- [ ] blocked/waiting state
- [ ] pause/resume/cancel
- [ ] retry/backoff
- [ ] checkpoints
- [ ] reviewer/verifier
- [ ] artifact handoff
- [ ] persistent state

## Akzeptanztest
Ein Goal erzeugt mindestens 3 Worker, führt zwei unabhängige Tasks parallel aus, blockiert einen Integrationsschritt bis beide fertig sind, lässt einen Reviewer prüfen und kann nach Runtime-Neustart fortfahren.
