# Bewertung von OS gegen den Agenten-Markt – Stand 26. August 2026

## Gesamturteil

Gemessen am Ziel **„eigenständiger lokaler Jarvis / AI Operating Environment“** liegt OS aktuell bei ungefähr:

### **OS: 4,8 / 10**

Das klingt niedriger als der technische Fortschritt vermuten lässt, hat aber einen Grund: Die Messlatte ist 2026 massiv gestiegen. Die stärksten Produkte sind keine Chatbots mit ein paar Tools mehr, sondern **Agent-Control-Planes**, die mehrere Agenten parallel orchestrieren, isolierte Computer bereitstellen, Aufgaben stundenlang fortführen, Ergebnisse prüfen, Zustände visualisieren und Arbeit später fortsetzen können.

OS hat dafür bereits eine ungewöhnlich gute **strategische Basis**: portable `OS.exe`, Local-First-Architektur, eigener Runtime-Core, Multi-Provider-Abstraktion, Tools, MCP, Memory, Workflows und Automationen.

Der aktuelle Agent selbst ist aber noch deutlich primitiver: Er arbeitet als einzelner Tool-Loop, entscheidet im Wesentlichen zwischen `answer` und `tool`, führt einen Tool-Call aus und iteriert danach weiter. Es gibt noch keinen echten Planner, Child Agents, Agent Teams, Execution DAG, persistenten Run-State oder parallele Ausführung.

---

## Vergleich mit den aktuell interessantesten Systemen

Die Werte sind **keine Benchmark-Scores**, sondern meine relative Produktreife-Bewertung bezogen auf dein OS-Endziel.

| SystemRelative ReifeWas momentan besonders stark ist |            |                                                                                             |
| ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| **Cursor 3**                                         | **8,7/10** | Agent-Control-Plane, parallele Agents, Computer-Use, Cloud Agents, Router, hervorragende UX |
| **ChatGPT Work + Codex**                             | **8,6/10** | General Agent + Coding Agents + Apps + Dateien + Browser + Multi-Agent + lange Tasks        |
| **Google Antigravity 2.0**                           | **8,5/10** | Desktop Agent Hub, parallele Agents, Subagents, Scheduling, Managed Agents                  |
| **Devin**                                            | **8,2/10** | komplette virtuelle Computer, Child Devins, Jira/Slack, autonome Softwarearbeit             |
| **Manus**                                            | **8,0/10** | General Agent, Cloud Computer, lokaler Computerzugriff, Browser, Plan Mode                  |
| **MiniMax Code / Agent**                             | **7,9/10** | Agent Teams, persistentes Memory, Skills, Desktop-Integration                               |
| **Claude Code**                                      | **7,8/10** | extrem starker Coding-Harness, lange autonome Runs, Subagents/Teams                         |
| **Replit Agent 4**                                   | **7,7/10** | Idee → fertige App, parallele Agents, visuelles Design, Deployment und Monitoring           |
| **OpenClaw**                                         | **7,6/10** | Local First, Model-unabhängig, dauerhafter persönlicher Agent, Messaging                    |
| **OpenHands**                                        | **7,2/10** | Open Source, Sandbox/Runtime, flexible Modelle, Agent-Plattform                             |
| **OS aktuell**                                       | **4,8/10** | Local First, eigene EXE, eigener Core, Multi-Model, MCP, volle Erweiterbarkeit              |

---

# 1. Cursor 3 — momentan wichtigste UI-Referenz für OS

Cursor 3 ist für dein Vorhaben wahrscheinlich der wichtigste Konkurrent bezüglich **Benutzeroberfläche und Agentenvisualisierung**.

Cursor hat den klassischen Editor praktisch zu einem **Agenten-Kontrollzentrum** umgebaut. Die Oberfläche kann mehrere Agenten über verschiedene Repositories und Umgebungen hinweg parallel steuern. Lokal, Worktree, Cloud und Remote-SSH werden in einer Oberfläche vereinigt. 

Noch wichtiger: Cursor-Cloud-Agenten besitzen eigene virtuelle Computer. Sie können die entwickelte Software selbst bedienen, Screenshots, Videos und Logs erzeugen und danach einen merge-fertigen PR liefern. Der Mensch kann sogar den Remote-Desktop des Agenten übernehmen. 

### Gegen OS

| FähigkeitCursorOS       |    |        |
| ----------------------- | -- | ------ |
| Agent Dashboard         | 10 | 2      |
| parallele Agenten       | 10 | 1      |
| Computer Use            | 9  | 2      |
| Agent Visualisierung    | 9  | 2      |
| Git/Worktree Isolation  | 10 | 2      |
| Modell-Routing          | 9  | 8      |
| Local First             | 6  | **10** |
| Provider-Unabhängigkeit | 8  | **9**  |
| volle Systemkontrolle   | 7  | **9**  |

