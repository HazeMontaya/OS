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
    Add-PathEntry (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps")
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
        throw "Command failed with exit code ${LASTEXITCODE}: $File $($Arguments -join ' ')"
    }
}

function Get-WingetExecutable {
    Refresh-OsPath

    $command = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
        return $command.Source
    }

    try {
        $package = Get-AppxPackage -Name "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending |
            Select-Object -First 1
        if ($null -ne $package -and -not [string]::IsNullOrWhiteSpace($package.InstallLocation)) {
            $candidate = Join-Path $package.InstallLocation "winget.exe"
            if (Test-Path -LiteralPath $candidate) {
                return $candidate
            }
        }
    } catch {
        # AppX discovery is best-effort; the official repair path below remains available.
    }

    return $null
}

function Test-WingetAvailable {
    $winget = Get-WingetExecutable
    if ([string]::IsNullOrWhiteSpace($winget)) {
        return $false
    }

    try {
        & $winget --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Repair-WingetWithOfficialModule {
    Write-OsStep "Repairing Windows Package Manager with Microsoft.WinGet.Client ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $gallery = Get-PSRepository -Name "PSGallery" -ErrorAction SilentlyContinue
    if ($null -eq $gallery) {
        Register-PSRepository -Default
        $gallery = Get-PSRepository -Name "PSGallery" -ErrorAction Stop
    }

    $previousPolicy = $gallery.InstallationPolicy
    $changedPolicy = $false
    try {
        if ($previousPolicy -ne "Trusted") {
            Set-PSRepository -Name "PSGallery" -InstallationPolicy Trusted
            $changedPolicy = $true
        }

        Install-PackageProvider -Name "NuGet" -Force -Scope CurrentUser | Out-Null
        Install-Module -Name "Microsoft.WinGet.Client" -Force -Repository "PSGallery" -Scope CurrentUser -AllowClobber
        Import-Module "Microsoft.WinGet.Client" -Force
        Repair-WinGetPackageManager -Force -Latest
    } finally {
        if ($changedPolicy) {
            try {
                Set-PSRepository -Name "PSGallery" -InstallationPolicy $previousPolicy
            } catch {
                Write-OsWarn "Could not restore the previous PSGallery trust policy automatically."
            }
        }
    }
}

function Install-WingetFromOfficialBundle {
    Write-OsStep "Installing the latest stable Microsoft App Installer bundle ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $bundle = Join-Path $env:TEMP "Microsoft.DesktopAppInstaller.OS.msixbundle"
    try {
        Invoke-WebRequest -Uri "https://aka.ms/getwinget" -UseBasicParsing -OutFile $bundle
        Add-AppxPackage -Path $bundle -ForceApplicationShutdown -ErrorAction Stop
    } finally {
        Remove-Item -LiteralPath $bundle -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-Winget {
    if (Test-WingetAvailable) {
        $winget = Get-WingetExecutable
        Write-OsOk ("Windows Package Manager available: " + (& $winget --version))
        return $winget
    }

    $osVersion = [Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10 -or ($osVersion.Major -eq 10 -and $osVersion.Build -lt 17763)) {
        throw "Windows Package Manager requires Windows 10 version 1809 (build 17763) or newer. Detected build: $($osVersion.Build)."
    }

    Write-OsWarn "Windows Package Manager is missing or not callable. OS will repair/install it automatically."
    $repairError = $null
    try {
        Repair-WingetWithOfficialModule
    } catch {
        $repairError = $_.Exception.Message
        Write-OsWarn ("Microsoft.WinGet.Client repair path failed: " + $repairError)
    }

    Refresh-OsPath
    for ($i = 0; $i -lt 5; $i++) {
        if (Test-WingetAvailable) {
            $winget = Get-WingetExecutable
            Write-OsOk ("Windows Package Manager repaired: " + (& $winget --version))
            return $winget
        }
        Start-Sleep -Seconds 1
    }

    $bundleError = $null
    try {
        Install-WingetFromOfficialBundle
    } catch {
        $bundleError = $_.Exception.Message
        Write-OsWarn ("Direct Microsoft App Installer bundle path failed: " + $bundleError)
    }

    Refresh-OsPath
    for ($i = 0; $i -lt 8; $i++) {
        if (Test-WingetAvailable) {
            $winget = Get-WingetExecutable
            Write-OsOk ("Windows Package Manager installed: " + (& $winget --version))
            return $winget
        }
        Start-Sleep -Seconds 1
    }

    $details = @()
    if (-not [string]::IsNullOrWhiteSpace($repairError)) { $details += "Repair module: $repairError" }
    if (-not [string]::IsNullOrWhiteSpace($bundleError)) { $details += "App Installer bundle: $bundleError" }
    $detailText = if ($details.Count -gt 0) { " Details: " + ($details -join " | ") } else { "" }
    throw "OS could not bootstrap Windows Package Manager automatically. Open https://aka.ms/getwinget once, install Microsoft App Installer, then rerun OS-SETUP.cmd.$detailText"
}

function Invoke-Winget {
    param(
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    $winget = Ensure-Winget
    Invoke-OsNative $winget @Arguments
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

    Write-OsStep "Installing $DisplayName ($PackageId) ..."
    $wingetArguments = @(
        "install", "--id", $PackageId, "-e", "--source", "winget",
        "--accept-source-agreements", "--accept-package-agreements", "--silent", "--disable-interactivity"
    ) + $ExtraArguments
    Invoke-Winget @wingetArguments
    Refresh-OsPath

    if (-not (Test-OsCommand $Command)) {
        Write-OsWarn "$DisplayName was installed, but this terminal has not discovered it yet. A new terminal or reboot may be required."
    }
}

function Get-VsWherePath {
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
        return $null
    }
    $candidate = Join-Path $programFilesX86 "Microsoft Visual Studio\Installer\vswhere.exe"
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
    $roots = @()
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
        $roots += (Join-Path $programFilesX86 "Microsoft\EdgeWebView\Application")
    }
    if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
        $roots += (Join-Path $env:ProgramFiles "Microsoft\EdgeWebView\Application")
    }

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
