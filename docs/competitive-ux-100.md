# HazeMontaya OS — Competitive UX / Runtime Reference Atlas (100)

Stand: 2026-09-18

## Nutzungsregel

Diese Datei ist ein Design- und Architektur-Atlas. Wir übernehmen **Interaktionsmuster, Systemprinzipien und öffentlich dokumentierte Mechaniken**. Quellcode wird nur dann direkt wiederverwendet oder eingebunden, wenn die konkrete Lizenz dies erlaubt und die jeweiligen Copyright-/NOTICE-Pflichten erfüllt sind. Proprietäre Produkte dienen ausschließlich als UX-/Produktreferenz.

## 100 reale Referenzen

| # | Referenz | Oberfläche / Interaktion | Engine / Mechanik | Nutzen für HazeMontaya OS |
|---:|---|---|---|---|
| 1 | AutoGPT | AutoPilot, Agent-Liste, Marketplace, visueller Build-Canvas | Agenten, Workflows, Trigger, Runs, Kosten | Outcome-first Startseite + Agent Operating System |
| 2 | Microsoft AutoGen | Studio mit Agenten/Skills/Workflow-Komposition | Multi-Agent Messaging, Tools, Human-in-loop | Agenten-Graph + kontrollierte Delegation |
| 3 | AutoGen Studio | No-code Workflow-Builder | Komponenten, Agenten, Runs | Prototyping-UI für Multi-Agenten |
| 4 | AG2 | Protokoll-/AgentOS-orientierte Oberfläche | Agent-Kooperation, Tool-use, HITL | Agent-to-agent Contracts |
| 5 | CrewAI | Crew/Flow-orientierte Agentenansicht | Rollen, Tasks, Crews, Flows | Spezialisten + explizite Zuständigkeiten |
| 6 | LangGraph | Graph-basierte Studio-/Trace-Ansichten | Zustandsgraphen, Checkpoints, Branching | Durable Agent Graph |
| 7 | LangChain | Komponenten-/Integration-zentrierte Developer UX | Chains, Tools, Agents, Integrations | Tool-/Adapter-Schicht |
| 8 | Langflow | Schwarzer Canvas, Node-Graph, Playground | Component Graph, visuelles Wiring, API/MCP | Primäre Workflow-Editor-Metapher |
| 9 | Dify | App-/Workflow-/Knowledge-Oberflächen | LLM Apps, RAG, Workflow, Tooling | Productized Agent Builder |
| 10 | Flowise | Node-Canvas + Node Inspector | LangChain-basierte Flows | Schnelles Flow-Prototyping |
| 11 | OpenHands | Agent Terminal + Files + Task/Conversation | Coding Agent, Tool calls, sandboxed work | Engineering Control Room |
| 12 | SWE-agent | Issue-to-code Workflow | Repo navigation, patching, tests | Issue-/Task-driven Coding Agent |
| 13 | Aider | Terminal-first Pair Programming | Repo map, edit/commit loop | Minimaler Expert Mode |
| 14 | Cline | IDE Chat + Tool Permission UI | Plan/Act, files, shell, browser | Permission-aware Agent UX |
| 15 | Roo Code | Modes, Teams, Agent Roles | Code/Architect/Debug/Custom modes, MCP | Agent modes + specialization |
| 16 | Continue | IDE sidebar + model/tool configuration | Context providers, commands, agents | Extensible developer cockpit |
| 17 | PydanticAI | Code-first developer UX | Typed agents, structured outputs, dependencies | Strong contracts / typed plans |
| 18 | LlamaIndex | Data/knowledge-centric APIs | Ingestion, retrieval, query engines, agents | Knowledge plane |
| 19 | Haystack | Pipeline/component views | Components, pipelines, stores, agents | Reusable agent capabilities |
| 20 | DSPy | Program-/module-zentrierte UX | Declarative LM programs, optimization | Prompt/program optimization layer |
| 21 | Semantic Kernel | Planners/plugins/processes | Skills/plugins, orchestration | Enterprise connector model |
| 22 | Google ADK | Agent/Runner/Session/Workflow model | Graph workflows, state, HITL, tasks | Runtime vocabulary für Agent OS |
| 23 | CAMEL | Agent roles, simulation views | Role-playing, societies, environments | Simulation / research mode |
| 24 | MetaGPT | Software-company role visualization | SOP, PM/Architect/Engineer roles | Business + engineering org chart als Runtime |
| 25 | Letta | Stateful agent console | Memory, identity, channels, tools | Persistent identity + long-term state |
| 26 | Mem0 | Memory-centric experience | Memory extraction, update, retrieval | Memory service / policy |
| 27 | Graphiti | Context graph / provenance | Temporal graph, episodes, facts, ontology | Zeitliche Knowledge Graphs |
| 28 | Zep | Graph dashboard + logs/API view | Context graph infrastructure | Memory inspection + provenance |
| 29 | smolagents | Compact code-first agent API | Tool-calling, code agents | Lightweight worker engine |
| 30 | OpenAI Agents SDK | Agent/tool/session abstractions | Handoffs, tools, guardrails, tracing | Standardisierte Agent Contracts |
| 31 | n8n | Large node canvas + execution inspector | Event-triggered workflows, connectors | Business automation visual language |
| 32 | Node-RED | Flow editor + deploy/runtime states | Event-driven node flows | Low-friction integration canvas |
| 33 | Apache Airflow | DAG grid/graph + task logs | Schedules, dependencies, XCom, retries | Batch/workflow backbone |
| 34 | Dagster | Asset graph + run/event UX | Assets, jobs, sensors, materializations | Outcome/data asset visibility |
| 35 | Prefect | Flow/run dashboard | Retries, caching, events, automations | Resilient task execution |
| 36 | Temporal | Workflow/run detail | Durable execution, retries, timers, signals | Failure-safe autonomous loops |
| 37 | Inngest | Function/run timeline | Durable steps, events, cron, retries | Serverless-style durable agents |
| 38 | Trigger.dev | Run list + live streaming | Durable tasks, queues, retries, HITL | Long-running agent workers |
| 39 | Hatchet | Task/workflow dashboard | Durable workflows, queues, concurrency | Worker fleet orchestration |
| 40 | Kestra | YAML + visual workflow builder | Event-driven orchestration, plugins, AI Copilot | Human-readable workflow definitions |
| 41 | Argo Workflows | DAG/Steps graph + node logs | Kubernetes-native workflow CRDs | Container-native execution |
| 42 | Argo Events | Event-source / sensor concepts | Event buses, sensors, triggers | External trigger plane |
| 43 | Flyte | Workflow execution UI | Typed workflows, caching, artifacts | Reproducible jobs |
| 44 | Kubeflow Pipelines | ML pipeline graph | Pipeline components, metadata, artifacts | Model/research pipelines |
| 45 | Luigi | Dependency graph + task state | Task dependencies, scheduler | Simple dependency engine |
| 46 | Celery | Worker/queue/task monitoring | Distributed task queues | Worker economics |
| 47 | BullMQ | Jobs/queues UI ecosystem | Redis-backed queues, retries, repeaters | Queue primitive for web workloads |
| 48 | Restate | Durable services/tasks | Durable promises, retries, state | Simplified distributed state machine |
| 49 | Netflix Conductor | Workflow UI + execution graph | JSON workflows, tasks, workers | Long-running orchestration |
| 50 | Pipedream | Step builder + integration catalog | Event triggers, code steps, connectors | Connector-centric business automation |
| 51 | Grafana | Dense dashboards, variables, panels, drill-down | Time-series queries, alerts, transformations | Main telemetry visual language |
| 52 | Prometheus | Query-first metrics UI | Pull metrics, labels, alert rules | Runtime health signals |
| 53 | Jaeger | Trace waterfall + span details | Distributed tracing | Agent/tool latency inspection |
| 54 | OpenTelemetry | Instrumentation/telemetry model | Traces, metrics, logs | Vendor-neutral telemetry backbone |
| 55 | Sentry | Issue/project/error workflows | Event grouping, stack traces, releases | Failure triage |
| 56 | Langfuse | Trace tree, sessions, cost and prompt views | LLM traces, evals, prompts, cost | LLM-specific observability |
| 57 | Arize Phoenix | Span tables + evaluator traces | OpenTelemetry, tracing, evals | Agent quality/latency UI |
| 58 | Helicone | Request/LLM analytics | Gateway-style telemetry | Model cost + request analytics |
| 59 | MLflow | Run comparison + experiments | Tracking, registry, evaluations | Model/eval experiment plane |
| 60 | OpenLIT | LLM observability dashboards | OpenTelemetry instrumentation | Lightweight AI telemetry |
| 61 | SigNoz | Metrics/traces/logs in one UI | OpenTelemetry + ClickHouse | Self-hosted observability |
| 62 | Apache Superset | BI dashboards + SQL exploration | Semantic charts, SQL editor | Business intelligence layer |
| 63 | Metabase | Question-to-dashboard UX | Query builder + dashboards | Non-technical operator analytics |
| 64 | Redash | Query editor + simple dashboards | Saved queries, visualizations | Fast internal analytics |
| 65 | PostHog | Product analytics, funnels, sessions | Events, funnels, feature flags, experiments | Revenue/product feedback loop |
| 66 | Linear | Minimal command center + issue cycles | Issues, projects, cycles, views | Crisp operations UX |
| 67 | GitHub | Repo/PR/Issue/Actions surfaces | Git, reviews, Actions, Projects | Software execution control plane |
| 68 | GitLab | Integrated DevSecOps cockpit | Repo, CI/CD, issues, registry, security | End-to-end engineering plane |
| 69 | Jira | Issue workflows + boards | State machines, automation, workflows | Formal task lifecycle |
| 70 | Notion | Flexible document/workspace system | Blocks, databases, relations | Knowledge + operating handbook |
| 71 | Airtable | Spreadsheet/database hybrids | Tables, views, automations | Human-friendly structured operations |
| 72 | ClickUp | All-in-one task hierarchy | Tasks, docs, goals, automations | Operations hierarchy |
| 73 | Asana | Portfolio/task/timeline views | Projects, dependencies, rules | Cross-agent planning visualization |
| 74 | Monday.com | Board-based control center | Boards, automations, apps | Configurable operations surface |
| 75 | Plane | Open-source project management | Projects, cycles, modules, issues | OSS Linear-like reference |
| 76 | Outline | Clean docs/search UI | Collaborative knowledge base | Operator manual / memory UI |
| 77 | Mattermost | Channels + integrations | Team messaging + plugins | Human-agent collaboration |
| 78 | Rocket.Chat | Multi-channel workspace | Messaging, apps, integrations | Private communication plane |
| 79 | Zulip | Topic/thread-first conversations | Streams + topics | Structured multi-agent communication |
| 80 | Slack | Channels, threads, workflows | Events, apps, bots, workflow builder | External human collaboration |
| 81 | Discord | Communities/channels/live presence | Gateway events, bots, roles | Agent presence/community interaction |
| 82 | Figma | Infinite canvas + panels | Objects, components, multiplayer state | World/canvas interaction paradigm |
| 83 | Retool | App builder + inspector | Components, queries, actions | Internal admin/control interfaces |
| 84 | Appsmith | Low-code app editor | Widgets, queries, JS actions | OSS control-center pattern |
| 85 | ToolJet | Drag/drop app builder | Components, APIs, workflows | OSS operations dashboard |
| 86 | Budibase | App builder + data connectors | Forms, workflows, automation | CRUD/ops surface |
| 87 | Backstage | Software catalog + plugin portal | Catalog, templates, plugins | Agent/service catalog |
| 88 | Portainer | Infrastructure dashboard | Containers, stacks, registries | Runtime infrastructure management |
| 89 | Kubernetes Dashboard | Resource tree + object detail | Kubernetes API | Fleet/deployment inspection |
| 90 | Blender | 3D viewport + outliner + inspectors | Scene graph, objects, materials, tools | Spatial “agent world” mechanics |
| 91 | Godot | Scene tree + viewport + inspector | Node tree, signals, scenes | Lightweight interactive agent world |
| 92 | Unreal Engine | World Outliner + viewport + panels | Actor/component world model | High-end spatial visualization |
| 93 | Unity | Scene/HHierarchy/Inspector | GameObjects, components, scenes | Componentized agent simulation UI |
| 94 | OBS Studio | Modular dock/panel workspace | Sources, scenes, mixers | Operator-configurable workspace |
| 95 | Apache Guacamole | Browser-based remote desktop | Gateway to remote protocols | Remote execution inspection |
| 96 | JupyterLab | Tabs, terminals, notebooks, file browser | Kernel/session model | Research + execution workspace |
| 97 | VS Code | Sidebar, editor, terminal, panels | Extensions, tasks, debug adapters | Engineering cockpit |
| 98 | Eclipse Theia | Browser IDE shell | Extensions, services, editor widgets | Embedded developer cockpit |
| 99 | Penpot | Design system + infinite canvas | Components, design tokens, collaboration | Our UI design-system workflow reference |
| 100 | Excalidraw | Infinite whiteboard + object tools | Scene graph, selection, persistence | Lightweight graph/world authoring |

