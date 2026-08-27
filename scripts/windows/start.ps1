param(
    [switch]$Dev,
    [switch]$Rebuild
)

. (Join-Path $PSScriptRoot "common.ps1")

$repo = Get-OsRepoRoot
Set-Location $repo
Refresh-OsPath
Set-OsRuntimeDefaults
Write-OsHeader "START"

if (-not (Ensure-OllamaServer)) {
    Write-OsWarn "Local Ollama is offline. OS will still open, but local cognitive turns will report a model transport error until a compatible model server is available."
}

if ($Dev) {
    foreach ($command in @("pnpm", "cargo", "protoc")) {
        if (-not (Test-OsCommand $command)) {
            throw "$command is missing. Run OS-SETUP.cmd first."
        }
    }
    Write-OsStep "Starting OS in Tauri development mode ..."
    Invoke-OsNative "pnpm" "dev"
    exit 0
}

$exe = Get-ReleaseExecutablePath
$marker = Join-Path $repo ".os-local\release-head.txt"
$currentHead = $null
if (Test-OsCommand "git") {
    $currentHead = (& git rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $null -ne $currentHead) {
        $currentHead = $currentHead.Trim()
    } else {
        $currentHead = $null
    }
}

$builtHead = $null
if (Test-Path -LiteralPath $marker) {
    $builtHead = (Get-Content -LiteralPath $marker -Raw).Trim()
}

$needsBuild = $Rebuild -or -not (Test-Path -LiteralPath $exe)
if (-not $needsBuild -and $null -ne $currentHead) {
    $needsBuild = [string]::IsNullOrWhiteSpace($builtHead) -or $builtHead -ne $currentHead
}

if ($needsBuild) {
    Write-OsStep "Release executable is missing or does not match the current source. Rebuilding ..."
    & (Join-Path $PSScriptRoot "build.ps1") -NoValidation
    if ($LASTEXITCODE -ne 0) {
        throw "Automatic release rebuild failed."
    }
}

if (-not (Test-Path -LiteralPath $exe)) {
    throw "OS executable not found after build: $exe"
}

Write-OsOk "Launching $exe"
Start-Process -FilePath $exe -WorkingDirectory $repo | Out-Null
