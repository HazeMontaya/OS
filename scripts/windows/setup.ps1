param(
    [switch]$SkipModels,
    [switch]$SkipBuild,
    [switch]$Launch
)

. (Join-Path $PSScriptRoot "common.ps1")

$repo = Get-OsRepoRoot
Set-Location $repo
Refresh-OsPath
Write-OsHeader "AUTOMATIC WINDOWS SETUP"

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw "OS-SETUP.cmd is intended for Windows."
}

# WinGet is only an installer transport. It is not a runtime requirement.
# Reuse an already complete machine instead of blocking setup merely because
# Microsoft App Installer / winget is missing.
if (Test-OsCommand "winget") {
    Write-OsOk ("Windows Package Manager available: " + (& winget --version))
} else {
    Write-OsWarn "Windows Package Manager is unavailable. Existing components will be reused; winget is only required if OS must install a missing package."
}

Write-OsStep "Checking source/build toolchain ..."
Ensure-WingetPackage -Command "git" -PackageId "Git.Git" -DisplayName "Git for Windows"
Ensure-WingetPackage -Command "node" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Ensure-WingetPackage -Command "rustup" -PackageId "Rustlang.Rustup" -DisplayName "Rustup"
Refresh-OsPath

if (-not (Test-MsvcBuildTools)) {
    if (-not (Test-OsCommand "winget")) {
        throw "Microsoft C++ Build Tools are missing and winget is unavailable. Install Visual Studio 2022 Build Tools with the C++ workload, then rerun OS-SETUP.cmd."
    }
    Write-OsStep "Installing Microsoft C++ Build Tools for Tauri/Rust ..."
    $vsArgs = @(
        "install", "--id", "Microsoft.VisualStudio.2022.BuildTools", "-e", "--source", "winget",
        "--accept-source-agreements", "--accept-package-agreements", "--silent",
        "--override", "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    )
    Invoke-OsNative "winget" @vsArgs
    if (-not (Test-MsvcBuildTools)) {
        throw "Visual Studio C++ Build Tools were installed but are not visible yet. Restart Windows once, then run OS-SETUP.cmd again; setup will continue without reinstalling completed components."
    }
}
Write-OsOk "Microsoft C++ Build Tools available."

if (-not (Test-WebView2Runtime)) {
    Write-OsStep "Installing Microsoft Edge WebView2 Runtime ..."
    $bootstrapper = Join-Path $env:TEMP "MicrosoftEdgeWebview2Setup.exe"
    Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -UseBasicParsing -OutFile $bootstrapper
    $process = Start-Process -FilePath $bootstrapper -ArgumentList "/silent", "/install" -Wait -PassThru
    Remove-Item -LiteralPath $bootstrapper -Force -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
        throw "WebView2 installer failed with exit code $($process.ExitCode)."
    }
    if (-not (Test-WebView2Runtime)) {
        throw "WebView2 installation finished but the runtime is not detectable yet. Restart Windows and run OS-SETUP.cmd again."
    }
}
Write-OsOk "Microsoft Edge WebView2 Runtime available."

Write-OsStep "Configuring Rust MSVC toolchain ..."
Refresh-OsPath
if (-not (Test-OsCommand "rustup")) {
    throw "rustup is not available after installation. Open a new terminal or reboot, then run OS-SETUP.cmd again."
}
Invoke-OsNative "rustup" "default" "stable-msvc"
Invoke-OsNative "rustup" "component" "add" "rustfmt" "clippy"

if (-not (Test-OsCommand "npm")) {
    throw "npm is unavailable after Node.js installation. Open a new terminal or reboot, then run OS-SETUP.cmd again."
}
if (-not (Test-OsCommand "pnpm")) {
    Write-OsStep "Installing pnpm 10 ..."
    Invoke-OsNative "npm" "install" "--global" "pnpm@10"
    Refresh-OsPath
}
if (-not (Test-OsCommand "pnpm")) {
    throw "pnpm could not be activated."
}
Write-OsOk ("pnpm " + (& pnpm --version))

