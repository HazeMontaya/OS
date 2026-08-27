---
title: OS Ist-Stand und Reifegradbewertung
status: aktiv
priority: hoch
created: 2026-08-26
tags: [audit, maturity, current-state]
---

# OS Ist-Stand und Reifegradbewertung

## Gesamtbewertung

**Aktuell: 4,8/10** gegen die 2026er Spitzenklasse autonomer Agentensysteme.

## Bewertungsmatrix

| Bereich | Aktuell | Ziel | Gap |
|---|---:|---:|---:|
| Portable Desktop Runtime | 8.5 | 9.5 | 1.0 |
| Local First | 9.5 | 10 | 0.5 |
| Multi-Model Provider Layer | 8.0 | 9.5 | 1.5 |
| Automatic Model Routing | 2.0 | 9.0 | 7.0 |
| Agent Harness | 3.0 | 9.0 | 6.0 |
| Multi-Agent Orchestration | 1.0 | 9.5 | 8.5 |
| Task DAG / Planning | 1.0 | 9.0 | 8.0 |
| Persistent Run State | 1.5 | 9.0 | 7.5 |
| Sandbox / Isolation | 2.0 | 9.5 | 7.5 |
| Computer Use | 1.5 | 9.0 | 7.5 |
| Memory | 3.5 | 9.0 | 5.5 |
| Skills / Self-Learning | 1.0 | 8.5 | 7.5 |
| Workflows | 4.0 | 9.0 | 5.0 |
| Automations | 4.0 | 9.0 | 5.0 |
| MCP / Integrations | 6.0 | 9.0 | 3.0 |
| Observability / Telemetry | 2.0 | 9.5 | 7.5 |
| UI / UX | 2.5 | 9.5 | 7.0 |
| Security / Permissions | 3.0 | 9.5 | 6.5 |
| Self Verification | 1.0 | 9.0 | 8.0 |
| Recovery / Checkpoints | 1.0 | 9.0 | 8.0 |
| Testing / E2E | 4.5 | 9.5 | 5.0 |
| Release Engineering | 6.5 | 9.0 | 2.5 |

## Was technisch bereits solide ist

- Portable `OS.exe`-Distribution.
- Localhost Runtime.
- Provider-Abstraktion statt eines einzigen Modellanbieters.
- Tools und MCP als echte Ausführungspfade.
- Memory-Basis und Workflow-/Automation-Basis.
- CI/Build-Grundlage.

## Was aktuell Produktreife verhindert

### 1. Ein-Agent-Flaschenhals
Der Kernagent kann aktuell im Wesentlichen nur zwischen Antwort und einem Tool-Aufruf wählen. Das ist für 2026 zu wenig.

### 2. Kein persistenter Operations-Layer
Es fehlt ein dauerhafter State für Tasks, Agents, Checkpoints, Dependencies, Artefakte, Queue und Recovery.

### 3. UI bildet Intelligenz nicht ab
Die UI zeigt primär Formularfelder, Listen und Rohdaten. Sie zeigt noch nicht den Zustand eines Agentensystems.

### 4. Sicherheit ist noch nicht capability-basiert
`allowShell` und Root-Schreibrechte sind zu grob. Ziel ist fein granulare Rechtevergabe pro Agent/Task/Tool.

### 5. Kein Computer Use
Ohne Browser-/Desktop-Steuerung bleibt OS auf API/CLI/Files beschränkt.

### 6. Kein Verifier
Ein Agent kann sich selbst „fertig“ erklären. Das ist für autonome Long-Running-Arbeit nicht ausreichend.

## Fazit

Die vorhandene Basis soll **nicht verworfen** werden. Die richtige Strategie ist ein vertikaler Ausbau des aktuellen Cores zu einer Agent-Control-Plane.
