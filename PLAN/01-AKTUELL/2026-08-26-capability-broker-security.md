---
title: Capability Broker und Security Architecture
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [security, permissions, sandbox, admin]
---

# Capability Broker und Security Architecture

## Capabilities
- filesystem.read
- filesystem.write
- process.exec
- network.http
- browser.navigate
- computer.input
- secrets.read:<name>
- admin.elevate
- git.write
- mcp.call:<server/tool>

## Aufgaben
- [ ] policy schema
- [ ] grant scopes
- [ ] expiry
- [ ] approvals
- [ ] rationale summary
- [ ] deny/default
- [ ] audit
- [ ] emergency stop
- [ ] admin broker process
- [ ] allowlist/denylist
- [ ] risk classification

## Regel
Keine globale `allowShell=true`-Semantik als Endzustand.