Hier liegt aktuell einer der größten OS-Rückstände.

---

# 2. ChatGPT Work + Codex — stärkste General-Agent-Referenz

OpenAI hat den früheren separaten „ChatGPT Agent“ inzwischen zugunsten von **ChatGPT Work** ersetzt. 

Work kann:

-  Aufgaben über Apps und Dateien erledigen 
-  mehrere Stunden an Projekten arbeiten 
-  Dokumente, Tabellen, Präsentationen und Web-Apps erstellen 
-  geplante oder wiederkehrende Tasks ausführen 
-  Browser und Computer verwenden 
-  mit Codex zusammenarbeiten 
-  Agenten vom Desktop bzw. mobil überwachen. 

OpenAI gibt außerdem an, dass inzwischen **mehr als fünf Millionen Menschen Codex wöchentlich nutzen**. 

Codex selbst entwickelt sich klar zum Multi-Agent-Control-Plane: parallele Agenten, Worktrees und Cloud-Umgebungen gehören inzwischen explizit zum Produkt. 

### OS-Vorteil

OS kann langfristig etwas erreichen, was ChatGPT Work bewusst nicht ist:

> **vollständig kontrollierbares, lokales, herstellerunabhängiges Agent Operating System.**

Das ist eine echte Differenzierung.

---

# 3. Google Antigravity 2.0 — OS sehr ähnliche Vision

Google Antigravity 2.0 kommt der Vision von OS erstaunlich nahe.

Die eigenständige Desktop-Anwendung ist ein zentraler Agent Hub und bietet:

**mehrere parallele Agenten → dynamische Subagents → geplante Tasks → SDK → Managed Agents → persistente isolierte Umgebungen.** 

Google beschreibt Antigravity inzwischen ausdrücklich als Plattform für die Verwaltung **ganzer Kohorten autonomer Agenten**. 

Das ist exakt die Ebene, auf die OS kommen muss.

---

# 4. Devin — sehr wichtig für Multi-Agent-Architektur

Devin hat 2026 eine besonders interessante Funktion erhalten:

> **„Devin manages Devins.“**

Ein Devin kann weitere vollständige Devin-Instanzen starten. Jeder Child-Devin besitzt seine eigene isolierte VM. Der Lead-Devin übernimmt Scope, Koordination, Konflikte und Zusammenführung. 

Zusätzlich zeigt die Oberfläche:

```
```

```
Agents
Todos
PRs
Sessions
Tests
Knowledge
Jira
Linear
Slack
```

Das ist ein sehr gutes Vorbild für OS' geplantes Agent Studio.

---

# 5. Manus — direkte Jarvis-Konkurrenz

Manus ist für OS wahrscheinlich relevanter als viele reine Coding-Agenten.

Manus besitzt inzwischen:

**Cloud Computer + lokale Desktop-App + lokale Dateien + Terminal + Browser + VS Code + Plan Mode + persistente Cloud-Umgebungen.** 

Interessant ist insbesondere „My Computer“: Manus kann lokale Dateien lesen und ändern, Kommandozeilenprogramme benutzen und Anwendungen starten. 

Das überschneidet sich stark mit deinem OS-Konzept.

### OS kann Manus langfristig übertreffen bei

**lokaler Kontrolle + Providerfreiheit + eigener Runtime + lokaler Datenhaltung + MCP + beliebigen lokalen Modellen.**

Aber Manus ist momentan hinsichtlich UX, Autonomie und Computersteuerung deutlich weiter.

---

# 6. MiniMax Code — sehr genau beobachten

MiniMax Code ist konzeptionell ebenfalls gefährlich nah an OS.

Das Produkt bewirbt inzwischen:

> **„Remembers your habits, builds Agent teams, automates the repetitive work.“**

Dazu kommen:

-  persistentes Memory 
-  automatisch generierte Skills 
-  Agent Teams 
-  Schedules 
-  Chat-Integration 
-  lokale Dateien 
-  Desktop-App. 

MiniMax Agent zeigt mittlerweile auch bei Permission-Dialogen die **Begründung des LLMs**, warum eine Berechtigung notwendig ist. 

Das wäre ebenfalls eine sehr gute OS-UX-Idee.

---

# 7. Claude Code — Agent-Harness statt schönes Programm

Claude Code ist UI-technisch weniger relevant für OS, aber **runtime-technisch extrem relevant**.

Anthropic hat nach eigenen Messungen beobachtet, dass längere Claude-Code-Sessions inzwischen deutlich autonomer laufen; die längsten Sessions arbeiteten Anfang 2026 bereits über 45 Minuten ohne Stop. 

