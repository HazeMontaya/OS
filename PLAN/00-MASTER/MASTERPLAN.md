---
title: OS Masterplan — Agent Operating System
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [masterplan, strategy, architecture, product, agent-os]
---

# OS Masterplan — Agent Operating System

## 1. Endgültige Produktdefinition

OS wird **kein Chat-Frontend und kein einzelner Coding-Agent**, sondern ein **portable, local-first, modellunabhängiges Personal AI Operating Environment** für Windows.

Die Kernidee:

> Der Benutzer beschreibt ein Ziel. OS plant, zerlegt, delegiert, führt aus, beobachtet, prüft, repariert, lernt und dokumentiert die Arbeit. Der Benutzer sieht jederzeit, **was** läuft, **wer** es ausführt, **warum** etwas passiert, welche Rechte benutzt werden und welche Ergebnisse entstanden sind.

### Ein-Satz-Ziel

**OS = lokale Agent-Control-Plane + Multi-Model-Router + Computer-Use + Memory/Skills + Workflows/Automationen + visuelles Operations-Center.**

## 2. Aktueller Stand

### Bereits vorhanden

- Portable Windows-Distribution mit `OS.exe`; kein Installer im Produktflow.
- Eigener Node/Electron Runtime-Core.
- Local-First Root-Struktur mit `Core`, `Config`, `Workspace`, `AI-Brain`, `Models`, `Data`, `Logs`.
- Multi-Provider-Abstraktion für OpenAI-kompatible APIs sowie Anthropic.
- Modellkatalog mit Cloud- und Open-Weight-Familien.
- Tool Registry mit System-, Dateisystem- und Shell-Funktionen.
- MCP-Grundintegration.
- JSONL-Memory mit einfacher Suche/Deduplizierung.
- Sequenzielle Workflows und Intervall-Automationen.
- Lokale HTTP-API.
- CI und portabler Build.

### Kritische Lücken

- Agent arbeitet noch als einzelner `answer|tool`-Loop.
- Kein echter Planner / Task DAG.
- Keine Parent/Child-Agenten oder Agent Teams.
- Keine parallele isolierte Ausführung.
- Kein persistenter Run-/Task-State.
- Keine robuste Pause/Resume/Retry/Recovery-Mechanik.
- Kein Computer-Use-Layer für Browser/Desktop/Screen/Mouse/Keyboard.
- Kein Capability-/Permission-Broker.
- Keine starke Sandbox-/Worktree-Isolation.
- Memory noch nicht semantisch/relational/lernend.
- Noch kein echter automatischer Model Router.
- UI aktuell noch Prototyp, nicht Agent-Control-Center.
- Keine vollständige Observability: Runs, Traces, Kosten, Artefakte, Dependencies, Ereignisse, Timeline.
- Keine End-to-End Self-Verification-/Repair-Schleife.

## 3. Marktposition

Aktuelle relative Reife von OS: **ca. 4,8/10** bezogen auf das Ziel „lokales Jarvis / Agent Operating Environment“.

Das ist kein Urteil über den Code allein, sondern über die **Produktreife im Agentenmarkt 2026**. Führende Systeme haben die Messlatte zu parallelen Agenten, isolierten Umgebungen, Computer-Use, Long-Running Tasks, Artefakt-/Review-UX und kontinuierlichem Betrieb verschoben.

### Strategische Stärken von OS

| Dimension | Stand | Bedeutung |
|---|---:|---|
| Local First | 9.5/10 | Daten, Runtime und Kontrolle bleiben lokal möglich |
| Model Neutrality | 9/10 | kein Vendor-Lock-in; Cloud + lokal kombinierbar |
| System Ownership | 9/10 | eigener Core statt Wrapper um nur einen Anbieter |
| Portabilität | 9/10 | direkter Root mit `OS.exe` |
| MCP/Tool-Erweiterbarkeit | 7/10 | gute Basis für Fähigkeiten |
| Produkt-UX | 2–3/10 | größter sichtbarer Rückstand |
| Multi-Agent Runtime | 1–2/10 | größter funktionaler Rückstand |
| Computer Use | 1–2/10 | noch kein vollwertiger Layer |
| Sandbox/Security Broker | 2–3/10 | Grundschutz, aber noch keine Capability-Architektur |
| Persistentes Agent-Memory | 3–4/10 | Basis vorhanden, Lernen fehlt |

## 4. Neue Zielarchitektur

