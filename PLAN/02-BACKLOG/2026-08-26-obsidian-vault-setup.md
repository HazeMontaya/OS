---
title: Obsidian Vault Full Setup & Implementierung
status: geplant
priority: hoch
created: 2026-08-26
deadline:
tags: [vault, obsidian, memory, integration, phase-1]
---

# Obsidian Vault Full Setup & Implementierung

## Ziel
OS soll den Obsidian Vault (AI-Brain) als primären Wissensspeicher und Wissensbasis nutzen — bidirektional, mit Tool-Integration und Agent-Unterstützung.

## Ausgangslage

| Komponente | Aktuell | Ziel |
|---|---|---|
| Runtime Memory | `Data/Memory/memory.jsonl` | Vault `10-MEMORY/` |
| Vault-Tools | Keine | `vault.read`, `vault.write`, `vault.search`, `vault.list` |
| Agent-Zugriff | Nur `fs.read/write` | Native Vault-Tools |
| Sync | Keiner | Bidirektional (JSONL ↔ Markdown) |
| MCP | Kein Vault-Server | Vault-MCP für externe Clients |

## Aufgaben

### Phase 1: Vault-Tools (Core)

- [ ] **Neues Modul: `vault.mjs`**
  - `vault.read(path)` — Notiz lesen (parses YAML-Frontmatter + Body)
  - `vault.write(path, content, frontmatter)` — Notiz erstellen/aktualisieren
  - `vault.search(query, folder?)` — Volltextsuche über alle .md Dateien
  - `vault.list(folder?)` — Ordnerinhalt auflisten
  - `vault.links(notePath)` — Wiki-Links `[[...]]` auflösen
  - `vault.backlinks(notePath)` — Welche Notizen verweisen hierhin?

- [ ] **In Tool-Registry einbinden**
  - Tools als `vault.*` registrieren
  - Agent hat Zugriff über bestehendes Tool-System

- [ ] **Pfad-Resolver anpassen**
  - Vault-Pfad: `ROOT/AI-Brain/`
  - Sandbox: Nur innerhalb von `AI-Brain/` erlaubt

### Phase 2: Vault als Memory-Speicher

- [ ] **`memory.mjs` erweitern**
  - `addMemory()` schreibt zusätzlich nach `10-MEMORY/YYYY-MM-DD-tag.md`
  - `searchMemory()` durchsucht auch Vault-Notizen
  - `listMemory()` kombiniert JSONL + Vault-Einträge

- [ ] **Markdown-Template für Memory-Einträge**
  ```markdown
  ---
  type: episodic | semantic | procedural
  tags: [tag1, tag2]
  source: user | agent | ui
  ts: 2026-08-26T22:00:00Z
  ---
  
  # MEMORY_EINTRAG
  
  Inhalt der Erinnerung.
  ```

- [ ] **Bidirektionaler Sync**
  - JSONL → Vault: Periodischer Export (Automation oder Workflow)
  - Vault → JSONL: Bei Änderung im Vault (File Watcher)
  - Konflikt-Resolution: Neuester Zeitstempel gewinnt

### Phase 3: Agent-Integration

- [ ] **Agent liest Vault bei Prompt**
  - System-Prompt enthält relevante Vault-Notizen
  - `vault.search()` als Teil des Agent-Loop

- [ ] **Agent schreibt in Vault**
  - Wichtige Antworten werden als Notizen gespeichert
  - Entscheidungen nach `50-DECISIONS/`
  - SOPs nach `60-SOPS/`

- [ ] **Vault-Index automatisch aktualisieren**
  - `VAULT-INDEX.md` wird bei Änderungen neu generiert

### Phase 4: MCP-Server (optional)

- [ ] **Vault-MCP-Server**
  - Externer MCP-Server für Vault-Zugriff
  - Tools: `vault_read`, `vault_write`, `vault_search`, `vault_list`
  - Für OpenCode, Claude und andere MCP-Clients nutzbar

## Technische Details

### Vault-Struktur (AI-Brain)
```
AI-Brain/
├── SYSTEM.md          ← Kernel-Regeln
├── AGENTS.md          ← Agent-Instruktionen
├── CLAUDE.md          ← Claude-spezifisch
├── MEMORY.md          ← Memory-Schema
├── VAULT-INDEX.md     ← Übersicht
├── 00-INBOX/          ← Eingang
├── 10-MEMORY/         ← Aktiver Memory-Speicher
├── 20-PROJECTS/       ← Projekte
├── 30-AREAS/          ← Verantwortungsbereiche
├── 40-KNOWLEDGE/      ← Wissen/Recherche
├── 50-DECISIONS/      ← Entscheidungen
├── 60-SOPS/           ← Skills/SOPs
├── 70-AGENTS/         ← Agenten-Definitionen
├── 80-AUTOMATIONS/    ← Automationen
└── 90-ARCHIV/         ← Archiv
```

### Frontmatter-Schema
```yaml
---
id: uuid
ts: ISO-8601
type: memory | decision | sop | note
tags: [string]
source: user | agent | system
status: active | archived
---
```

## Akzeptanzkriterien

- [ ] `vault.search("query")` findet relevante Notizen
- [ ] `vault.write()` erstellt gültige Markdown-Dateien mit Frontmatter
- [ ] Agent kann Vault-Notizen lesen und schreiben
- [ ] Memory-Einträge erscheinen in `10-MEMORY/` als Markdown
- [ ] `VAULT-INDEX.md` wird automatisch aktualisiert
- [ ] Bidirektionaler Sync funktioniert (JSONL ↔ Markdown)

## Abhängigkeiten

- `fs.read` / `fs.write` Tools (bereits vorhanden)
- `paths.mjs` — Vault-Pfad muss bekannt sein
- Keine externen Dependencies nötig (nur `node:fs`, `node:path`)

## Geschätzter Aufwand
- Phase 1: 2–3 Stunden
- Phase 2: 1–2 Stunden
- Phase 3: 1–2 Stunden
- Phase 4: 2–3 Stunden (optional)
