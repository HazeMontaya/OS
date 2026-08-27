---
title: Markt-Benchmark Agenten/KI 2026
status: aktiv
priority: hoch
created: 2026-08-26
tags: [market, benchmark, competitors, agents]
---

# Markt-Benchmark Agenten/KI 2026

## Referenzsysteme

| System | Relative Reife | Was OS daraus übernehmen sollte |
|---|---:|---|
| Cursor 3 | 8.7/10 | Agent Window, Parallelität, Worktree/Sandbox, Review-Artefakte, Computer Use |
| ChatGPT Work + Codex | 8.6/10 | Long-running Work, Multi-Agent, Skills, Automationen, Supervision |
| Google Antigravity 2.0 | 8.5/10 | Desktop Agent Hub, dynamische Subagents, Scheduled Tasks |
| Devin | 8.2/10 | Parent/Child Agents, isolierte VMs, Session-/Knowledge-Management |
| Manus | 8.0/10 | General Agent, Browser/Desktop/Terminal, Plan Mode |
| MiniMax Agent/Mavis | 7.9/10 | Agent Teams, Memory, Skills, persönliche Automatisierung |
| Claude Code | 7.8/10 | starker Harness, Subagents, Hooks, Checkpoints, Background Tasks |
| Replit Agent 4 | 7.7/10 | parallele Tasks in Isolation, Canvas, Build→Monitor→Repair |
| OpenClaw | 7.6/10 | Local-First persönlicher Agent, dauerhafte Erreichbarkeit |
| OpenHands | 7.2/10 | Open Runtime, Sandboxes, Secrets, Enterprise-Orchestrierung |
| OS aktuell | 4.8/10 | Local First, portable, Model-neutral, eigener Core |

## Markttrend

Die dominante Bewegung ist:

```text
Chatbot
→ Tool-Using Agent
→ Long-Running Agent
→ Parallel Agent Teams
→ Agent Control Plane
→ Self-Driving Workflows / Operations
```

### Cursor
Cursor 3 positioniert die Oberfläche explizit um mehrere lokale/Cloud-Agenten, parallele Arbeit und nahtlose Übergaben. Cloud Agents erhalten eigene VMs und erzeugen Screenshots, Videos und Logs zur Verifikation.

**OS-Lektion:** Nicht nur Logs zeigen; Agenten müssen als eigene laufende Entitäten mit Umgebung und Artefakten sichtbar sein.

### Codex / ChatGPT Work
Codex Desktop ist ein Command Center für mehrere Agenten, isolierte Worktrees, Skills und Automationen. ChatGPT Work überträgt das Agentenmodell auf allgemeine Wissensarbeit und stundenlange Aufgaben.

**OS-Lektion:** Das Ziel muss über Coding hinausgehen; OS braucht eine einheitliche Runtime für technische und allgemeine Arbeit.

### Google Antigravity
Antigravity 2.0 setzt auf Desktop Agent Hub, parallele Agents, dynamische Subagents und geplante Tasks.

**OS-Lektion:** Parent/Child-Agenten + Scheduler gehören in den Core, nicht in Plugins.

### Devin
Devin kann weitere Devins delegieren; jeder Worker besitzt eine eigene isolierte VM. Die Hauptinstanz koordiniert Scope, Fortschritt, Konflikte und Resultate.

**OS-Lektion:** Lead-Agent + Worker-Agenten + isolierte Execution Environments.

### Claude Code
Lange autonome Sessions, Subagents, Hooks, Background Tasks und Checkpoints machen Claude Code zu einer Runtime-/Harness-Referenz.

**OS-Lektion:** Checkpoints, Hooks, Background Processes und Replay/Resume sind Pflicht.

### Replit Agent 4
Planung und Build laufen parallel; Tasks arbeiten in isolierten Umgebungen, werden erst nach Approval integriert. Monitoring schließt später den Produktionsloop.

**OS-Lektion:** Plan→Build darf nicht starr sequenziell sein. OS braucht Concurrent Planning, Isolation und Merge/Review.

## Strategische Differenzierung von OS

OS soll Marktführer **nicht kopieren**, sondern ihre besten Mechaniken lokal kombinieren:

- Cursor: Control-Plane UX
- Codex: Multi-Agent Worktrees + Skills
- Claude Code: Harness + Hooks + Checkpoints
- Antigravity: Orchestrierung + Scheduling
- Devin: Parent/Child + Isolation
- Manus: General Computer Use
- Replit: Build/Test/Monitor/Repair
- MiniMax: Memory + Agent Teams + persönliche Skills
- OpenClaw: Local-First Personal Agent
- OpenHands: offene Sandbox-/Runtime-Architektur

## Zielposition

**„Der lokale, provider-unabhängige Agent Operations Layer für den eigenen Computer.“**
