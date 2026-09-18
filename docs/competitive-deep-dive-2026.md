# Competitive Deep Dive 2026 — Axial / SAM / Trev / Cayde / StarNet / Workspai / FreeLLMAPI / TradingAgents

Stand: 2026-09-18

Diese Analyse trennt verifizierbare öffentliche Merkmale von Annahmen. Sie dient als UX-, Produkt- und Architektur-Referenz für HazeMontaya OS.

## 1. Axial Studio

Quelle: https://www.axial.studio/
Die aktuelle Website ist eine Design-Studio-Präsenz und veröffentlicht dort keine belastbare technische Agent-Runtime. Der vom Nutzer genannte Agent-Harness-Kontext konnte als öffentlicher Social-Post-Kontext identifiziert werden: Agent harness, interactive plan mode, computer/browser use und loops.
Übernehmbares Muster: PLAN -> COMPUTER/BROWSER -> LOOP -> OBSERVE -> CONTINUE. Keine Behauptung über eine nicht dokumentierte interne Engine.

## 2. SAM — Simple Agent Manager

Quellen: https://github.com/raphaeltm/simple-agent-manager/ und https://www.simple-agent-manager.org/docs/overview/
Verifiziert: Open-source Control Plane für AI-Coding-Agenten; jeder Agent erhält einen isolierten Container auf einer VM; eigene Workspaces; parallele Agenten; Browserzugriff; Bring-your-own-cloud; mehrere Coding-Harnesses.
UX-Muster: Ergebnis beschreiben -> Umgebung provisionieren -> Agent arbeitet im echten Workspace -> Fortschritt streamen -> Artefakt oder PR erhalten.
Für HazeMontaya: AgentWorkspace als eigene Runtime-Ressource mit Lifecycle pending -> provisioning -> ready -> running -> sleeping -> recovery -> stopped.
Lizenz: AGPL-3.0. Daher Architekturprinzipien übernehmen, aber SAM-Servercode nicht direkt in einen anders lizenzierten Produktkern kopieren, solange AGPL nicht bewusst übernommen wird.

## 3. Trev's Agents

Quelle: https://trevsagents.com/
Verifiziert: Agent Builder, AI-Copilot, Bibliothek von 14 kommerziell positionierten Agenten, guided setup, live mission-control dashboard, Fokus auf Stores/Content/Research/Trading und eine Journey bis zum ersten Umsatz.
Produktprinzip: Nicht LLM-Zugriff verkaufen, sondern Idea -> Agents -> Operating setup -> Dashboard -> first revenue.
Für HazeMontaya: Outcome-first onboarding. Der Nutzer beschreibt das Ziel; das System schlägt Crew, Workflow, Budget und Permissions vor.

## 4. CaydeAI / CaydeOS

Quellen: https://caydeai.carrd.co/ und https://github.com/caydeai/Skills
Verifiziert: Public MIT Skills Repository; kostenlose niche-scout Skill; bezahlte nachgelagerte Skills product-shaper, product-drafter und launch-stack.
niche-scout folgt einer klaren Funnel-Logik: Scope -> Research -> Pattern Analysis -> Gap Identification -> Opportunity Pack -> Product -> Draft -> Launch.
Für HazeMontaya: Research Agent erzeugt evidenzbasierte Opportunity-Einträge; Business-Agent formt sie; Engineering/Content liefern Artefakte; Revenue-Agent misst Realisierung; Finance erfasst Kosten und tatsächlichen Umsatz.
UX-Lehre: Der Benutzer muss nicht wissen, welcher Agent welchen Schritt ausführt. Er wählt das Ergebnis, nicht die interne Orchestrierung.

## 5. androoAGI / StarNet

