# System Structure

```text
OS/
├─ Core/
│  ├─ Desktop/
│  ├─ Runtime/
│  │  ├─ src/
│  │  └─ test/
│  └─ UI/
├─ Config/
│  └─ OS/
├─ Workspace/
│  ├─ Agents/
│  ├─ Automations/
│  ├─ MCP/
│  ├─ Skills/
│  └─ Workflows/
├─ AI-Brain/
├─ Data/
├─ Models/
├─ Logs/
├─ Docs/
└─ .github/workflows/
```

Operational code lives under `Core`. Definitions belong under `Workspace`. Mutable runtime state belongs under `Data` and `Logs`. Secrets never belong in the repository.