2026 entstand außerdem sehr großes Community-Interesse an Agent Teams bzw. kooperierenden Subagents. Ein stark diskutierter Reddit-Thread zum ursprünglichen Agent-Team-Modell erhielt mehrere hundert Upvotes. 

Für OS sollte deshalb gelten:

**Claude Code kopieren beim Agent Harness, nicht bei der UI.**

---

# 8. Replit Agent 4 — wichtig für „Ziel → fertiges Produkt“

Replit Agent 4 kombiniert inzwischen parallel arbeitende Agenten mit einem visuellen Canvas und kann Frontend, Backend, Auth und Datenbank gleichzeitig bearbeiten. 

Darüber hinaus führt Replit die Agenten nach Deployment weiter:

**Monitoring → Logs → Produktionsdatenbank → Fehlerdiagnose → Reparatur.** 

Das ist ein wesentlicher Reifeunterschied.

OS beendet seine Arbeit momentan hauptsächlich mit:

```
```

```
Agent → Tool → Ergebnis
```

Ein wirklich ausgereiftes OS braucht:

```
```

```
Ziel
 ↓
Plan
 ↓
Build
 ↓
Test
 ↓
Verify
 ↓
Deploy / Execute
 ↓
Monitor
 ↓
Detect Failure
 ↓
Repair
 ↓
Learn
```

---

# 9. OpenClaw — aktuell wichtigste Local-First-Referenz

Für dein spezifisches Ziel ist **OpenClaw besonders interessant**.

OpenClaw läuft auf dem eigenen Gerät, unterstützt Cloud-, Subscription- und lokale Modelle und speichert den Zustand lokal. Gleichzeitig kann der Agent über derzeit **29 Kommunikationskanäle** wie WhatsApp, Telegram, Discord, Slack oder Signal erreicht werden. 

OpenClaw beschreibt sich selbst nicht als Modell-Wrapper, sondern als:

> Local-First Control Plane für einen persönlichen AI-Assistenten.

Das ist strategisch sehr nah an OS.

Auch in der Local-LLM-Community tauchen OpenClaw, Hermes, OpenCode und ähnliche Systeme regelmäßig als relevante lokale Agenten auf. 

---

# 10. OpenHands — wichtigste Open-Source-Coding-Referenz

OpenHands bleibt eine starke Open-Source-Referenz und hat zehntausende GitHub-Stars sowie eine sehr aktive Release-Historie. 

Interessant sind insbesondere:

-  Sandboxes 
-  KVM 
-  Runtime API 
-  Automationen 
-  Agent Canvas 
-  Kostenmessung 
-  Secrets-Infrastruktur 
-  Kubernetes/Enterprise Deployment. 

Damit ist OpenHands technisch deutlich produktionsreifer als OS, aber **wesentlich weniger als persönliches Desktop-Jarvis-System positioniert**.

---

# Wo OS bereits außergewöhnlich stark positioniert ist

Hier wird der Vergleich interessanter.

### **Local First: 9,5/10**

Die fertige Anwendung kann als portabler Windows-Root laufen und besitzt die Runtime direkt neben `OS.exe`.

Viele Konkurrenten sind Cloud-first.

Das ist ein echter Vorteil.

### **Model Neutrality: 9/10**

Der Ansatz, OS nicht an Claude, OpenAI, Gemini oder Grok zu binden, ist strategisch richtig.

Langfristig sollte OS gleichzeitig verwenden können:

```
```

```
beste Reasoning-KI
+
billiges Fast-Modell
+
lokales Modell
+
Vision-Modell
+
Coding-Modell
```

und selbst routen.

Cursor geht inzwischen genau in diese Richtung und hat im Juli/August sogar einen eigenen **Cursor Router** vorgestellt, der automatisch Modelle auswählt. 

### **System Ownership: 9/10**

OS besitzt einen eigenen Runtime-Core.

Das bedeutet langfristig:

```
```

```
Agenten
Model Router
Memory
MCP
Tools
Workflows
Automationen
Computer Control
Permissions
Telemetry
```

können komplett unter eigener Kontrolle stehen.

Das ist wesentlich interessanter als ein bloßer Wrapper um Claude oder OpenAI.

---

# Wo OS momentan klar zurückliegt

Der wichtigste Befund ist die **UI**.

Die aktuelle Oberfläche ist faktisch noch:

```
```

```
Header
Stats
Prompt
Model Dropdown
Provider Dropdown
Memory
Workflows
Tools
Runtime JSON
```

Verglichen mit Cursor 3, Devin, Antigravity oder Manus ist das noch ungefähr **Prototyp-Niveau**.

Noch wichtiger ist aber die Runtime.

Der aktuelle Agent ist:

```
```

