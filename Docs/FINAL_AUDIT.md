# OS 1.0 Rebuild Audit

Date: 2026-08-27

## Rebuild scope

- Runtime decomposed into kernel services.
- Policy, audit and events added as first-class layers.
- Mutating actions now use explicit approval gates.
- Shell disabled by default.
- Root path containment enforced.
- Provider routing retained with environment-only credentials.
- MCP lifecycle isolated behind explicit authorization.
- UI rebuilt into Command, Overview, Agent, Workflow, Memory, Tool/MCP and Security views.
- Electron security hardened.
- CI consolidated around the root test suite.
- Portable Windows build updated to OS 1.0.

## Verification

Local Node.js 22 test run: 8/8 tests passed before commit.

## Preserved data

The rebuild intentionally preserves the existing `AI-Brain`, `Workspace`, `Config/OS/models.json`, model documentation and user data layout.
