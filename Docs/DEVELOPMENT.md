# Development

## Requirements

- Node.js 22+
- npm
- Windows for portable Electron packaging

## Tests

```bash
npm test
```

The suite covers path containment, policy approvals, memory persistence, HTTP security, origin validation and Electron hardening.

## Runtime

```bash
npm start
```

Set provider API keys as environment variables. The model catalog remains in `Config/OS/models.json`.

## Adding a tool

Register a tool in `createToolRegistry` with:

- unique `name`
- human-readable `description`
- `capability`
- `mutating`
- async `execute(args)`

Do not bypass the policy engine.

## Adding a workflow

Create a JSON file under `Workspace/Workflows` with `id`, optional `name`/`description`, and `steps`. Supported step types are `tool` and `prompt`.

## Adding MCP

Register servers in `Workspace/MCP/servers.json`. MCP processes are started only when discovery or a call is explicitly authorized.
