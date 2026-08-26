# OS

Local-first AI desktop operating environment for Windows. OS combines a secure Electron shell, a modular Node.js runtime, provider routing, tools, memory, workflows, automations, MCP integrations, audit logging and a visual control plane.

## Architecture

- `Core/Desktop` — hardened Electron shell
- `Core/Runtime` — kernel, policy, audit, providers, agents, tools, memory, workflows, automations and MCP
- `Core/UI` — responsive AI control plane
- `Config/OS` — runtime policy and model catalog
- `Workspace` — user-defined agents, workflows, automations, MCP and skills
- `AI-Brain` — operating knowledge and system instructions
- `Data` — local runtime state
- `Models` — local model assets
- `Logs` — local logs

## Run from source

Requirements: Node.js 22+.

```bash
npm test
npm start
```

Open `http://127.0.0.1:43110`.

Provider credentials are read exclusively from environment variables. Copy `.env.example` as a reference; do not commit credentials.

## Security defaults

OS binds to loopback only. Electron runs with `contextIsolation`, sandboxing and Node integration disabled. Mutating tools require explicit approval by default. Shell execution is disabled by default and can be enabled only through `Config/OS/runtime.json`.

## Portable Windows build

GitHub Actions assembles a portable `OS-Windows-x64.zip`. The archive contains `OS.exe` plus the OS runtime/config/workspace. No installer is required.

## Documentation

See `Docs/ARCHITECTURE.md`, `Docs/SECURITY.md`, `Docs/DEVELOPMENT.md` and `Docs/ROADMAP.md`.
