# HazeMontaya OS

Autonomous multi-agent runtime with economic controls, governed tool execution, memory, revenue lifecycle, event audit trail, and a live agent-world dashboard.

## What is implemented

- **9 agents:** Governor, Research, Business, Engineering, Content, Finance, Operations, QA, Security.
- **Economic engine:** treasury, burn rate, runway and Explore/Operate/Optimize/Survival/Emergency modes.
- **Governance:** explicit decision classes, approval gates and spending limits.
- **Execution:** workspace-scoped file operations and allowlisted command execution.
- **Memory:** in-process memory with JSONL persistence.
- **Revenue engine:** opportunity scoring and lifecycle from discovery through measurement.
- **Autonomous runtime:** bounded `run_cycle()` / `run_cycles()` loop with event and memory instrumentation.
- **Audit events:** task, tool, heartbeat, revenue and accounting events.
- **Dashboard:** browser UI showing live runtime state and agent world; the UI can trigger autonomous cycles.

## Run

Install a current stable Rust toolchain, then:

```bash
cargo test --workspace
cargo run -p os-cli
cargo run -p os-dashboard
```

Open **http://127.0.0.1:8787** after starting the dashboard.

The dashboard is intentionally local-only by default. It does not expose the runtime to the public internet.

## Important runtime boundary

This repository contains real execution capabilities, but it is not yet a hardened production sandbox. Command execution is allowlisted and file access is constrained to the configured workspace, but there is currently no OS-level container isolation, CPU/memory quota, process timeout, secrets manager, payment provider, customer CRM, or production deployment controller.

Revenue accounting is an internal ledger. Recording revenue does not itself move money. Real payments require an explicitly configured payment/billing integration and owner-controlled credentials.

## Architecture

```text
Browser / Dashboard
        |
        v
   Runtime Loop
        |
   +----+-------------------------------+
   |    |        |       |              |
Memory Events  Economy Governance  Revenue
                     |
                     v
                 Execution
                     |
          Files / Allowlisted Commands
```

The world layer is a visualization of runtime state. It is not the authority for execution, accounting, governance, or memory.
