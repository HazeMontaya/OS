#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$requiredDirectories = @(
    "AI-Brain", "Apps", "Cache", "Config", "Core",
    "Data", "Data\Import", "Data\Export",
    "Docs", "Downloads", "Integrations", "Logs", "Recovery", "Recovery\Quarantine",
    "Runtime", "Temp", "Tools",
    "Workspace", "Workspace\Agents", "Workspace\Automations",
    "Workspace\MCP", "Workspace\Skills", "Workspace\Workflows"
)
$requiredFiles = @(
    "AI-Brain\AGENTS.md",
    "AI-Brain\MEMORY.md",
    "AI-Brain\SYSTEM.md",
    "Core\Scripts\Maintenance\StructureGuard.ps1"
)
$components = [ordered]@{
    "Node.js" = "Runtime\Node\node.exe"
    "Git" = "Tools\Git\cmd\git.exe"
    "OpenCode" = "Tools\npm-global\opencode.cmd"
}

foreach ($relativePath in $requiredDirectories) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $relativePath) | Out-Null
}

$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path (Join-Path $Root $_)) })
$missingComponents = @($components.GetEnumerator() | Where-Object { -not (Test-Path (Join-Path $Root $_.Value)) })

Write-Host "Portable OS bootstrap completed at $Root" -ForegroundColor Cyan
if ($missingFiles.Count -gt 0) {
    Write-Warning "Required repository files are missing: $($missingFiles -join ', ')"
}
if ($missingComponents.Count -gt 0) {
    Write-Warning "Components are missing: $(($missingComponents | ForEach-Object { $_.Key }) -join ', ')"
    Write-Host "Place the portable components under S:\OS or install them before running START_OS.cmd."
    exit 1
}

Write-Host "All required runtime components are present." -ForegroundColor Green