Write-OsStep "Ensuring Protocol Buffers compiler ..."
$protocRoot = Join-Path $repo ".tools\protoc"
if (-not (Test-OsCommand "protoc")) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ "User-Agent" = "OS-Windows-Bootstrap" }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/protocolbuffers/protobuf/releases/latest" -Headers $headers
    $asset = $release.assets | Where-Object { $_.name -match '^protoc-.*-win64\.zip$' } | Select-Object -First 1
    if ($null -eq $asset) {
        throw "Could not locate a current protoc win64 release asset."
    }
    $zip = Join-Path $env:TEMP $asset.name
    Write-OsStep ("Downloading " + $asset.name + " ...")
    Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -UseBasicParsing -OutFile $zip
    if (Test-Path -LiteralPath $protocRoot) {
        Remove-Item -LiteralPath $protocRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $protocRoot -Force | Out-Null
    Expand-Archive -LiteralPath $zip -DestinationPath $protocRoot -Force
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    Add-PathEntry (Join-Path $protocRoot "bin")
}
if (-not (Test-OsCommand "protoc")) {
    throw "protoc is still unavailable after bootstrap."
}
Write-OsOk ("protoc " + (& protoc --version))

Write-OsStep "Preparing local-first AI runtime ..."
Ensure-WingetPackage -Command "ollama" -PackageId "Ollama.Ollama" -DisplayName "Ollama"
Refresh-OsPath
Set-OsRuntimeDefaults
if (-not (Ensure-OllamaServer)) {
    throw "Ollama is installed but the local API did not become reachable on http://127.0.0.1:11434."
}
Write-OsOk "Ollama local API online."

if (-not $SkipModels) {
    $chatModel = $env:OS_LLAMA_MODEL
    $embedModel = $env:OS_EMBED_MODEL

    Write-OsStep "Ensuring local chat model $chatModel ..."
    Invoke-OsNative "ollama" "pull" $chatModel
    Write-OsStep "Ensuring local embedding model $embedModel ..."
    Invoke-OsNative "ollama" "pull" $embedModel

    $installedModels = (& ollama list 2>$null | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Ollama model registry could not be queried after provisioning."
    }
    foreach ($model in @($chatModel, $embedModel)) {
        if ($installedModels -notmatch ("(?m)^" + [regex]::Escape($model) + "\s")) {
            throw "Ollama model provisioning did not produce the required model: $model"
        }
    }
    Write-OsOk "Required local Ollama models are installed."
}

Write-OsStep "Installing JavaScript workspace dependencies ..."
Invoke-OsNative "pnpm" "install" "--no-frozen-lockfile"

Write-OsStep "Running OS core doctor ..."
Invoke-OsNative "cargo" "run" "-p" "os-cli" "--" "doctor"

Write-OsStep "Validating Rust workspace ..."
Invoke-OsNative "cargo" "check" "--workspace"
Write-OsStep "Validating TypeScript workspace ..."
Invoke-OsNative "pnpm" "typecheck"

if (-not $SkipBuild) {
    Write-OsStep "Building and marking the startable Windows release executable ..."
    & (Join-Path $PSScriptRoot "build.ps1") -NoValidation
}

Write-OsHeader "SETUP COMPLETE"
Write-Host "OS is configured for a local Ollama runtime." -ForegroundColor White
Write-Host "Chat model:      $env:OS_LLAMA_MODEL" -ForegroundColor DarkYellow
Write-Host "Embedding model: $env:OS_EMBED_MODEL" -ForegroundColor DarkYellow
Write-Host "Start:            OS-START.cmd" -ForegroundColor Yellow
Write-Host "Diagnostics:      OS-DOCTOR.cmd" -ForegroundColor Yellow
Write-Host "Installer build:  OS-BUILD.cmd --installer" -ForegroundColor Yellow

if ($Launch) {
    & (Join-Path $PSScriptRoot "start.ps1")
    exit 0
}