## Die wichtigsten UI-Muster

### 1. Command Center statt Chat-only

Die erste Oberfläche soll nicht wie ein Chatbot aussehen. Sie soll wie ein **Operating System für Agenten** funktionieren:

- globale Command Bar / Command Palette
- linke Navigation: Mission, Agents, Workflows, Revenue, Memory, Research, Engineering, Finance, Operations, Security
- obere Telemetrie: Treasury, Burn, Runway, Active Runs, Queue, Errors
- Hauptfläche: aktueller Arbeitsraum
- rechter Inspector: ausgewählter Agent/Run/Task
- untere Timeline: Live Events

### 2. Drei gekoppelte Perspektiven

**World View**: räumliche/3D Agentenwelt.

**Flow View**: Graph aus Agenten, Tools, Daten und Tasks.

**Run View**: zeitliche Ausführung mit Spans, Kosten, Inputs/Outputs und Entscheidungen.

Der gleiche Runtime-State wird in drei Visualisierungen projiziert.

### 3. Agent Cards

Jeder Agent erhält:

- Role
- Status
- Current objective
- Current task
- Cost/minute
- Revenue contribution
- Confidence / risk
- Last event
- Tools / permissions
- memory footprint
- health

Agenten sind nicht nur Avatare; sie sind **laufende Runtime-Entities**.

