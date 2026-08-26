# System Structure - S:\OS

## Canonical Directory Structure

```
S:\OS\
├── AI-Brain\                    # Knowledge vault (Git repo)
│   ├── 00-INBOX\               # Inbox for new items
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
│   ├── CLAUDE.md               # Claude configuration
│   ├── MEMORY.md               # Memory database
│   ├── SYSTEM.md               # System documentation
│   └── VAULT-INDEX.md          # Vault index
│
├── Apps\                        # Portable applications
│   ├── Obsidian\               # Obsidian editor
│   ├── PowerShell\             # PowerShell 7
│   └── VSCode\                 # Visual Studio Code
│
├── Config\                      # Application configurations
│   ├── Claude\                 # Claude Code config
│   ├── Codex\                  # Codex config
│   ├── gitconfig               # Git configuration
│   ├── npmrc                   # npm configuration
│   ├── Obsidian\               # Obsidian config
│   └── OpenCode\               # OpenCode config
│
├── Core\                        # Core system components
│   └── Scripts\                # Internal scripts
│       ├── Maintenance\        # Maintenance scripts
│       │   └── StructureGuard.ps1
│       ├── Diagnostics\        # Diagnostic scripts
│       ├── Integration\        # Integration scripts
│       ├── Runtime\            # Runtime management
│       └── Setup\              # Setup scripts
│
├── Data\                        # Data storage
│   ├── Import\                 # Import files
│   └── Export\                 # Export files
│
├── Docs\                        # Documentation
│   ├── SYSTEM_STRUCTURE.md     # This file
│   └── FINAL_AUDIT.md          # Audit results
│
├── Integrations\                # External integrations
│
├── Logs\                        # System logs
│   └── structure-guard.log     # Structure Guard log
│
├── Recovery\                    # Recovery and backup
│   ├── Quarantine\             # Quarantined files
│   └── Archive\                # Archived files
│
├── Runtime\                     # Runtime environments
│   └── Node\                   # Node.js LTS
│       ├── node.exe            # Node.js executable
│       ├── npm.cmd             # npm package manager
│       └── npx.cmd             # npx package runner
│
├── Tools\                       # Development tools
│   ├── Git\                    # Portable Git
│   └── npm-global\             # Global npm packages
│       ├── claude.cmd          # Claude Code CLI
│       ├── codex.cmd           # Codex CLI
│       └── opencode.cmd        # OpenCode CLI
│
├── Workspace\                   # Workspace components
│   ├── Agents\                 # Agent definitions
│   ├── Automations\            # Automation configs
│   ├── Capabilities\           # Capability adapters
│   ├── MCP\                    # MCP server configs
│   ├── Skills\                 # Skill definitions
│   └── Workflows\              # Workflow definitions
│
├── INSTALL_OS.cmd               # Installation entry point
├── START_OS.cmd                 # Daily use launcher
└── README.md                    # Main documentation
```

## File Placement Rules

### Root Directory
Only allowed:
- `INSTALL_OS.cmd` - Installation script
- `START_OS.cmd` - Daily launcher
- `README.md` - Documentation

### Scripts
All internal scripts go to `Core\Scripts\`:
- `Core\Scripts\Maintenance\` - Maintenance tasks
- `Core\Scripts\Diagnostics\` - Health checks
- `Core\Scripts\Integration\` - External integrations
- `Core\Scripts\Runtime\` - Runtime management
- `Core\Scripts\Setup\` - Installation scripts

### Configuration
All configs go to `Config\`:
- Application-specific subdirectories
- No hardcoded user paths
- Environment variables for portability

### Data
- `Data\Import\` - Files to import
- `Data\Export\` - Generated exports

### Logs
All logs go to `Logs\`:
- Setup logs
- Structure Guard logs
- Application logs

### Recovery
- `Recovery\Quarantine\` - Moved files with manifest
- `Recovery\Archive\` - Archived versions

## Naming Conventions

### Files
- Use lowercase with hyphens: `my-script.ps1`
- No version suffixes: `setup.ps1` (not `setup-v2.ps1`)
- No status suffixes: `config.json` (not `config-final.json`)

### Directories
- Use PascalCase: `MyDirectory`
- Singular preferred: `Agent` (not `Agents`)
- Descriptive: `Maintenance` (not `Misc`)

## Forbidden Patterns

### Filename Patterns
- Version suffixes: `V01`, `V02`, `-v1`, `-v2`
- Status markers: `-old`, `-new`, `-final`, `-copy`, `-backup`, `-test`
- Temporary: `-temp`, `-tmp`, `.bak`

### Directory Patterns
- Versioned: `legacy/`, `old/`, `new/`
- Status: `backup/`, `copy/`, `test/`
- Multiple roots: No parallel structures

## Structure Guard

The Structure Guard (`Core\Scripts\Maintenance\StructureGuard.ps1`) enforces:

1. **Root Structure** - Only allowed files/directories
2. **Filename Patterns** - No versioned filenames
3. **Hash Duplicates** - Detects identical files
4. **Empty Directories** - Removes unused folders
5. **Dead References** - Finds broken paths
6. **Cache Locations** - Ensures proper cache placement

### Usage
```powershell
# Check only (report issues)
.\StructureGuard.ps1

# Fix issues (move violations to quarantine)
.\StructureGuard.ps1 -Enforce

# Custom log location
.\StructureGuard.ps1 -LogFile "custom.log"
```

## Cost Policy

Default settings:
- `allowPaidServices = false`
- `allowAutomaticPurchases = false`
- `preferIncludedSubscription = true`
- `preferLocalFree = true`

OS never incurs costs without explicit user approval.
