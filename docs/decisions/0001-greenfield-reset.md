# ADR-0001: Greenfield reset

Date: 2026-08-27
Status: Accepted

## Decision

The previous OS implementation is not used as the architectural foundation. `main` is rebuilt from a clean tree around a Rust kernel, Tauri desktop boundary, typed contracts and a state-driven Cognitive Void.

## Reasons

- eliminate inherited runtime/cache/binary coupling
- separate UI from privileged logic
- make provenance and temporal cognition foundational
- support commercial security and packaging from day one
- avoid decorative graph architecture disconnected from real system state

## Recovery

The pre-reset repository state is preserved on branch `legacy-before-greenfield-2026-08-27`.
