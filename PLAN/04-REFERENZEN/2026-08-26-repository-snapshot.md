# Repository Snapshot — 2026-08-26

## Verifizierter Stand

- Produkt wird als portable Windows-Desktop-Runtime beschrieben.
- `OS.exe` bündelt Electron/Node Runtime im portable Root.
- Core-Verzeichnisse: Desktop, Runtime, UI, Config, Workspace, AI-Brain, Models.
- Provider-Abstraktion unterstützt mehrere Cloud-Anbieter und Modellfamilien.
- Der aktuelle Agent ist noch ein einzelner Tool-Loop mit `answer` oder `tool` als primären Aktionen.
- Die aktuelle UI ist ein kompakter Prototyp mit Status, Command Center, Model/Provider-Auswahl, Memory, Workflows, Tools und Runtime-Metadaten.

## Konsequenz

Die nächste Entwicklungsstufe ist nicht ein weiterer Provider-Ausbau, sondern Runtime-Orchestrierung + Control-Plane UI + Security/Isolation.
