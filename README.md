# OS

Local-first AI operating runtime for Windows. The repository now contains an executable OS core rather than only a portable tool/vault layout.

## Start

```text
INSTALL_OS.cmd
START_OS.cmd
```

`INSTALL_OS.cmd` verifies the portable structure, Node.js >=20 and the runtime tests. `START_OS.cmd` runs StructureGuard and starts the local UI/API at `http://127.0.0.1:43110`.

## Implemented runtime

- Local HTTP API and browser UI
- Provider failover: OpenCode -> Claude -> Codex (configurable)
- Autonomous agent tool loop
- Local tool registry: system info, root-scoped file list/read/write, shell execution
- Persistent JSONL memory with deduplication/search
- JSON workflow engine
- Interval automation engine
- MCP stdio client: initialize, tools/list, tools/call
- Dynamic MCP tools can be registered into the agent tool registry
- Structured JSONL runtime logging
- Portable root detection
- Runtime tests and GitHub Actions CI

## Main paths

```text
AI-Brain/                 knowledge and operating instructions
Config/OS/runtime.json    OS runtime configuration
Core/Runtime/             executable Node.js runtime
Core/UI/                  local web interface
Core/Scripts/             setup and maintenance
Data/Memory/              runtime memory (local, ignored by Git)
Workspace/Agents/         agent definitions
Workspace/Workflows/      executable workflows
Workspace/Automations/    automation definitions
Workspace/MCP/            MCP server registry
```

## Provider configuration

Edit `Config/OS/runtime.json`. The runtime checks commands on `PATH`. The portable `START_OS.cmd` places `Runtime/Node`, `Tools/npm-global` and portable Git/PowerShell on `PATH` before the runtime starts.

Secrets must be supplied through environment variables or provider-native secure configuration; do not commit them.

## API

- `GET /api/health`
- `POST /api/chat`
- `GET|POST /api/memory`
- `GET /api/tools`
- `POST /api/tool`
- `GET /api/workflows`
- `POST /api/workflows/run`
- `GET /api/automations`
- `POST /api/automations/run`
- `GET /api/mcp`
- `POST /api/mcp/discover`
- `POST /api/mcp/call`

## Tests

```text
cd Core\Runtime
npm test
```

No third-party npm packages are required by the OS runtime.
