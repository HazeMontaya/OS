#requires -Version 5.1
[CmdletBinding()]
param([string]$Root)

$ErrorActionPreference = "Stop"
if (-not $Root) { $Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) }
$Root = (Resolve-Path $Root).Path

$requiredDirectories = @(
  "AI-Brain", "Apps", "Cache", "Config", "Config\OS", "Core", "Core\Runtime", "Core\UI",
  "Data", "Data\Import", "Data\Export", "Data\Memory", "Downloads", "Docs", "Integrations", "Logs",
  "Recovery", "Recovery\Quarantine", "Runtime", "Temp", "Tools", "Workspace", "Workspace\Agents",
  "Workspace\Automations", "Workspace\MCP", "Workspace\Skills", "Workspace\Workflows"
)
foreach ($relativePath in $requiredDirectories) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $relativePath) | Out-Null
}

$requiredFiles = @(
  "AI-Brain\AGENTS.md", "AI-Brain\MEMORY.md", "AI-Brain\SYSTEM.md",
  "Core\Runtime\src\server.mjs", "Core\UI\index.html",
  "Core\Scripts\Maintenance\StructureGuard.ps1", "Config\OS\runtime.json"
)
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path (Join-Path $Root $_)) })
if ($missingFiles.Count -gt 0) {
  Write-Error "Required repository files are missing: $($missingFiles -join ', ')"
  exit 1
}

$portableNode = Join-Path $Root "Runtime\Node\node.exe"
$nodeCommand = $null
if (Test-Path $portableNode) {
  $nodeCommand = $portableNode
} else {
  $nodeInfo = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeInfo) { $nodeCommand = $nodeInfo.Source }
}
if (-not $nodeCommand) {
  Write-Error "Node.js >=20 is required. Place portable Node in Runtime\Node or install Node system-wide."
  exit 1
}

$versionText = & $nodeCommand --version
$major = [int](($versionText -replace '^v','').Split('.')[0])
if ($major -lt 20) {
  Write-Error "Node.js >=20 required; found $versionText"
  exit 1
}

Write-Host "Running OS runtime tests..." -ForegroundColor Cyan
& $nodeCommand --test (Join-Path $Root "Core\Runtime\test\runtime.test.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OS installation verified at $Root" -ForegroundColor Green
Write-Host "Node: $versionText" -ForegroundColor Green
Write-Host "Start: $Root\START_OS.cmd" -ForegroundColor Green
