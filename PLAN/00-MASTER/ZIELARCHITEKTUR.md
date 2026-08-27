---
title: OS Zielarchitektur
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [architecture, runtime, modules]
---

# OS Zielarchitektur

## Ebenen

```text
┌─────────────────────────────────────────────────────────┐
│ Desktop UI / Voice / Remote / Notifications             │
├─────────────────────────────────────────────────────────┤
│ Control API + Event Stream + Command Bus                 │
├─────────────────────────────────────────────────────────┤
│ Goals / Tasks / Planner / Orchestrator                   │
├─────────────────────────────────────────────────────────┤
│ Agent Runtime + Scheduler + Queue + Run Store            │
├─────────────────────────────────────────────────────────┤
│ Model Router │ Memory │ Skills │ Workflow │ Automation   │
├─────────────────────────────────────────────────────────┤
│ Capability Broker / Secrets / Approvals / Audit          │
├─────────────────────────────────────────────────────────┤
│ Tools / MCP / Browser / Computer / Files / Shell         │
├─────────────────────────────────────────────────────────┤
│ Sandboxes / Worktrees / Containers / Local Machine       │
└─────────────────────────────────────────────────────────┘
```

## Zielverzeichnisse

```text
OS/
├─ OS.exe
├─ Core/
│  ├─ Desktop/
│  ├─ Runtime/
│  ├─ API/
│  ├─ Agents/
│  ├─ Planner/
│  ├─ Orchestrator/
│  ├─ Scheduler/
│  ├─ State/
│  ├─ Events/
│  ├─ Telemetry/
│  ├─ Security/
│  ├─ ComputerUse/
│  ├─ Browser/
│  ├─ Memory/
│  ├─ Skills/
│  ├─ Models/
│  ├─ Workflows/
│  ├─ Automations/
│  └─ UI/
├─ Config/
├─ Workspace/
│  ├─ Goals/
│  ├─ Agents/
│  ├─ Workflows/
│  ├─ Automations/
│  ├─ MCP/
│  ├─ Skills/
│  └─ Projects/
├─ Data/
│  ├─ State/
│  ├─ Memory/
│  ├─ Events/
│  ├─ Artifacts/
│  ├─ Sessions/
│  └─ Metrics/
├─ Models/
├─ Logs/
├─ Recovery/
└─ AI-Brain/
```

## State Store

Primäre persistente Entitäten:

- Goal
- Task
- Dependency
- AgentRun
- ToolCall
- ModelCall
- PermissionGrant
- Checkpoint
- Artifact
- Verification
- Event
- Memory
- Skill

SQLite eignet sich als lokale transaktionale Basis; große Logs/Artefakte bleiben dateibasiert. JSONL kann für Event-Append-Logs parallel bestehen.

## Event Bus

Jede relevante Aktion erzeugt ein Event:

```text
goal.created
task.planned
agent.spawned
agent.started
agent.message
tool.requested
tool.approved
tool.started
tool.completed
model.started
model.completed
artifact.created
verification.failed
checkpoint.created
agent.paused
agent.resumed
goal.completed
```

UI und Telemetrie lesen denselben Event-Stream.

## Isolation

Priorität:

1. Git Worktree für Code-Aufgaben.
2. Prozess-Sandbox für Shell/File-Aufgaben.
3. Browser-Profil/Sandbox pro Agent.
4. optional Windows Sandbox/WSL/Container für untrusted/high-risk Tasks.
5. Admin-Aktionen nur über separaten Elevation Broker.