### 4. Workflow Canvas

Der Canvas übernimmt Mechaniken aus Node-/DAG-Systemen:

- drag/connect
- branching
- loop
- retries
- checkpoints
- subflows
- inputs/outputs
- replay
- run from node
- inspect payload
- pause/resume
- human approval gates

### 5. Runtime Timeline

Jeder Run bekommt:

- trigger
- planner decision
- model call
- tool call
- policy decision
- output
- cost
- duration
- retry count
- side effects
- artifact links

### 6. Revenue Surface

Business-Aktivität wird wie ein Produktionssystem visualisiert:

Discovery → Validation → Build → Sell → Deliver → Measure → Revenue

Darunter:

- opportunity value
- cost
- confidence
- conversion
- invoice state
- realized revenue
- margin
- customer retention

### 7. Survival / Treasury Surface

Kein abstrakter “survival emotion” indicator, sondern wirtschaftliche Telemetrie:

- spendable treasury
- reserved treasury
- daily burn
- runway
- revenue/day
- experiment budget
- emergency mode
- compute allocation

Economic mode steuert Priorisierung, nicht uneingeschränkte Selbstschutzmechaniken.

## Ziel-Style für HazeMontaya OS

### Design language

**Base**
- near-black blue-gray background
- elevated graphite panels
- thin cool-gray borders
- restrained cyan/teal accent
- amber warning
- semantic green for healthy
- red only for failure/blocked

