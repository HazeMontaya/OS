# System Structure — S:\OS

## Canonical Directory Layout

```
S:\OS\
├── AI-Brain\                    # Knowledge vault (P.A.R.A.)
│   ├── 00-INBOX\               # New items
│   ├── 10-MEMORY\              # Persistent memory
│   ├── 20-PROJECTS\            # Active projects
│   ├── 30-AREAS\               # Responsibility areas
│   ├── 40-KNOWLEDGE\           # Knowledge base
│   ├── 50-DECISIONS\           # Decision log
│   ├── 60-SOPS\                # Standard procedures
│   ├── 70-AGENTS\              # Agent definitions
│   ├── 80-AUTOMATIONS\         # Automation configs
│   ├── 90-ARCHIVE\             # Archive
│   ├── AGENTS.md               # Agent instructions
│   ├── CLAUDE.md               # Claude config
│   ├── MEMORY.md               # Memory database
│   ├── SYSTEM.md               # System rules
│   └── VAULT-INDEX.md          # Vault index
│
├── Apps\                        # Portable applications
│   ├── Obsidian\
│   ├── PowerShell\
│   └── VSCode\
│
├── Config\                      # Application configs
│   ├── Claude\
│   ├── Codex\
│   ├── Obsidian\
│   ├── OpenCode\
│   ├── gitconfig
│   └── npmrc
│
├── Core\Scripts\                # Internal scripts
│   ├── Maintenance\
│   │   └── StructureGuard.ps1
│   └── Setup\
│       └── Install-OS.ps1
│
├── Data\                        # Data storage
│   ├── Import\
│   └── Export\
│
├── Docs\                        # Documentation
│   ├── FINAL_AUDIT.md
│   ├── SYSTEM_STRUCTURE.md
│   ├── manifest.json
│   └── SOURCE.json
│
├── Integrations\                # External integrations (empty)
├── Logs\                        # System logs
├── Recovery\                    # Quarantine only
│   └── Quarantine\
│
├── Runtime\Node\                # Node.js LTS
├── Tools\                       # Git, npm-global
│   ├── Git\
│   └── npm-global\
│
├── Workspace\                   # Active workspace
│   ├── Agents\                 # Agent definitions
│   ├── Automations\            # Automation configs
│   ├── MCP\                    # MCP server configs
│   ├── Skills\                 # Skill definitions
│   └── Workflows\              # Workflow definitions
│
├── INSTALL_OS.cmd               # Installation entry point
├── START_OS.cmd                 # Daily use launcher
└── README.md
```

## Root Rules

Only allowed in root:
- `INSTALL_OS.cmd`
- `START_OS.cmd`
- `README.md`

## Naming

- Files: lowercase with hyphens (`my-script.ps1`)
- Directories: PascalCase (`MyDirectory`)
- No version suffixes (`-v1`, `-V02`)
- No status markers (`-old`, `-final`, `-backup`)

## Structure Guard

Enforced by `Core\Scripts\Maintenance\StructureGuard.ps1`:
1. Root structure compliance
2. No versioned filenames
3. No hash duplicates
4. Empty directory cleanup
5. Dead reference detection
6. Cache location enforcement

```powershell
# Check only
.\StructureGuard.ps1

# Auto-fix (quarantine violations)
.\StructureGuard.ps1 -Enforce
```
