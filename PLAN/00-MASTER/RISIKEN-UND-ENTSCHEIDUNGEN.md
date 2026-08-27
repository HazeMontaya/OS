---
title: Risiken und Architekturentscheidungen
status: aktiv
priority: hoch
created: 2026-08-26
tags: [risk, adr, security, decisions]
---

# Risiken und Architekturentscheidungen

## R1 — Vollzugriff vs. Sicherheit

**Risiko:** Ein autonomer Agent mit permanentem Admin/Shell-Zugriff kann Daten löschen, Secrets lesen oder Systeme verändern.

**Entscheidung:** UI/Renderer niemals pauschal als Admin. Privilegierte Aktionen laufen über einen separaten Capability/Elevation Broker mit Scope, Begründung, Audit und optional Approval.

## R2 — Multi-Agent-Konflikte

**Risiko:** parallele Agents überschreiben Dateien oder konkurrieren um Ressourcen.

**Entscheidung:** Worktree/Sandbox pro Worker; Integration erst über Integrator/Review.

## R3 — Modell-Halluzination / falsches „Done“

**Entscheidung:** unabhängiger Verifier; tests/evidence required; Agent darf Abschluss nicht allein deklarieren.

## R4 — Provider-Lock-in

**Entscheidung:** Model Registry + generic transports + capability router; Provider IDs nie tief im Agent-Core verdrahten.

## R5 — UI wird Fake-Control-Plane

**Entscheidung:** jede UI-Komponente muss einen echten State/Event-Pfad besitzen. Keine Dummy-Telemetrie.

## R6 — Memory akkumuliert Fehler

**Entscheidung:** Provenance, confidence, conflict detection, TTL/decay, consolidation und Verifier für learned skills.

## R7 — Unkontrolliertes Self-Modification

**Entscheidung:** Core-Code-Änderungen nur in isoliertem Workspace, Tests + Review + explizite Integrationsregel. Kein direkter Self-Patch auf laufenden produktiven Core.

## R8 — Zu viele Modelle statt besserer Orchestrierung

**Entscheidung:** Providerbreite ist Basis, aber neue Modellintegration nur noch, wenn sie eine Capability-Lücke schließt oder Router-Qualität messbar verbessert.

## R9 — Portabler Root wird zu groß

**Entscheidung:** Programm-Runtime im Root; lokale Modellgewichte modular unter `Models/`; keine Multi-TB-Gewichte zwangsweise bundeln.

## R10 — Credentials

**Entscheidung:** Env-Variablen nur Übergang. Ziel: OS Credential Vault + Secret Broker + never-log policy.
