#requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root      = "S:\OS"
$RefRoot   = "$Root\Reference"
$Target    = "$RefRoot\PersonalJarvis"
$Licenses  = "$RefRoot\Licenses"
$Logs      = "$Root\Logs"
$Repo      = "https://github.com/PersonalJarvis/PersonalJarvis.git"
$Branch    = "main"

function Dir($p) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

if (!(Test-Path "S:\")) {
    Write-Host "FEHLER: Laufwerk S: ist nicht verfügbar." -ForegroundColor Red
    exit 10
}

foreach ($d in @($Root,$RefRoot,$Licenses,$Logs)) { Dir $d }

Start-Transcript -Path "$Logs\personaljarvis-reference-$(Get-Date -Format yyyyMMdd-HHmmss).log" -Append | Out-Null

try {
    Step "Git ermitteln"
    $git = "$Root\Tools\Git\cmd\git.exe"

    if (!(Test-Path $git)) {
        $cmd = Get-Command git.exe -ErrorAction SilentlyContinue
        if ($cmd) {
            $git = $cmd.Source
        } else {
            $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
            if ($winget) {
                Write-Host "Git fehlt. Installiere Git for Windows über winget..." -ForegroundColor Yellow
                & $winget.Source install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
                $cmd = Get-Command git.exe -ErrorAction SilentlyContinue
                if ($cmd) { $git = $cmd.Source }
            }
        }
    }

    if (!(Test-Path $git)) {
        throw "Git konnte nicht gefunden oder installiert werden."
    }

    Step "Offizielle PersonalJarvis-Referenz bereitstellen"

    if (Test-Path "$Target\.git") {
        Write-Host "Referenz existiert bereits. Aktualisiere auf origin/main..." -ForegroundColor Yellow
        & $git -C $Target fetch --depth 1 origin $Branch
        if ($LASTEXITCODE -ne 0) { throw "git fetch fehlgeschlagen." }

        # Reference repository is intentionally pristine.
        & $git -C $Target reset --hard "origin/$Branch"
        if ($LASTEXITCODE -ne 0) { throw "git reset fehlgeschlagen." }

        & $git -C $Target clean -fd
    }
    elseif (Test-Path $Target) {
        $backup = "$RefRoot\PersonalJarvis-old-$(Get-Date -Format yyyyMMdd-HHmmss)"
        Write-Host "Vorhandener Ordner ohne Git wird nach $backup verschoben." -ForegroundColor Yellow
        Move-Item $Target $backup
        & $git clone --depth 1 --branch $Branch $Repo $Target
        if ($LASTEXITCODE -ne 0) { throw "git clone fehlgeschlagen." }
    }
    else {
        & $git clone --depth 1 --branch $Branch $Repo $Target
        if ($LASTEXITCODE -ne 0) { throw "git clone fehlgeschlagen." }
    }

    Step "Quelle und Lizenz verifizieren"
    $license = "$Target\LICENSE"
    $readme  = "$Target\README.md"
    $context = "$Target\docs\LLM-CONTEXT.md"

    if (!(Test-Path $license)) { throw "LICENSE fehlt in der Referenz." }
    if (!(Test-Path $readme))  { throw "README.md fehlt in der Referenz." }

    $licenseText = Get-Content $license -Raw
    if ($licenseText -notmatch "MIT License") {
        Write-Warning "LICENSE konnte nicht eindeutig als MIT erkannt werden. Bitte manuell prüfen."
    }

    Copy-Item $license "$Licenses\PersonalJarvis-MIT.txt" -Force

    $commit = (& $git -C $Target rev-parse HEAD).Trim()
    $remote = (& $git -C $Target remote get-url origin).Trim()
    $date   = (Get-Date).ToString("o")

    $source = [ordered]@{
        name = "PersonalJarvis"
        role = "Reference only"
        canonical_repository = "https://github.com/PersonalJarvis/PersonalJarvis"
        git_remote = $remote
        branch = $Branch
        commit = $commit
        fetched_at = $date
        target = $Target
        license = "MIT"
        execute_automatically = $false
        os_product_name = "OS"
    }

    $source | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "$RefRoot\PersonalJarvis-SOURCE.json"

    @"
# PersonalJarvis Reference for OS

## Status

This repository is installed as an **architecture and source-code reference only**.

Canonical upstream:
https://github.com/PersonalJarvis/PersonalJarvis

Local path:
S:\OS\Reference\PersonalJarvis

Pinned/current commit at setup:
$commit

License:
MIT — original LICENSE is preserved in the repository and copied to:
S:\OS\Reference\Licenses\PersonalJarvis-MIT.txt

## OS doctrine

- The final product name remains **OS**.
- Do not rename OS to Jarvis.
- Do not automatically run PersonalJarvis as a second assistant.
- Analyze the reference to identify reusable architecture, patterns, tests and implementation ideas.
- Prefer re-implementation behind OS interfaces where that yields cleaner integration.
- If substantial PersonalJarvis source code is copied, retain the required MIT copyright and permission notice.
- Treat reference updates as untrusted code until reviewed.
- Never import secrets, credentials or private configuration from another installation.

## Priority reference areas

- docs/architecture-overview.md
- docs/LLM-CONTEXT.md
- docs/adr/
- CLAUDE.md / AGENTS.md
- tests/
- jarvis/missions/
- jarvis/memory/
- jarvis/cu/
- jarvis/plugins/
- jarvis/safety/
- jarvis/speech/
- jarvis/realtime/
- conductor/
- install/

## Recommended OS analysis order

1. Architecture overview
2. LLM-CONTEXT
3. Agent contract / CLAUDE.md
4. Mission isolation / Worker-Critic
5. Capability and plugin seams
6. Memory
7. Computer Use
8. Voice
9. Conductor / workflow canvas
10. Installer, update and verification mechanisms
11. Tests and security model
"@ | Set-Content -Encoding UTF8 "$RefRoot\PersonalJarvis-REFERENCE.md"

    @'
@echo off
title Update PersonalJarvis Reference
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPDATE_PERSONALJARVIS_REFERENCE.ps1"
if errorlevel 1 pause
'@ | Set-Content -Encoding ASCII "$RefRoot\UPDATE_PERSONALJARVIS_REFERENCE.cmd"

    @"
`$ErrorActionPreference = "Stop"
`$Root = "S:\OS"
`$Target = "`$Root\Reference\PersonalJarvis"
`$Repo = "https://github.com/PersonalJarvis/PersonalJarvis.git"
`$Git = "`$Root\Tools\Git\cmd\git.exe"
if (!(Test-Path `$Git)) {
    `$g = Get-Command git.exe -ErrorAction Stop
    `$Git = `$g.Source
}
if (!(Test-Path "`$Target\.git")) { throw "PersonalJarvis reference is not installed." }
& `$Git -C `$Target fetch --depth 1 origin main
if (`$LASTEXITCODE -ne 0) { throw "git fetch failed." }
& `$Git -C `$Target reset --hard origin/main
if (`$LASTEXITCODE -ne 0) { throw "git reset failed." }
& `$Git -C `$Target clean -fd
`$commit = (& `$Git -C `$Target rev-parse HEAD).Trim()
`$src = Get-Content "`$Root\Reference\PersonalJarvis-SOURCE.json" -Raw | ConvertFrom-Json
`$src.commit = `$commit
`$src.fetched_at = (Get-Date).ToString("o")
`$src | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "`$Root\Reference\PersonalJarvis-SOURCE.json"
Copy-Item "`$Target\LICENSE" "`$Root\Reference\Licenses\PersonalJarvis-MIT.txt" -Force
Write-Host "PersonalJarvis reference updated to: `$commit" -ForegroundColor Green
"@ | Set-Content -Encoding UTF8 "$RefRoot\UPDATE_PERSONALJARVIS_REFERENCE.ps1"

    Step "Abschlussprüfung"
    $checks = @(
        "$Target\.git",
        "$Target\README.md",
        "$Target\LICENSE",
        "$Target\docs\LLM-CONTEXT.md",
        "$Target\docs",
        "$Target\tests",
        "$RefRoot\PersonalJarvis-SOURCE.json",
        "$RefRoot\PersonalJarvis-REFERENCE.md",
        "$Licenses\PersonalJarvis-MIT.txt"
    )

    foreach ($c in $checks) {
        if (Test-Path $c) {
            Write-Host "[OK] $c" -ForegroundColor Green
        } else {
            Write-Host "[HINWEIS] nicht gefunden: $c" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " PERSONALJARVIS REFERENZ BEREIT" -ForegroundColor Green
    Write-Host " $Target" -ForegroundColor Green
    Write-Host " Commit: $commit" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green

    Start-Process explorer.exe $Target
}
catch {
    Write-Host "`nFEHLER: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Logs: S:\OS\Logs" -ForegroundColor Yellow
    exit 1
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
}
