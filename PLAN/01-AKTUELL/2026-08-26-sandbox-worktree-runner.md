---
title: Sandbox / Worktree Runner
status: aktiv
priority: kritisch
created: 2026-08-26
tags: [sandbox, git, isolation, runner]
---

# Sandbox / Worktree Runner

- [ ] Runner abstraction
- [ ] local workspace runner
- [ ] git worktree runner
- [ ] browser profile isolation
- [ ] process/resource limits
- [ ] temp directory per run
- [ ] network policy
- [ ] environment-variable allowlist
- [ ] cleanup/recovery
- [ ] artifact export
- [ ] optional WSL/Container runner

## Akzeptanz
Zwei Builder-Agents können gleichzeitig denselben Repo-Stand bearbeiten, ohne sich gegenseitig Dateien zu überschreiben.
