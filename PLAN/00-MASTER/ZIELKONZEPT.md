---
title: OS Zielkonzept 2.0
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [concept, product, vision]
---

# OS Zielkonzept 2.0

## Produktname intern

**OS — Personal Agent Operating Environment**

## Was OS sein soll

Ein dauerhaft laufendes, portables Desktop-System, das Ziele annimmt und daraus überprüfbare Arbeit erzeugt.

## Was OS nicht sein soll

- kein ChatGPT-Klon
- kein VS-Code-Klon
- kein reiner Coding-Agent
- kein Modell-Wrapper
- kein Dashboard voller Fake-Karten
- kein unkontrollierter Admin-Prozess

## Interaktionsmodell

### Goal Card statt Chat als Primärmodell
Jeder größere Auftrag wird zu einem Goal:

- Titel
- Zielzustand
- Constraints
- Priorität
- Deadline optional
- benötigte Rechte
- geplante Agents
- Task Graph
- aktueller Fortschritt
- Risiken/Blocker
- Artefakte
- Verification
- Abschlussstatus

Chat bleibt als Kommunikationskanal innerhalb eines Goals erhalten.

## Agentenrollen

Standardrollen:

- **Lead/Orchestrator** — zerlegt und koordiniert.
- **Planner** — erstellt/aktualisiert Task DAG.
- **Researcher** — sammelt Evidenz.
- **Builder** — implementiert/ändert.
- **Computer Operator** — Browser/Desktop.
- **Tester** — führt Tests aus.
- **Reviewer** — prüft unabhängig.
- **Security Reviewer** — bewertet riskante Aktionen.
- **Integrator** — integriert Ergebnisse.
- **Monitor/Repair Agent** — überwacht fertige Arbeit.

Rollen sind Profile, keine fest verdrahteten Modelle.

## Agent Teams

Ein Goal kann automatisch ein Team erzeugen. Die Teamgröße wird dynamisch aus Komplexität, Ressourcen und Risiko bestimmt.

### Beispiel

```text
Goal: "OS Workflow Builder fertigstellen"

Lead
├─ Planner
├─ UI Builder (worktree A)
├─ Runtime Builder (worktree B)
├─ Test Agent (sandbox C)
└─ Reviewer (read-only)
```

## Autonomiestufen

- **Observe** — nur lesen/analysieren.
- **Assist** — Änderungen vorbereiten, Approval vor Write/Execute.
- **Operate** — definierte Low-Risk-Aktionen autonom.
- **Autonomous** — innerhalb eines Capability-Scopes selbständig.
- **Mission** — Long-Running Goal mit Budget, Limits und Checkpoints.

Keine Stufe bedeutet pauschalen Vollzugriff.

## Abschlussregel

Ein Goal erhält `done` nur, wenn:

1. Deliverables vorhanden,
2. Tests/Verification erfolgreich,
3. offene Blocker = 0,
4. riskante Aktionen auditiert,
5. Artefakte gespeichert,
6. Memory/Skills aktualisiert,
7. optional User Approval erfolgt.
