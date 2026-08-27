---
title: Definition of Done — OS Produktreife
status: aktiv
priority: hoch
created: 2026-08-26
tags: [quality, acceptance, product]
---

# Definition of Done — OS Produktreife

## Funktions-Gates

- [ ] Multi-Agent-Goal mit mindestens 3 parallelen Workers.
- [ ] Task DAG mit Dependencies und Blocked-State.
- [ ] Persistenter Run State über Neustarts.
- [ ] Pause/Resume/Cancel.
- [ ] Checkpoint + Rollback.
- [ ] Reviewer/Verifier getrennt vom Builder.
- [ ] Browser- und Desktop-Computer-Use.
- [ ] Human Takeover.
- [ ] Capability Broker mit Least Privilege.
- [ ] Secret Broker ohne Klartext-Secrets in Logs/UI.
- [ ] lokales + Cloud-Modell-Routing.
- [ ] Memory v2 und Skills.
- [ ] Automationen/Condition Watches.
- [ ] Monitoring/Repair-Loop.

## UX-Gates

- [ ] Agent Control Center zeigt alle laufenden/queued/blocked Runs.
- [ ] Goal DAG ist interaktiv und live.
- [ ] Timeline zeigt Agent/Tool/Model/Approval/Artifact Events.
- [ ] keine tote Navigation.
- [ ] keine primären Roh-JSON-Ansichten.
- [ ] alle Aktionen haben Loading/Error/Success States.
- [ ] Keyboard/Command Palette.
- [ ] Dark/Light/System Themes.
- [ ] Screen Reader/Focus-Grundanforderungen erfüllt.

## Security-Gates

- [ ] Renderer ohne Node-Integration.
- [ ] API bindet lokal und authentifiziert lokale Clients.
- [ ] per-Agent Capability Grants.
- [ ] Admin-Rechte über separaten Broker.
- [ ] Netzwerk-Scopes.
- [ ] Dateisystem-Scopes.
- [ ] Audit Trail unveränderbar/append-only.
- [ ] Not-Aus beendet Agents/Tool Calls.
- [ ] Sandbox Escape Tests.

## Reliability-Gates

- [ ] Provider-Ausfall → Fallback ohne Goal-Verlust.
- [ ] Tool-Timeout → Retry/Alternative.
- [ ] Runtime Crash → Resume.
- [ ] UI Crash → keine Taskverluste.
- [ ] Disk Full / corrupted state → Recovery Path.
- [ ] 24h Soak Test.
- [ ] 100+ sequenzielle Runs ohne Memory-Leak.

## Release-Gates

- [ ] reproduzierbarer Build.
- [ ] SHA256.
- [ ] signierte Binary/Release.
- [ ] Changelog.
- [ ] Migrationsschema.
- [ ] Recovery Backup.
- [ ] keine Secrets im Repo/Artifact.