**Geometry**
- 10–14px corner radius
- compact 8px spacing grid
- dense information layout
- limited shadows
- strong alignment
- monospace only for IDs, commands, metrics and logs

**Motion**
- 120–220ms state transitions
- subtle agent movement
- live event pulse
- no decorative motion during failures
- timeline animations tied to real events

**Typography**
- system sans for product UI
- monospace for technical payloads
- large numerical telemetry
- small uppercase section labels
- avoid oversized marketing headers inside the control plane

## Was wir NICHT übernehmen

- Proprietäre Marken, Logos oder unverwechselbare visual identities
- nicht lizenzkompatiblen Quellcode
- vendor-specific hosted assumptions
- “AI magic” animations without runtime meaning
- Chat-only control
- fake agent activity
- fake revenue
- hidden execution state

## HazeMontaya OS — Zielarchitektur aus dem Atlas

```
┌─────────────────────────────────────────────────────────────────┐
│ Command Bar │ Treasury │ Runway │ Active Runs │ Queue │ Errors │
├─────────────┬───────────────────────────────────────┬───────────┤
│ Mission     │                                       │ Inspector │
│ Agents      │            WORLD VIEW                 │           │
│ Workflows   │       3D / spatial projection        │ Agent     │
│ Research    │                                       │ Run       │
│ Engineering │                                       │ Task      │
│ Revenue     ├───────────────────────────────────────┤ Tool      │
│ Finance     │            FLOW / DAG                 │ Memory    │
│ Operations  │  agents → tasks → tools → outcomes    │ Policy    │
│ Memory      ├───────────────────────────────────────┤           │
│ Security    │          LIVE RUN TIMELINE            │           │
│ Settings    │ spans / decisions / costs / outputs   │           │
└─────────────┴───────────────────────────────────────┴───────────┘
```

