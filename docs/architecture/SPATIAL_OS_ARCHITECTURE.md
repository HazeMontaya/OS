# OS Spatial Architecture

## Ziel

OS wird als räumliches, ereignisgetriebenes KI-System aufgebaut. Die Benutzeroberfläche ist keine dekorative Visualisierung, sondern eine Echtzeitprojektion des tatsächlichen Systemzustands.

## Kernprinzipien

1. Headless-fähiger Rust-Core; die GUI ist strikt entkoppelt.
2. Event-driven Architektur mit versioniertem Protokoll zwischen Core und Frontend.
3. Capability-basierte Rechte für Tools, Agenten und Systemaktionen.
4. Memory, Knowledge Graph, Search und Agent Runtime sind getrennte, kombinierbare Subsysteme.
5. Modelle sind austauschbar und werden über einen Model Router gewählt.
6. Die 3D-Oberfläche zeigt reale Events, Zustände, Abhängigkeiten und Datenflüsse.
7. Klassische 2D-UI bleibt für Tabellen, Formulare, Logs und präzise Konfiguration erhalten.
8. Rendering darf den Core nie blockieren; Core-Prozesse müssen ohne GUI testbar bleiben.

## Ziel-Stack

- Core: Rust + Tokio
- Desktop: Tauri 2 / WebView2
- Frontend: TypeScript + React
- 3D: Babylon.js
- GPU: WebGPU + WGSL, WebGL-2-Fallback
- Persistenz: SQLite + Vector Store + Full-Text Index
- Architektur: Event Bus + Snapshot/Delta State Sync + Capability Security

## Logische Systemarchitektur

```text
OS
├── Core
│   ├── Runtime
│   ├── Events
│   ├── Protocol
│   ├── Storage
│   ├── Memory
│   ├── Knowledge Graph
│   ├── Search
│   ├── Agent Runtime
│   ├── Model Router
│   ├── Tool Runtime
│   ├── Automation
│   ├── Security
│   ├── Files/System
│   └── Observability
├── Desktop Runtime
│   └── Tauri 2
└── Experience Layer
    ├── React UI
    ├── Babylon.js Renderer
    ├── WebGPU/WGSL
    ├── Spatial UI
    ├── Knowledge Graph
    ├── Camera Intelligence
    ├── Effects
    └── Developer Inspector
```

## Event-System

Jede wichtige Aktion wird als Event publiziert. Ein Event enthält mindestens:

- event_id
- timestamp
- source
- target
- session_id
- trace_id
- parent_event_id
- event_type
- status
- duration
- confidence
- payload

Beispiele:

- UserInputCreated
- IntentDetected
- MemorySearchStarted
- MemoryHit
- AgentSpawned
- AgentStepStarted
- ModelInferenceStarted
- ToolCallStarted
- ToolCallFinished
- FileRead
- FileWritten
- KnowledgeNodeCreated
- KnowledgeEdgeCreated
- OutputGenerated
- ErrorRaised

Die Visualisierung konsumiert keine interne Modulimplementierung, sondern ausschließlich versionierte State-Snapshots und Event-Deltas.

## State Engine

Kanonischer Zustand:

```text
OSState
├── Runtime
├── Sessions
├── Agents
├── Models
├── Tools
├── Memory
├── Knowledge
├── Tasks
├── Automations
├── System
├── Security
└── VisualizationHints
```

Frontend-Synchronisation:

```text
Initial Snapshot
+ Event Stream
+ Batched Delta Updates
```

Events werden gebündelt, damit hochfrequente Token-, Graph- und Tool-Updates nicht einzeln über IPC übertragen werden.

## Memory

Memory ist mehrschichtig:

- Working Memory
- Episodic Memory
- Semantic Memory
- Procedural Memory
- Project Memory
- User Memory
- Environment Memory
- Historical Memory

Konsolidierung:

```text
Raw Event
→ Relevance
→ Classification
→ Entity Extraction
→ Relation Extraction
→ Deduplication
→ Contradiction Detection
→ Confidence Evaluation
→ Memory Write
→ Graph Integration
→ Embedding Update
```

