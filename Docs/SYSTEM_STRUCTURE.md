# OS System Structure

```text
OS/
├─ AI-Brain/                  knowledge, memory guidance, operating rules
├─ Config/
│  └─ OS/runtime.json         runtime/provider/autonomy configuration
├─ Core/
│  ├─ Runtime/
│  │  ├─ src/                 server, agent, tools, memory, workflows, automations, MCP
│  │  ├─ fixtures/            protocol test fixtures
│  │  └─ test/                automated runtime tests
│  ├─ UI/                     local browser interface
│  └─ Scripts/                installation and maintenance
├─ Data/
│  ├─ Import/
│  ├─ Export/
│  └─ Memory/                 local runtime memory, ignored by Git
├─ Docs/
├─ Integrations/
├─ Workspace/
│  ├─ Agents/
│  ├─ Automations/
│  ├─ MCP/
│  ├─ Skills/
│  └─ Workflows/
├─ INSTALL_OS.cmd
└─ START_OS.cmd
```

## Execution path

```text
Browser/UI
  -> HTTP API
  -> OS Agent
  -> Memory context + Tool catalog
  -> AI Provider (OpenCode/Claude/Codex)
  -> Tool loop
      -> local tools
      -> MCP-discovered tools
  -> response + optional Memory
```

Workflows execute deterministic sequences of tools, memory writes and agent/provider steps. Automations invoke workflows on configured intervals.
