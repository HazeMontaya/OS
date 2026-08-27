Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-OsRepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Write-OsHeader([string]$Title) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host (" OS  |  " + $Title) -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Write-OsStep([string]$Message) {
    Write-Host ("[OS] " + $Message) -ForegroundColor Cyan
}

function Write-OsOk([string]$Message) {
    Write-Host ("[OK] " + $Message) -ForegroundColor Green
}

function Write-OsWarn([string]$Message) {
    Write-Host ("[WARN] " + $Message) -ForegroundColor Yellow
}

function Add-PathEntry([string]$PathEntry) {
    if ([string]::IsNullOrWhiteSpace($PathEntry) -or -not (Test-Path -LiteralPath $PathEntry)) {
        return
    }
    $parts = @($env:Path -split ';')
    if (-not ($parts | Where-Object { $_.TrimEnd('\') -ieq $PathEntry.TrimEnd('\') })) {
        $env:Path = "$PathEntry;$env:Path"
    }
}

function Refresh-OsPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $combined = @($machine, $user) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($combined.Count -gt 0) {
        $env:Path = ($combined -join ';')
    }

    Add-PathEntry (Join-Path $env:USERPROFILE ".cargo\bin")
    $repo = Get-OsRepoRoot
    Add-PathEntry (Join-Path $repo ".tools\protoc\bin")
}

function Test-OsCommand([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-OsNative {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE: $File $($Arguments -join ' ')"
    }
}

function Ensure-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [string[]]$ExtraArguments = @()
    )

    if (Test-OsCommand $Command) {
        Write-OsOk "$DisplayName already available."
        return
    }

    if (-not (Test-OsCommand "winget")) {
        throw "winget is required to install $DisplayName automatically. Install Microsoft App Installer, then run OS-SETUP.cmd again."
    }

    Write-OsStep "Installing $DisplayName ($PackageId) ..."
    $args = @(
        "install", "--id", $PackageId, "-e", "--source", "winget",
        "--accept-source-agreements", "--accept-package-agreements", "--silent"
    ) + $ExtraArguments
    Invoke-OsNative "winget" @args
    Refresh-OsPath

    if (-not (Test-OsCommand $Command)) {
        Write-OsWarn "$DisplayName was installed, but this terminal has not discovered it yet. A new terminal or reboot may be required."
    }
}

function Get-VsWherePath {
    $candidate = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }
    return $null
}

function Test-MsvcBuildTools {
    $vswhere = Get-VsWherePath
    if ($null -eq $vswhere) {
        return $false
    }

    $installation = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    return -not [string]::IsNullOrWhiteSpace(($installation | Out-String))
}

function Test-WebView2Runtime {
    $roots = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\EdgeWebView\Application"),
        (Join-Path $env:ProgramFiles "Microsoft\EdgeWebView\Application")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $binary = Get-ChildItem -LiteralPath $root -Filter "msedgewebview2.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $binary) { return $true }
    }
    return $false
}

function Test-HttpEndpoint([string]$Uri, [int]$TimeoutSec = 3) {
    try {
        Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Set-OsRuntimeDefaults {
    $defaults = @{
        "OS_LLAMA_SERVER" = "http://127.0.0.1:11434"
        "OS_LLAMA_MODEL" = "llama3.2:3b"
        "OS_EMBED_SERVER" = "http://127.0.0.1:11434"
        "OS_EMBED_MODEL" = "nomic-embed-text"
    }

    foreach ($name in $defaults.Keys) {
        $current = [Environment]::GetEnvironmentVariable($name, "User")
        if ([string]::IsNullOrWhiteSpace($current)) {
            [Environment]::SetEnvironmentVariable($name, $defaults[$name], "User")
            $current = $defaults[$name]
        }
        Set-Item -Path ("Env:" + $name) -Value $current
    }
}

function Ensure-OllamaServer {
    if (Test-HttpEndpoint "http://127.0.0.1:11434/api/version" 2) {
        return $true
    }
    if (-not (Test-OsCommand "ollama")) {
        return $false
    }

    Write-OsStep "Starting local Ollama service ..."
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 750
        if (Test-HttpEndpoint "http://127.0.0.1:11434/api/version" 2) {
            return $true
        }
    }
    return $false
}

function Get-ReleaseExecutablePath {
    $repo = Get-OsRepoRoot
    return (Join-Path $repo "target\release\os-desktop.exe")
}