## Knowledge Graph

Mögliche Node-Typen:

- Person
- Project
- Concept
- Memory
- File
- Directory
- Agent
- Model
- Tool
- Task
- Conversation
- Decision
- Observation
- Application
- Device
- Repository
- Process
- System

Mögliche Relationen:

- CREATED
- USES
- DEPENDS_ON
- BELONGS_TO
- REFERENCES
- LEARNED_FROM
- CONTRADICTS
- SIMILAR_TO
- EXECUTED
- GENERATED
- MODIFIED
- FAILED
- REQUIRES
- CONNECTED_TO

Node-Metadaten umfassen u. a. Bedeutung, Konfidenz, Erstellungszeit, letzten Zugriff, Zugriffszähler, Embedding, Zustand und Provenance.

## Retrieval

OS kombiniert mehrere Sucharten:

```text
Intent Analysis
→ Entity Resolution
→ Graph Search
→ Full-Text Search
→ Semantic Search
→ Temporal Search
→ Rank Fusion
→ Context Construction
```

## Agent Runtime

Ein Agent ist eine Runtime-Entität mit:

- Identity
- Objective
- Permissions
- Memory Scope
- Available Models
- Available Tools
- Context
- Plan
- Execution State
- Lifecycle

Lifecycle:

```text
Dormant → Spawned → Planning → Executing → Waiting → Evaluating → Completed
                                   ↘ Failed / Blocked / Cancelled / Suspended
```

Spezialisierte Worker-Agenten können temporär erzeugt und nach Abschluss wieder entfernt werden.

## Model Router

Provider-unabhängig:

- lokale Modelle
- OpenAI
- Anthropic
- Google
- Ollama
- OpenAI-kompatible APIs
- zukünftige Provider

Routing-Kriterien:

- Task-Typ
- Qualität
- Latenz
- Kontextfenster
- Kosten
- Datenschutz
- Tool-Support
- Verfügbarkeit
- lokale Hardware

## Tool Runtime

Jedes Tool besitzt ein Manifest mit:

- id
- name
- description
- schema
- permissions
- risk
- executable/provider
- capabilities

Tool-Kategorien:

- Filesystem
- Terminal/PowerShell
- Git/GitHub
- Browser/HTTP
- Database
- Clipboard
- Windows APIs
- Search
- Code Execution
- Applications
- MCP Adapter

## Security

Capability-basierte Berechtigungen:

- Filesystem.Read
- Filesystem.Write
- Filesystem.Delete
- Process.Start
- Process.Kill
- Network.Request
- Git.Commit
- Git.Push
- System.Settings.Read
- System.Settings.Write

Policy-Werte:

- ALLOW
- ASK
- DENY
- SANDBOX

Risikostufen:

- Level 0: Read-only
- Level 1: reversible Writes
- Level 2: Systemänderungen
- Level 3: externe/öffentliche Aktionen
- Level 4: destruktive oder sicherheitskritische Aktionen

Alle relevanten Aktionen erhalten einen Audit Trail und eine Trace-ID.

## Experience Layer

Der Void besitzt Tiefenschichten:

- Near Space: Input, fokussierte Objekte, Spatial Panels
- Mid Space: aktive Prozesse und relevante Knowledge-Nodes
- Deep Space: nicht fokussierte Memories und Cluster
- Background Space: Ambient-Partikel und entfernte Strukturen

Die visuelle Aktivität wird aus realen Events gespeist. Aktive Agenten, Memory-Abfragen, Tool-Aufrufe, Fehler und neue Knowledge-Relationen werden live dargestellt.

## Spatial Knowledge Graph

Positionen sind semantisch begründet. Nähe kann unter anderem bedeuten:

- semantische Ähnlichkeit
- Relationsstärke
- Aktualität
- Kontextrelevanz

Graph-Physik:

- Attraction
- Repulsion
- Cluster Gravity
- Collision
- Relation Constraints
- Temporal Drift
- Focus Pull

Große Graphen verwenden GPU-Compute oder Worker-basierte Layouts sowie Level-of-Detail.

## Level of Detail

