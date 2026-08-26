#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Enforce,
  [string]$LogFile,
  [string]$Root
)

$ErrorActionPreference = "Continue"
if (-not $Root) { $Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) }
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $LogFile) { $LogFile = Join-Path $Root "Logs\structure-guard.log" }
$QuarantineBase = Join-Path $Root "Recovery\Quarantine"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runEntries = [System.Collections.Generic.List[string]]::new()
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

$AllowedRootDirs = @(
  ".git", ".github", "AI-Brain", "Apps", "Cache", "Config", "Core", "Data", "Docs", "Downloads",
  "Integrations", "Logs", "Recovery", "Runtime", "Temp", "Tools", "Workspace"
)
$AllowedRootFiles = @(".gitignore", "INSTALL_OS.cmd", "START_OS.cmd", "README.md")
$IgnoredPathPatterns = @(
  "\\(Recovery|\.git|node_modules|\.obsidian|Cache|Temp|Logs|Downloads)(\\|$)",
  "\\Apps\\VSCode\\data\\", "\\Config\\Codex\\\.tmp\\", "\\Config\\Obsidian\\"
)
$VersionPatterns = @("V0[0-9]+", "v[0-9]+", "-old", "-new", "-copy", "-backup", "-temp")

function Test-IgnoredPath([string]$Path) {
  foreach ($pattern in $IgnoredPathPatterns) { if ($Path -match $pattern) { return $true } }
  return $false
}
function Write-Log([string]$Message, [string]$Level = "INFO") {
  $entry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
  $runEntries.Add($entry)
  Add-Content -Path $LogFile -Value $entry -ErrorAction SilentlyContinue
  $color = if ($Level -eq 'ERROR') {'Red'} elseif ($Level -eq 'WARN') {'Yellow'} else {'Gray'}
  Write-Host $entry -ForegroundColor $color
}
function Move-ToQuarantine([string]$Path, [string]$Reason) {
  $quarantineDir = Join-Path $QuarantineBase $Timestamp
  New-Item -ItemType Directory -Path $quarantineDir -Force | Out-Null
  $item = Get-Item -LiteralPath $Path -Force
  $dest = Join-Path $quarantineDir $item.Name
  if (Test-Path $dest) { $dest = Join-Path $quarantineDir ("{0}-{1}" -f ([guid]::NewGuid().ToString('N').Substring(0,8)), $item.Name) }
  $manifest = [ordered]@{
    originalPath = $Path
    destination = $dest
    reason = $Reason
    timestamp = (Get-Date -Format 'o')
    type = $(if ($item.PSIsContainer) { 'directory' } else { 'file' })
  }
  if (-not $item.PSIsContainer) { $manifest.hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
  ($manifest | ConvertTo-Json -Compress) | Add-Content -Path (Join-Path $quarantineDir "manifest.jsonl")
  Move-Item -LiteralPath $Path -Destination $dest -Force
  Write-Log "Quarantined: $Path -> $dest ($Reason)" "WARN"
}

Write-Log "=== Structure Guard Started ==="
foreach ($dir in Get-ChildItem -LiteralPath $Root -Directory -Force -ErrorAction SilentlyContinue) {
  if ($dir.Name -notin $AllowedRootDirs) {
    Write-Log "Unauthorized root directory: $($dir.Name)" "ERROR"
    if ($Enforce) { Move-ToQuarantine $dir.FullName 'Unauthorized root directory' }
  }
}
foreach ($file in Get-ChildItem -LiteralPath $Root -File -Force -ErrorAction SilentlyContinue) {
  if ($file.Name -notin $AllowedRootFiles) {
    Write-Log "Unauthorized root file: $($file.Name)" "ERROR"
    if ($Enforce) { Move-ToQuarantine $file.FullName 'Unauthorized root file' }
  }
}

$allFiles = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { -not (Test-IgnoredPath $_.FullName) })
foreach ($file in $allFiles) {
  foreach ($pattern in $VersionPatterns) {
    if ($file.Name -match $pattern) { Write-Log "Version-like filename: $($file.FullName)" "WARN"; break }
  }
}

$hashable = @($allFiles | Where-Object { $_.FullName -notmatch "\\Tools\\Git\\" -and $_.Length -gt 0 })
$hashGroups = $hashable | Group-Object -Property { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } | Where-Object { $_.Count -gt 1 }
foreach ($group in $hashGroups) {
  Write-Log "Duplicate content: $((@($group.Group.FullName) -join ' | '))" "WARN"
}

foreach ($badCache in @((Join-Path $Root 'node_modules'), (Join-Path $Root '.npm'), (Join-Path $Root '.cache'))) {
  if (Test-Path $badCache) {
    Write-Log "Cache in root: $badCache" "WARN"
    if ($Enforce) { Move-ToQuarantine $badCache 'Cache in root' }
  }
}

Write-Log "=== Structure Guard Completed ==="
$errors = @($runEntries | Where-Object { $_ -match '\[ERROR\]' }).Count
$warnings = @($runEntries | Where-Object { $_ -match '\[WARN\]' }).Count
Write-Host "Errors: $errors  Warnings: $warnings"
if ($errors -gt 0 -and -not $Enforce) { exit 2 }
exit 0