```text
USER / VOICE / REMOTE / AUTOMATION
              │
              ▼
        OS CONTROL CENTER
              │
              ▼
        INTENT / GOAL LAYER
              │
              ▼
        PLANNER + ROUTER
       ┌──────┼────────┐
       │      │        │
       ▼      ▼        ▼
   Worker A Worker B Reviewer
       │      │        │
       ├── Sandbox/Worktree/VM
       ├── Browser/Desktop
       ├── Tools/MCP/Files
       ├── Models via Router
       └── Memory/Skills
              │
              ▼
       VERIFIER / INTEGRATOR
              │
              ▼
       RESULT + ARTIFACTS
              │
              ▼
      MONITOR / REPAIR / LEARN
```

## 5. Produktprinzipien

1. **Outcome first** — Eingabe ist ein Ziel, nicht zwingend ein Chat.
2. **Agent-first UI** — Agenten, Tasks und Zustände sind primäre UI-Objekte.
3. **Visible autonomy** — Autonomie ist sichtbar, steuerbar und auditierbar.
4. **Local by default** — lokale Daten/Modelle/Tools bevorzugbar; Cloud optional.
5. **Model agnostic** — Modelle sind austauschbare Ressourcen.
6. **Least privilege** — kein pauschaler Vollzugriff für UI oder Agenten.
7. **Verify before done** — „fertig“ erst nach Prüfschritt.
8. **Persistent state** — lange Tasks überleben Neustarts.
9. **Recoverable execution** — Checkpoints, Retry, Resume, Rollback.
10. **No fake UI** — jede Visualisierung hat einen echten Runtime-Datenpfad.
11. **Everything observable** — Agent, Tool, Modell, Kosten, Rechte, Logs, Artefakte, Dependencies.
12. **Portable product** — keine Installerpflicht, keine systemweite Zwangsabhängigkeit.

## 6. Kernmodule des Zielsystems

### Agent Runtime v2
- Goal Manager
- Planner
- Orchestrator
- Agent Registry
- Parent/Child Agents
- Agent Teams
- Queue + Concurrency
- Task DAG
- Checkpoints
- Retry/Recovery
- Pause/Resume/Cancel
- Reviewer/Verifier
- Artifact Registry
- Persistent Run Store

### Computer Use
- Browser Control
- Screen Capture
- Mouse/Keyboard
- Window/App Discovery
- App Launch/Focus
- DOM + Visual Mode
- Screenshot/Video Artifacts
- Human Takeover
- Protected Actions

### Capability Broker
- per-Agent Permissions
- per-Tool Policies
- File Scopes
- Network Scopes
- Secret Scopes
- Admin/Elevation Broker
- Audit Log
- Emergency Stop
- Approval Rules

### Memory v2 + Skills
- episodic/semantic/procedural/stable memory
- embeddings + keyword hybrid search
- relationship graph
- provenance
- importance + recency
- consolidation
- conflict detection
- project memory
- learned skills/SOPs
- skill validation/versioning

### Model Router
- capability matrix
- latency/cost/quality metrics
- task classifier
- local/cloud policy
- fallback
- multi-model competition
- judge/verifier routing
- context-budget management

### Observability
- event bus
- structured traces
- run timeline
- tool calls
- model calls
- cost/token usage
- CPU/RAM/GPU
- queue depth
- agent graph
- workflow graph
- error/recovery history
- artifact previews

## 7. Ziel-UX

OS soll sich wie ein **Operations Center für Intelligenz** anfühlen.

Primäre Views:

1. Dashboard
2. Command / Goal Center
3. Agent Control Center
4. Workflow Builder
5. Computer Use / Live Desktop
6. Memory Graph
7. Skills Library
8. Automations
9. MCP / Integrations
10. Models / Router
11. Files / Artifacts
12. System / Telemetry / Logs
13. Security / Permissions
14. Settings

## 8. Definition „fertiges OS“

OS gilt erst als ausgereift, wenn ein komplexer Zielauftrag diesen Zyklus vollständig durchläuft:

```text
Goal
→ Plan
→ Task DAG
→ mehrere isolierte Agents
→ Tool/Browser/Desktop-Arbeit
→ kontinuierliche Fortschrittsvisualisierung
→ Tests / unabhängige Verification
→ Ergebnis + Artefakte
→ Memory/Skill Update
→ Monitoring
→ Fehlererkennung / Repair
→ nachvollziehbarer Audit Trail
```

und dieser Ablauf Neustarts, Provider-Ausfälle und einzelne Agent-Fehler übersteht.

## 9. Priorität

Nicht mehr primär weitere Provider oder kosmetische Einzelfeatures hinzufügen.

**Top-Priorität ab jetzt:**

1. Agent Runtime v2
2. Persistent Runtime State + Event Bus
3. Sandbox/Capability Broker
4. Agent Control Center UI
5. Computer Use
6. Model Router
7. Memory v2 + Skills
8. Verification/Repair
9. 24/7 Automations
10. Release Hardening