- LOD 0: Lichtpunkt
- LOD 1: einfacher Node
- LOD 2: Node + Icon + Label
- LOD 3: Detaildarstellung + Beziehungen
- LOD 4: vollständiges Informationspanel

Semantic Zoom verändert den Informationsgehalt, nicht nur die optische Größe.

## Kamera

Kameramodi:

- FREE
- FOCUS
- FOLLOW
- TRACE
- OVERVIEW
- CINEMATIC

Jede Nutzereingabe unterbricht automatische Kameraführung sofort. TRACE folgt realen Prozessketten vom Input über Memory, Agent, Modell und Tool bis zum Ergebnis.

## Node-Design

Node-Klassen erhalten differenzierte räumliche Identitäten:

- Memory: weiche neuronale Strukturen
- Agent: aktiver Core/Orb
- Tool: geometrisches Modul
- File: flachere Datenstruktur
- Model: großer Compute-Core
- User: zentrale Identitätsstruktur

Visuelle Variablen werden funktional gemappt:

- Importance → Größe
- Activity → Puls/Bewegung
- Confidence → Stabilität/Schärfe
- Freshness → Intensität
- Risk → Ring/Boundary

## Input/Output

Multimodaler Input:

- Text
- Voice
- Dateien
- Bilder
- Clipboard
- URLs
- Code
- Ordner
- Drag & Drop
- Screen Context

Output-Modi:

- Conversational
- Artifact
- Spatial

## Voids / Workspaces

- Main Void
- Knowledge Void
- Memory Void
- Agent Void
- Developer Void
- System Void
- Settings Void
- Automation Void

Alle verwenden eine gemeinsame Rendering Engine; sie sind keine separaten Anwendungen.

## Rendering-Architektur

```text
Renderer
├── SceneManager
├── NodeRenderer
├── EdgeRenderer
├── ParticleRenderer
├── LabelRenderer
├── SpatialUI
├── CameraSystem
├── EffectsSystem
├── PickingSystem
├── LODSystem
└── PerformanceManager
```

React wird für klassische UI-Komponenten genutzt, nicht für massenhafte 3D-Nodes oder Partikelsimulation.

## Frontend-Zielstruktur

```text
apps/desktop/src/
├── app/
├── renderer/
├── void/
├── graph/
├── camera/
├── effects/
├── spatial-ui/
├── panels/
├── input/
├── state/
├── protocol/
└── workers/
```

## Performance

Ziel: stabile 60 FPS; optional 120 FPS auf geeigneter Hardware.

60-FPS-Framebudget: 16,67 ms.

Richtwerte:

- Simulation < 3 ms
- Rendering < 8 ms
- UI < 2 ms
- Rest < 3 ms

Adaptive Qualitätsstufen:

- LOW
- MEDIUM
- HIGH
- ULTRA

Dynamisch skalierbar:

- Partikelzahl
- Shadow Quality
- Post Processing
- Graph Density
- LOD Distance
- Resolution Scaling
- Antialiasing

Massenobjekte verwenden Instancing/Thin Instances, Shared Materials und Batched Geometry.

## Automation Engine

Automationen werden als persistente Graphen modelliert:

```text
Trigger → Condition → Agent → Tool → Decision → Action
```

Workflow-Nodes:

- Trigger
- Agent
- Model
- Tool
- Memory
- Condition
- Loop
- Transform
- Output
- Human Approval

## Observability

Erfasst werden:

- Metrics
- Logs
- Events
- Traces
- Failures
- Latency
- Memory Usage
- Token Usage
- Tool Usage
- Model Usage
- GPU/Renderer Performance

Ein Developer Inspector visualisiert Event Stream, Traces, IPC, Agenten, Memory, Graphzustand, Renderer und Performance.

## Crash Isolation

- UI-Absturz darf Persistenz/Memory nicht zerstören.
- Tool-Absturz darf den Core nicht beenden.
- Agent-Absturz darf andere Agenten nicht stoppen.
- Externe Prozesse erhalten kontrollierte Lebenszyklen.

## Bootstrap