Quelle: https://github.com/androoAGI/starnet
StarNet ist die direkteste Referenz für HazeMontayas räumliches Runtime-Modell.
Verifiziert: local-first Desktop-Harness; echte Model-Calls, Tools und Kosten; Crew statt Chatbot; pro Agent eigener Workspace, Transcript, Memory und bounded permissions; Telegram/Discord/Slack/Signal/Matrix; Night Shift mit Leash; Recipes, Skills, Schedules; Task Briefs; OUTBOX; MCP; Voice; persistente Ledgers; Shared Event/Schema Contracts.
StarNets Produktgesetz ist besonders relevant: Die Oberfläche darf keinen Zustand behaupten, den der Harness nicht beweisen kann.
Architektur: Frontend = World/UI; Sidecar = Provider/Tools/Persistence/Budgets/Consent; Shared = Event/Schema contracts; Tauri = Desktop shell; Tests/QA = Release authority.
Lizenz: MIT für Code. Name, Logo, Artwork, Sprites und Brand Identity sind ausdrücklich nicht Teil der MIT-Lizenz.

### StarNet Mechanik A — Rooms
Räume sind semantische Capability-Grenzen, nicht nur Dekoration.
HazeMontaya: Room { id, name, allowed_agents, capabilities, ingress, egress }

### StarNet Mechanik B — Handoffs
Hallways sind autorisierte Handoff-Lanes.
HazeMontaya: Edge { from, to, allowed_payloads, policy, max_hops }

### StarNet Mechanik C — Objects
Platziertes Objekt kann einen echten Capability-Grant repräsentieren.
HazeMontaya: WorldObject { id, kind, position, capability_grants }

### StarNet Mechanik D — Work-item Conveyor
Ein sichtbares Transportobjekt entspricht einem echten Auftrag. Keine dekorativen Kisten, kein Auto-Spawn ohne Arbeit.
Übernehmbar: WorkItem, gerichtete Kanten, SPLITTER, FILTER, MERGER, Backpressure, Kapazitätsgrenzen, Hop-Cap, Cost-Cap, E-Stop und Preservation des letzten guten Outputs.

### StarNet Mechanik E — Agentic Chain
Output eines Agenten kann der Input des nächsten Agenten werden. Die Kette läuft unter denselben Handoff-Regeln wie die physische Welt.
HazeMontaya: WorkGraph Node -> Edge -> Node; visited-set; cycle blocking; hop limit; explicit output attribution.

## 6. Workspai — System View

Quellen: https://www.workspai.com/ und https://www.workspai.dev/learn/workspace-graph
Workspai ist keine neue Chat-App, sondern eine Evidence-backed Workspace Intelligence Layer.
Verifiziert: canonical Workspace Model, Knowledge Graph, Project/Runtime/Framework/Lifecycle/Test/Ownership/Governance sematics, Impact Analysis, Doctor, Verification Gates, Agent Context und gemeinsame Evidenz für CLI, CI, IDE, Dashboard und Agenten.
Besonders wichtig: ein kanonisches Modell ist Source of Truth; Graph und abgeleitete Reports sind versioniert und gegen stale state abgesichert.
HazeMontaya sollte deshalb eine SystemModel-Schicht bekommen:
Workspace -> Projects -> Services -> Agents -> Tools -> Workflows -> Credentials -> Deployments -> Revenue -> Evidence
Jede kritische Aussage: entity -> relation -> evidence -> producer -> timestamp -> verification status.

## 7. FreeLLMAPI

Quelle: https://github.com/tashfeenahmed/freellmapi
Verifiziert: laut aktuellem README 34 free LLM providers, 635 free model endpoints, ein OpenAI-compatible /v1 Endpoint, Smart Routing, Automatic Failover, per-key usage, verschlüsselte Keys, signierter Model Catalog sowie Chat/Embedding/Image/Audio-Kompatibilität.
Zusätzlich beschreibt das Projekt Fusion: mehrere Modelle parallel anfragen und einen Judge zur Synthese einsetzen.
Wichtig: Free forever ist keine Garantie für zeitlich unbegrenzte oder universelle Providerquoten. Die Free-Tier-Limits und Nutzungsbedingungen der jeweiligen Anbieter bleiben maßgeblich.
HazeMontaya Model Router:
request -> capability classifier -> budget -> latency -> provider health -> quota -> model score -> primary -> fallback chain.
Optional Fusion: N drafts -> judge -> result; jede Route erzeugt einen Routing Trail und echte Kostenmetriken.

## 8. TradingAgents / Ray Fu

