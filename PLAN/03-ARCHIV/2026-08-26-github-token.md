---
title: GitHub Token & Git Integration
status: erledigt
priority: hoch
created: 2026-08-26
erledigt: 2026-08-26
tags: [git, github, auth]
---

# GitHub Token & Git Integration

## Status: ERLEDIGT

## Was wurde gemacht

### Umgebungsvariablen
- `GITHUB_TOKEN` — User-Level + Machine-Level gesetzt
- `GH_TOKEN` — gh CLI konfiguriert

### Git
- `credential.helper = store` aktiviert
- `~/.git-credentials` mit Token hinterlegt
- User: AI Brain (`ai-brain@local.invalid`)

### gh CLI
- `~/.config/gh/hosts.yml` konfiguriert
- Authentifizierung als **HazeMontaya** bestätigt

### Netzwerk
- IPv6 auf WLAN deaktiviert (DNS-Problem behoben)
- Winsock + TCP/IP-Stack zurückgesetzt

## Ergebnis
- GitHub API erreichbar ✅
- git push/pull funktioniert ✅
- gh CLI funktioniert ✅