```text
OS executable
→ Core bootstrap
→ Storage integrity
→ Configuration
→ Security
→ Memory
→ Knowledge Graph
→ Tool Registry
→ Model Registry
→ Agent Runtime
→ Desktop Shell
→ Renderer
→ Void Ready
```

Die sichtbare Startanimation muss genau diese realen Zustände widerspiegeln.

## Zielstruktur des Monorepos

```text
OS/
├── apps/
│   ├── desktop/
│   ├── cli/
│   └── devtools/
├── crates/
│   ├── os-core/
│   ├── os-runtime/
│   ├── os-events/
│   ├── os-storage/
│   ├── os-memory/
│   ├── os-knowledge/
│   ├── os-agents/
│   ├── os-models/
│   ├── os-tools/
│   ├── os-automation/
│   ├── os-security/
│   ├── os-system/
│   ├── os-search/
│   ├── os-files/
│   ├── os-observability/
│   └── os-protocol/
├── packages/
│   ├── ui/
│   ├── renderer/
│   ├── protocol/
│   ├── design-system/
│   └── visualization/
├── assets/
│   ├── shaders/
│   ├── models/
│   ├── textures/
│   ├── audio/
│   └── fonts/
└── docs/
    ├── architecture/
    ├── memory/
    ├── agents/
    ├── security/
    ├── visualization/
    └── decisions/
```

## Nicht verhandelbare Architekturregeln

1. Core funktioniert ohne GUI.
2. GUI visualisiert reale Zustände und keine erfundene Aktivität.
3. Alle wichtigen Aktionen erzeugen Events.
4. Jede relevante Aktion besitzt Provenance und Traceability.
5. Memory ist versionierbar und inspizierbar.
6. Rohdaten, Wissen und abgeleitete Schlüsse bleiben unterscheidbar.
7. Agenten benötigen explizite Fähigkeiten und Berechtigungen.
8. Tools besitzen klare Permission Boundaries.
9. Modelle sind austauschbar.
10. Rendering darf den Core nie blockieren.
11. 3D darf Bedienbarkeit und Barrierefreiheit nicht verhindern.
12. Jeder komplexe Vorgang muss zusätzlich textuell inspizierbar sein.
13. Spatial UI wird nur verwendet, wenn räumliche Darstellung Informationswert liefert.
14. Persistente Änderungen müssen, soweit technisch möglich, transaktional und reversibel sein.

## Umsetzungsreihenfolge

### Phase 1 – Foundation

- os-core
- os-events
- os-protocol
- os-storage
- Headless Runtime

### Phase 2 – Functional Void

- Babylon.js/WebGPU
- Camera
- Nodes
- Edges
- Labels
- Selection
- LOD

### Phase 3 – Core/Renderer Bridge

- Snapshot
- Event Stream
- Delta Batching
- Live Graph Updates

### Phase 4 – Memory + Knowledge

- Episodic/Semantic Memory
- Retrieval
- Knowledge Graph
- Provenance

### Phase 5 – Agents + Models

- Agent Lifecycle
- Orchestration
- Model Routing
- Trace Events

### Phase 6 – Tool Runtime

- Filesystem
- Terminal
- Git/GitHub
- Browser/HTTP
- System APIs
- MCP Adapter

### Phase 7 – Advanced Visualization

- GPU Particles
- Semantic Zoom
- Intelligent Camera
- Graph Physics
- Visual Process Traces

### Phase 8 – Spatial Workspaces

- Memory Void
- Agent Void
- Developer Void
- System Void
- Automation Void

### Phase 9 – Intelligence

- Memory Consolidation
- Relation Extraction
- Adaptive Retrieval
- Workflow Optimization
- Self-observability

## Akzeptanzkriterium für die erste echte Spatial-Version

Eine Eingabe wie `Analysiere mein OS Repository` muss einen realen Trace auslösen. Repository, Agent, gelesene Dateien, Tool-Aufrufe, Analyseergebnis und neu erzeugtes Wissen werden anhand echter Core-Events im Void sichtbar. Nach Abschluss ist der vollständige Ablauf im Audit/Trace Inspector nachvollziehbar.
