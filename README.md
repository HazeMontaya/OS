# AI Brain - S:\OS

Portable AI-powered knowledge management system for Windows.

## Purpose
A self-contained, portable AI assistant environment that runs entirely from `S:\OS`. Uses OpenCode, Claude, and Codex as AI backends with Obsidian for knowledge management.

## Architecture
```
S:\OS\
├── AI-Brain\          # Knowledge vault (P.A.R.A. structure)
├── Apps\              # Portable applications (Obsidian, VS Code, PowerShell)
├── Config\            # Application configurations
├── Core\Scripts\      # Internal maintenance scripts
├── Data\              # Data storage (Import/Export)
├── Docs\              # Documentation
├── Integrations\      # External integrations
├── Logs\              # System logs
├── Recovery\          # Recovery and quarantine
├── Runtime\Node\      # Node.js runtime
├── Tools\             # Git, npm-global tools
├── Workspace\         # Agents, Skills, Workflows
├── INSTALL_OS.cmd     # Installation entry point
├── START_OS.cmd       # Daily use launcher
└── README.md          # This file
```

## Installation
1. Double-click `INSTALL_OS.cmd`
2. Follow the setup wizard
3. Complete first-time login for Claude/Codex/OpenCode

## Daily Use
1. Double-click `START_OS.cmd`
2. AI Brain vault opens in OpenCode
3. Knowledge management via Obsidian

## Runtime
- **Node.js**: `S:\OS\Runtime\Node\` (LTS version)
- **Git**: `S:\OS\Tools\Git\`
- **Python**: Not required (optional via system)

## Configuration
- All configs stored in `S:\OS\Config\`
- No hardcoded user paths
- Environment variables set by `START_OS.cmd`

## Recovery
- Recovery files: `S:\OS\Recovery\`
- Quarantine: `S:\OS\Recovery\Quarantine\`
- Structure Guard: `S:\OS\Core\Scripts\Maintenance\StructureGuard.ps1`

## Diagnose
Run the structure check:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "S:\OS\Core\Scripts\Maintenance\StructureGuard.ps1"
```

The installer bootstrap is `Core\Scripts\Setup\Install-OS.ps1`. It prepares the
portable directory structure and verifies the required runtime components.

## Maintenance
Structure Guard checks for:
- Unauthorized root files
- Versioned filenames
- Hash duplicates
- Empty directories
- Dead references

Run manually:
```powershell
powershell.exe -File "S:\OS\Core\Scripts\Maintenance\StructureGuard.ps1" -Enforce
```
