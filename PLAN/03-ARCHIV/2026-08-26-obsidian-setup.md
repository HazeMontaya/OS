# Obsidian.exe Portable Setup

**Status:** Erledigt
**Datum:** 2026-08-26
**Dauer:** ~15 Min

## Zusammenfassung
Obsidian v1.12.7 als portable Version in S:\OS integriert.

## Durchgeführte Schritte
1. Offizielle Obsidian.exe von GitHub heruntergeladen (v1.12.7, ~282MB Installer)
2. NSIS Installer mit 7-Zip extrahiert (app-64.7z → Obsidian.exe + Dependencies)
3. Portable Obsidian installation in `S:\OS\Obsidian\` erstellt
4. Launcher erstellt: `S:\OS\Obsidian.cmd`
5. Portables Datenverzeichnis: `S:\OS\Data\Obsidian`
6. Temporäre Dateien bereinigt

## Dateistruktur
```
S:\OS\
├── OS.exe                    (Electron Runtime)
├── Obsidian.cmd              (Launcher für Obsidian)
├── Obsidian Direct.cmd       (Direktstart)
├── Obsidian\                 (Obsidian v1.12.7 Portable)
│   ├── Obsidian.exe
│   ├── resources\
│   ├── locales\
│   └── ... (Chromium DLLs)
├── Data\
│   ├── Obsidian\             (Obsidian App-Daten)
│   └── Memory\               (JSONL Memory)
└── AI-Brain\                 (Vault)
```

## Usage
- `S:\OS\Obsidian.cmd` — Startet Obsidian mit portablem Datenverzeichnis
- `S:\OS\Obsidian Direct.cmd` — Direktstart ohne cmd-Fenster
- Obsidian öffnet automatisch den zuletzt verwendeten Vault
- Für AI-Brain Vault: In Obsidian → Open vault → `S:\OS\AI-Brain` auswählen

## Technische Details
- Obsidian läuft mit `--user-data-dir=S:\OS\Data\Obsidian` (portable, keine AppData- Schreibvorgänge)
- Keine Installation nötig, kein Admin-Recht erforderlich
- ~350MB Gesamtgröße (Obsidian binaries)
- Kompatibel mit OS Runtime (gleiche Electron-Version, separate Ordner)
