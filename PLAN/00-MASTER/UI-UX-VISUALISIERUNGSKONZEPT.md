---
title: UI/UX und KI-Visualisierungskonzept
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [ui, ux, visualization, design-system]
---

# UI/UX und KI-Visualisierungskonzept

## Designziel

**Premium technical calm**: futuristisch, dunkel, präzise, ruhig, hochinformativ. Keine Gaming-Optik, kein Neon-Chaos, keine Dashboard-Karten ohne Zweck.

## Informationsarchitektur

### Sidebar
- Home
- Goals
- Agents
- Workflows
- Computer
- Memory
- Skills
- Automations
- Integrations
- Models
- Artifacts
- System

### Top Command Bar
- globale Suche
- Command Palette
- neues Goal
- aktiver Workspace
- globale Run Controls
- Benachrichtigungen
- Security State

### Statusbar
- Runtime
- Agents active/queued
- CPU/RAM/GPU
- Model Router
- Network
- Event Stream
- Current autonomy level

## Zentrale Visualisierungen

### 1. Agent Graph
Nodes = Agents; Edges = Delegation/Dependency/Communication.

Anzeigen:
- Rolle
- Modell
- Sandbox
- Status
- Laufzeit
- Budget
- aktueller Task
- Fehler

### 2. Goal Task DAG
- planned
- queued
- running
- blocked
- verifying
- done
- failed

### 3. Execution Timeline
Chronologische Events für Agent, Tool, Model, Approval, Checkpoint, Artifact und Error.

### 4. Computer Live View
- Agent-Screenshot/Remote Desktop
- aktuelle App
- Cursor/Focus
- letzte Aktion
- Take Over
- Pause
- Stop

### 5. Memory Graph
- Memory Nodes
- Entities
- Tags
- Projects
- Skills
- Provenance
- Conflicts

### 6. Model Router View
- gewähltes Modell
- Gründe als kurze Decision Summary
- Alternativen
- Latenz
- Kosten
- Kontext
- Qualitätsscore
- lokal/cloud

### 7. Security View
- aktive Capability Grants
- anstehende Approvals
- Secret Usage
- Admin Operations
- Netzwerkziele
- Audit Trail

## UX-Regeln

- „Warum?“ immer als kurze Decision Summary, nie versteckte Chain-of-Thought.
- Jede riskante Aktion zeigt Scope + Begründung + Folgen.
- Jeder Run hat Pause/Resume/Cancel.
- Jeder Agent hat „Open environment“.
- Jeder Fehler bietet Retry/Alternative/Inspect.
- Statusfarben semantisch konsistent.
- Keine Roh-JSON-Blöcke als primäre UX.
- Logs sind drill-down, nicht Hauptoberfläche.
- Fortschritt muss ohne Lesen eines Chats verständlich sein.

## Design System

Tokens für:
- Surface levels
- Typography
- Spacing
- Radius
- Elevation
- Motion
- Focus states
- Semantic status colors
- Graph node types
- Code/log styles
- Density modes
- Dark/Light/System theme

## Minimum UI Quality Gate

Eine neue Funktion gilt erst als UI-fertig, wenn:
- Empty/Loading/Error/Success States existieren,
- Keyboard Navigation funktioniert,
- Live-State echt angebunden ist,
- Detailansicht vorhanden ist,
- Aktionen Undo/Cancel oder Sicherheitsgrenzen berücksichtigen,
- responsives Layout nicht bricht.
