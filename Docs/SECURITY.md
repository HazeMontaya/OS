# OS Security Model

## Default boundaries

- Runtime binds only to loopback.
- Renderer requests from arbitrary web origins are rejected.
- CSP restricts scripts, styles and network connections to the local application origin.
- Electron enables sandboxing, context isolation and web security.
- Node integration is disabled in the renderer.
- Permission requests, webviews and uncontrolled navigation are blocked.
- Filesystem tools are restricted to the OS root.
- Mutating tools require approval by default.
- Shell execution is disabled by default.
- Credentials are loaded from environment variables and never written to Git.

## Capability classes

`read`, `write`, `execute`, `network`, `admin`.

Every tool declares a capability. Policy checks occur before execution and are written to the audit log.

## Enabling shell access

Set `policy.allowShell=true` and add explicit commands to `policy.allowedShellCommands`. Keep `requireApprovalForMutations=true` unless a controlled deployment has another approval mechanism.

## Audit

Security-sensitive decisions and executions are stored as JSONL in `Data/Runtime/audit.jsonl`.
