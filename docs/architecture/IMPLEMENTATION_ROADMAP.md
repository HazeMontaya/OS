# Spatial OS – Implementation Roadmap

Diese Roadmap übersetzt `SPATIAL_OS_ARCHITECTURE.md` in konkrete, prüfbare Arbeitspakete.

## Milestone A – Core Contract

- [ ] Versioniertes Event-Schema definieren.
- [ ] `OSState` und Delta-Modell definieren.
- [ ] Trace-/Correlation-IDs durch alle Core-Pfade führen.
- [ ] Event-Batching für UI-Transport implementieren.
- [ ] Headless-Core-Start ohne Desktop-UI sicherstellen.

**Done when:** Ein Testprogramm kann Core starten, Events erzeugen, Snapshot lesen und Deltas abonnieren.

## Milestone B – Renderer Foundation

- [ ] Babylon.js/WebGPU-Renderer initialisieren.
- [ ] WebGL2-Fallback implementieren.
- [ ] SceneManager und CameraSystem einführen.
- [ ] Node-/Edge-Renderer mit Instancing implementieren.
- [ ] Picking und Selection ergänzen.
- [ ] LOD 0–4 implementieren.
- [ ] Performance HUD und Frame-Timing hinzufügen.

**Done when:** 10.000 synthetische Nodes plus Edges bleiben interaktiv und die Kamera kann frei, fokussiert und im Overview-Modus navigieren.

## Milestone C – Live Event Projection

- [ ] Core-Event-Stream an Desktop koppeln.
- [ ] Event→Visual-Projection-Schicht implementieren.
- [ ] Agent-, Tool-, Memory-, Model- und Fehlerzustände visualisieren.
- [ ] TRACE-Kameramodus an echte Trace-IDs koppeln.

**Done when:** Ein Tool-Aufruf erzeugt ausschließlich durch reale Core-Events eine sichtbare Prozesskette im Void.

## Milestone D – Knowledge + Memory

- [ ] Episodic Memory Store.
- [ ] Semantic Memory Store.
- [ ] Knowledge-Node/Edge-Persistenz.
- [ ] Provenance-Modell.
- [ ] Hybrid Retrieval (Graph + Full Text + Vector + Zeit).
- [ ] Memory-Konsolidierung als separaten Worker ausführen.

**Done when:** Neue Erkenntnisse können gespeichert, begründet wiedergefunden und im Memory Void räumlich untersucht werden.

## Milestone E – Agent Runtime

- [ ] Agent Lifecycle State Machine.
- [ ] Tool- und Model-Capabilities pro Agent.
- [ ] Orchestrator + ephemere Worker-Agenten.
- [ ] Agent-Trace und Fehlerisolation.
- [ ] Cancel/Suspend/Resume.

**Done when:** Ein Orchestrator kann mehrere Worker ausführen; jeder Schritt bleibt auditierbar und im Void sichtbar.

## Milestone F – Capability Security

- [ ] Capability Registry.
- [ ] ALLOW / ASK / DENY / SANDBOX Policies.
- [ ] Risikostufen 0–4.
- [ ] Audit Trail.
- [ ] irreversible/destruktive Aktionen explizit absichern.

**Done when:** Kein Tool oder Agent kann eine nicht gewährte Capability ausführen.

## Milestone G – Spatial Workspaces

- [ ] Main Void.
- [ ] Memory Void.
- [ ] Agent Void.
- [ ] Developer Void.
- [ ] System Void.
- [ ] Automation Void.
- [ ] Settings als räumliche Navigation plus klassische Detailpanels.

**Done when:** Workspaces teilen Renderer, Navigation und State, ohne getrennte App-Instanzen zu erzeugen.

## Milestone H – Automation Graph

- [ ] Trigger/Condition/Agent/Tool/Decision/Action-Nodes.
- [ ] Persistente Workflow-Schemata.
- [ ] Validierung und Dry Run.
- [ ] Human-Approval-Nodes.
- [ ] Live Execution Trace.

**Done when:** Ein gespeicherter Workflow kann validiert, ausgeführt, pausiert und vollständig nachverfolgt werden.

## Milestone I – Hardening

- [ ] Crash-/Recovery-Tests.
- [ ] Datenbank-Migrationen.
- [ ] Renderer-Degradation bei schwacher GPU.
- [ ] Offline-/Provider-Ausfälle behandeln.
- [ ] Performance Regression Tests.
- [ ] Installer/Update/Signing Pipeline.

**Done when:** OS kann UI-/Tool-/Provider-Fehler überstehen, ohne Core-State oder persistente Daten zu beschädigen.

## Reihenfolge

`A → B → C → D → E → F → G → H → I`

A/B dürfen teilweise parallel laufen. C ist der entscheidende Integrationspunkt. Erweiterte visuelle Effekte kommen erst nach C, damit jede Animation an reale Systemzustände gekoppelt bleibt.
