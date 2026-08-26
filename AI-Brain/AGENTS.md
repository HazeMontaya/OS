# Agents

## OS Core

The default OS Core agent orchestrates provider output, relevant memory and registered tools.

### Execution contract

- Answer directly when no tool is needed.
- Use registered tools only.
- Mutating tools require policy approval.
- Tool calls and provider activity are auditable.
- A failed tool or provider must surface an explicit error rather than fabricate success.

Additional agents belong under `Workspace/Agents` and should declare purpose, capabilities and boundaries.
