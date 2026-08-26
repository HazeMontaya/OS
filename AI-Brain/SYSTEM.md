# OS System

OS is a local-first AI operating environment. Its purpose is to coordinate models, tools, memory, workflows and integrations through one observable control plane.

## Invariants

1. Preserve user data and project history.
2. Route privileged actions through the policy layer.
3. Never store credentials in source control.
4. Keep runtime services independently testable.
5. Record important actions in audit/event streams.
6. Prefer explicit capabilities over hidden implicit powers.
7. Keep external integrations replaceable through adapters.
8. Make system state visible in the UI.

The core agent may reason broadly, but execution authority is determined by tool capability and policy.