```
Prompt
 ↓
Memory Search
 ↓
Model
 ↓
answer ODER tool
 ↓
Tool
 ↓
Model
 ↓
...
```

Ein moderner Spitzenagent 2026 arbeitet eher:

```
```

```
Goal
 │
 ▼
Planner
 │
 ├──── dependency graph
 │
 ▼
Orchestrator
 │
 ├── Agent A ─ Sandbox A
 ├── Agent B ─ Sandbox B
 ├── Agent C ─ Browser
 └── Agent D ─ Reviewer
 │
 ▼
Verifier
 │
 ▼
Integration
 │
 ▼
Memory / Skills
```

Genau dort liegt die größte Differenz.

---

# Mein Zielranking für OS

OS sollte **nicht Cursor nachbauen**.

OS sollte versuchen, die stärksten Teile mehrerer Systeme zu kombinieren:

| ReferenzWas OS übernehmen sollte |                                        |
| -------------------------------- | -------------------------------------- |
| **Cursor 3**                     | Agent-Control-Plane + exzellente UX    |
| **Codex**                        | Worktrees + parallele Agenten + Skills |
| **Claude Code**                  | Agent Harness + Tool-Disziplin         |
| **Antigravity**                  | Agent-Orchestrierung + Scheduling      |
| **Devin**                        | isolierte Worker + Parent/Child Agents |
| **Manus**                        | Computer Use + General Tasks           |
| **Replit**                       | Build→Test→Deploy→Monitor Loop         |
| **MiniMax**                      | Memory + Skill Evolution + Teams       |
| **OpenClaw**                     | Local-First Personal Agent             |
| **OpenHands**                    | Sandbox + Runtime + Open Architecture  |

Das resultierende OS wäre dann kein weiterer Coding-Agent, sondern etwas breiteres:

> **Local-First Personal AI Operating Environment mit beliebigen Modellen, persistentem Memory, Agent Teams, Computer Use, Workflows, Automationen, MCP und vollständiger visueller Kontrolle.**

---

# Was OS jetzt am dringendsten braucht

In dieser Reihenfolge sehe ich die größten Hebel:

1. **Agent Runtime v2** — Parent/Child Agents, parallele Runs, Task Graph, Queue, Dependencies, Pause/Resume, Retry, Recovery und persistenter Run-State. 
2. **Computer-Use Layer** — Browser, Screen, Maus/Tastatur, App-Steuerung, Screenshots, visuelle Validierung und kontrollierte Benutzerübernahme. 
3. **Agent Control Center UI** — Agenten als sichtbare Prozesse mit Status, Aufgaben, Entscheidungen, Tool Calls, Abhängigkeiten, Kosten, Modell, Memory, Logs und Artefakten. 
4. **Sandbox/Capability Broker** — jeder Agent bekommt eigene Rechte und Umgebung statt pauschaler Vollzugriff. 
5. **Memory v2 + Skills** — semantisches Memory, Projektgedächtnis, Beziehungen, Provenance, Zusammenfassungen und automatisch erlernte wiederverwendbare Skills. 
6. **Automatic Model Router** — Modellwahl nach Qualität, Kosten, Latenz, Kontext, Vision, Coding und lokal/cloud. 
7. **24/7 Agent Runtime** — Trigger, Scheduler, Events, Watcher, Notifications und Remote-Steuerung. 
8. **Self-Verification** — Tester/Reviewer-Agenten müssen Ergebnisse unabhängig prüfen, bevor OS einen Task als fertig markiert. 

## Fazit

**OS hat derzeit nicht die Produktreife der Marktführer.** Cursor, ChatGPT Work/Codex, Antigravity, Devin und Manus sind deutlich weiter bei Autonomie, paralleler Agentenarbeit, Computer Use und UX.

Aber OS besitzt eine Kombination, die kaum einer dieser Konkurrenten vollständig bietet:

> **portable + local-first + eigener Runtime-Core + herstellerunabhängig + lokale und Cloud-Modelle + MCP + eigenes Memory + eigene Workflows + vollständige Kontrolle über die Architektur.**

Wenn wir jetzt nicht mehr primär weitere Modelle hinzufügen, sondern **Agent-Orchestrierung, Computer Use, visuelles Control Center und persistenten Runtime-State** bauen, kann OS von einem **4,8/10-Prototyp** relativ schnell in die **7–8/10-Klasse** kommen.

Der größte Fehler wäre jetzt, OS zu einem schöneren Chatfenster auszubauen. **Der richtige nächste Schritt ist ein echtes Agent Operating System.**

Der Markt bewegt sich extrem schnell. Ich kann die relevanten Agenten/Programme fortlaufend beobachten und OS bei wichtigen neuen Funktionen oder viralen Trends neu benchmarken.

AI-Agenten-Markt laufend benchmarken
