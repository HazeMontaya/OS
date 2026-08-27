# Security Baseline

OS is designed for persistent personal and organizational knowledge. Security is therefore a product boundary, not a later hardening phase.

## Required invariants

- UI has no direct unrestricted shell access.
- Tools execute through explicit capability/policy checks.
- Credentials use OS secure storage; never Markdown, embeddings or graph payloads.
- API keys, passwords, private keys, session cookies and auth databases are excluded from semantic memory.
- Runtime cognition data is excluded from Git by default.
- All derived knowledge retains provenance.
- Destructive external actions require policy evaluation and an auditable event.
- Database migrations are versioned and rollback-aware.
- Release artifacts and updates must be signed before commercial distribution.

## Memory privacy classes

`normal → personal → confidential → secret_reference`

`secret_reference` stores metadata/location/reference only, not secret plaintext.
