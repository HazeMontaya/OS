# OS System Structure

```text
OS/
├─ OS.exe                     portable desktop entry point
├─ Core/
│  ├─ Desktop/                Electron desktop shell source
│  ├─ Runtime/                local API, agent, providers, tools, memory, workflows, automations, MCP
│  ├─ UI/                     desktop-rendered web UI
│  └─ Scripts/                maintenance utilities
├─ Config/OS/                 runtime configuration + model catalog
├─ Workspace/                 agents, workflows, automations, MCP, skills
├─ AI-Brain/                  knowledge and operating instructions
├─ Models/                    local model/inference assets
├─ Data/                      mutable runtime data
├─ Logs/                      local logs
└─ resources/app/             Electron bootstrap inside packaged runtime
```

## Execution path

```text
OS.exe
  -> secure Electron main process
  -> same executable in ELECTRON_RUN_AS_NODE mode
  -> Core/Runtime HTTP API on 127.0.0.1
  -> OS UI
  -> Agent / Workflow / Tool / MCP / Memory systems
  -> generic provider layer
      -> OpenAI-compatible APIs
      -> Anthropic Messages API
      -> optional CLI/local adapters
```

The product distribution has no installer and no start script. The portable folder is the application.