## Priorisierte Implementierung

1. Mission Control shell
2. Agent registry + live status
3. Workflow canvas
4. Run timeline / trace viewer
5. Treasury + revenue cockpit
6. Memory / knowledge explorer
7. Human approval gates
8. 3D world projection
9. Marketplace / reusable agent templates
10. Operations / customer / billing surfaces

## Technische Leitplanken

- Rust runtime bleibt source of truth.
- UI liest Runtime-State über API/Event stream.
- Keine UI simuliert einen Run, wenn kein Runtime-Event existiert.
- Event IDs + timestamps werden für deterministische Replay-Fähigkeit ergänzt.
- Durable execution benötigt checkpoints und idempotente operations.
- Side effects benötigen governance classes.
- Model provider bleibt austauschbar.
- External connectors werden capability-scoped.
- Revenue metrics müssen zwischen erwarteter und realisierter Revenue unterscheiden.

## Primäre Open-Source-Referenzen für Implementierung

- LangGraph: graph/state execution
- Langflow: visual graph builder
- AutoGPT: agent/operator surfaces
- OpenHands: coding-agent cockpit
- Temporal: durable execution
- Trigger.dev / Inngest: long-running background execution
- Graphiti: temporal context graphs
- Langfuse / Phoenix: LLM traces and evaluations
- Grafana: telemetry dashboard language
- Linear / Plane: compact operations UX
- Figma / Excalidraw: canvas interaction
- Blender / Godot: world projection mechanics
- Backstage: service/agent catalog

