# PLAN INDEX

## Master

| Datei | Zweck |
|---|---|
| [MASTERPLAN.md](00-MASTER/MASTERPLAN.md) | verbindliches Gesamtziel und Prioritäten |
| [IST-STAND-BEWERTUNG.md](00-MASTER/IST-STAND-BEWERTUNG.md) | Reifegrad und Gap-Analyse |
| [MARKT-BENCHMARK.md](00-MASTER/MARKT-BENCHMARK.md) | Vergleich mit aktuellen Agentensystemen |
| [ZIELKONZEPT.md](00-MASTER/ZIELKONZEPT.md) | Produktdefinition OS 2.0 |
| [ZIELARCHITEKTUR.md](00-MASTER/ZIELARCHITEKTUR.md) | technische Zielarchitektur |
| [UI-UX-VISUALISIERUNGSKONZEPT.md](00-MASTER/UI-UX-VISUALISIERUNGSKONZEPT.md) | Design-/Visualisierungskonzept |
| [ROADMAP.md](00-MASTER/ROADMAP.md) | Milestones M0–M9 |
| [DEFINITION-OF-DONE.md](00-MASTER/DEFINITION-OF-DONE.md) | Produktreife-Gates |
| [RISIKEN-UND-ENTSCHEIDUNGEN.md](00-MASTER/RISIKEN-UND-ENTSCHEIDUNGEN.md) | Risiken/ADRs |

## Aktuell — kritisch

| Datei | Priority |
|---|---|
| [runtime-state-event-bus](01-AKTUELL/2026-08-26-runtime-state-event-bus.md) | kritisch |
| [agent-runtime-v2](01-AKTUELL/2026-08-26-agent-runtime-v2.md) | kritisch |
| [capability-broker-security](01-AKTUELL/2026-08-26-capability-broker-security.md) | kritisch |
| [sandbox-worktree-runner](01-AKTUELL/2026-08-26-sandbox-worktree-runner.md) | kritisch |
| [agent-control-center-ui](01-AKTUELL/2026-08-26-agent-control-center-ui.md) | kritisch |
| [computer-use](01-AKTUELL/2026-08-26-computer-use.md) | kritisch |

## Aktuell — hoch

| Datei | Priority |
|---|---|
| [model-router](01-AKTUELL/2026-08-26-model-router.md) | hoch |
| [memory-v2-skills](01-AKTUELL/2026-08-26-memory-v2-skills.md) | hoch |
| [verification-repair](01-AKTUELL/2026-08-26-verification-repair.md) | hoch |
| [local-inference](01-AKTUELL/2026-08-26-local-inference.md) | hoch |
| [testing-release-hardening](01-AKTUELL/2026-08-26-testing-release-hardening.md) | hoch |

## Backlog (Legacy/Detail)

Bestehende Einzelpläne unter `02-BACKLOG/` bleiben erhalten, werden aber dem Masterplan untergeordnet.

## Referenzen

- [Originale Agenten-Marktbewertung](04-REFERENZEN/2026-08-26-agenten-marktbewertung-original.md)
- [Repository Snapshot](04-REFERENZEN/2026-08-26-repository-snapshot.md)
- [Marktquellen](04-REFERENZEN/2026-08-26-marktquellen.md)
- [Scoring-Methodik](04-REFERENZEN/SCORING-METHODIK.md)

## Sofortige Ausführungsreihenfolge

```text
1. Runtime State + Event Bus
2. Agent Runtime v2
3. Capability Broker + Sandbox
4. Agent Control Center UI
5. Computer Use
6. Model Router
7. Memory v2 + Skills
8. Verification / Repair
9. 24/7 Operations
10. Release Hardening
```