Quelle: https://github.com/TauricResearch/TradingAgents
Verifiziert: Apache-2.0; Multi-Agent-Finance-Framework; mehrere spezialisierte Analysten; adversarial Bull/Bear-Debate; Trader; Risk/Decision review; Portfolio Manager; strukturierte Outputs; LangGraph Checkpoints; persistente Decision Memory; Point-in-time-Datenintegrität. Das aktuelle README nennt v0.5.0 im September 2026.
Die übertragbare Mechanik ist nicht Trading selbst, sondern kontrollierte Entscheidungsorganisation:
Analyst -> Counter-Analyst -> Debate -> Planner -> Risk/Policy Veto -> Executor -> Outcome -> Reflection -> Memory
Für große Business-, Finance-, Code- oder Deployment-Entscheidungen ist dies robuster als ein einzelner allmächtiger Agent.

DecisionRecord:
hypothesis, evidence, action, expected_outcome, actual_outcome, delta, lesson, confidence

## 9. Gemeinsame Muster

1. One source of truth: Runtime, SystemModel und Event Contract sind die Wahrheit; UI ist Projektion.
2. Outcome first: Nutzer wählen Resultate, nicht Agentenverkettungen.
3. Real work + proof: sichtbarer Fortschritt braucht Event, Artifact, Receipt, State Transition oder Verified Measurement.
4. Isolated workspaces: eigener Workspace, Memory, Permissions und Budget-Kontext pro Agent.
5. Durable execution: Checkpoint, Retry, Timeout, Resume und Idempotency.
6. Adversarial checks: Planner -> Critic -> Risk -> Governor -> Execute.
7. Economic routing: expected value minus compute cost minus risk penalty minus opportunity cost.
8. Spatial semantics: Position, Role, Capability, Route und State müssen mit echten Runtime-Entitäten verknüpft sein.

## 10. Zielbild für HazeMontaya OS

Surface Layer: Mission, Agents, World, Flow, Run, Revenue, Research, Engineering, Finance, Memory, System, Security.
Runtime Layer: Governor, Scheduler, Planner, Model Router, Capability Registry, Workspace Manager, Workflow Engine, Work Graph, Event Bus, Memory, Knowledge Graph, Revenue Engine, Treasury, Evolution.
Verification Layer: Evidence, Receipts, Checks, Tests, Policy decisions, Cost accounting, Outcome evaluation, Rollback.
World Layer: Rooms, Agents, Workstations, Handoffs, Work Items, Queues, Artifacts, Treasury Core.

## 11. Priorität

P0: Event IDs und Versionierung; deterministic WorkGraph; durable checkpoints; AgentWorkspace lifecycle; ModelRouter; DecisionRecord.
P1: Capability-scoped WorldModel; Work-item visualization; System View; Run Trace; Agent Inspector; Revenue Mission pipeline; Adversarial planner.
P2: echte 3D Engine; Night Shift; Connector Marketplace; Agent Templates; Fusion; Temporal Knowledge Graph; autonome Optimierung.

## 12. Code-Reuse und Lizenz

Geeignete offene Basen: StarNet MIT; Cayde Skills MIT; FreeLLMAPI MIT; TradingAgents Apache-2.0.
Nur Architektur-/UX-Referenz ohne direkten Code: SAM AGPL-3.0; Trev's Agents kommerziell; Axial ohne verifizierte öffentliche Harness-Codebasis.
Bei direkter Übernahme von Open-Source-Dateien: Lizenztext und NOTICE-Pflichten erhalten; keine fremden Namen, Logos, Sprites oder Marken übernehmen.

## 13. HazeMontaya Differenzierung

Nicht die Frage 'Wie viele Agenten haben wir?' entscheidet.
Das Produkt soll einen beweisbaren Loop bieten:
MISSION -> SYSTEM MODEL -> CREW -> WORK GRAPH -> GOVERNANCE -> EXECUTION -> EVIDENCE -> REVENUE -> TREASURY -> REFLECTION -> NEXT MISSION
Die 3D-Welt zeigt exakt denselben Zustand, den Scheduler, Work Graph, Memory, Treasury und Evidence Layer kennen.