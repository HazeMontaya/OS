# OS Architecture

## Control plane

The UI is a single local control plane with Command, Overview, Agents, Workflows, Memory, Tools/MCP and Security views. It communicates only with the loopback runtime.

## Runtime kernel

`Core/Runtime/src/kernel.mjs` composes independent services:

1. Event bus
2. Audit log
3. Policy engine
4. Memory store
5. Provider router
6. Tool registry
7. MCP manager
8. Workflow engine
9. Automation engine
10. Agent loop

The HTTP server is only an adapter. Business logic remains inside kernel services.

## Execution path

User request → agent → provider → proposed answer/tool → policy check → optional approval → tool/workflow execution → audit/event record → result.

## Data boundaries

- Configuration: `Config/OS`
- User definitions: `Workspace`
- Runtime state: `Data/Runtime`
- Logs: `Logs`
- Knowledge/instructions: `AI-Brain`

Runtime state, logs, credentials and model weights are not source-controlled.
