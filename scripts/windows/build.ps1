param(
    [switch]$Installer,
    [switch]$NoValidation
)

. (Join-Path $PSScriptRoot "common.ps1")

$repo = Get-OsRepoRoot
Set-Location $repo
Refresh-OsPath
Set-OsRuntimeDefaults
Write-OsHeader "WINDOWS BUILD"

foreach ($command in @("git", "cargo", "pnpm", "protoc")) {
    if (-not (Test-OsCommand $command)) {
        throw "$command is missing. Run OS-SETUP.cmd first."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $repo "node_modules"))) {
    Write-OsStep "Installing workspace dependencies ..."
    Invoke-OsNative "pnpm" "install" "--no-frozen-lockfile"
}

if (-not $NoValidation) {
    Write-OsStep "Running runtime doctor ..."
    Invoke-OsNative "cargo" "run" "-p" "os-cli" "--" "doctor"
    Write-OsStep "Checking Rust workspace ..."
    Invoke-OsNative "cargo" "check" "--workspace"
    Write-OsStep "Checking TypeScript workspace ..."
    Invoke-OsNative "pnpm" "typecheck"
}

Write-OsStep "Building release executable without installer bundling ..."
Invoke-OsNative "pnpm" "--filter" "@os/desktop" "tauri" "build" "--no-bundle"

$exe = Get-ReleaseExecutablePath
if (-not (Test-Path -LiteralPath $exe)) {
    throw "Release build finished but $exe does not exist."
}

$localState = Join-Path $repo ".os-local"
New-Item -ItemType Directory -Path $localState -Force | Out-Null
$head = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
    throw "Could not resolve current Git HEAD for the release marker."
}
Set-Content -LiteralPath (Join-Path $localState "release-head.txt") -Value $head -Encoding ASCII
Write-OsOk "Release executable ready: $exe"

if ($Installer) {
    Write-OsStep "Bundling NSIS Windows installer ..."
    Invoke-OsNative "pnpm" "--filter" "@os/desktop" "tauri" "bundle" "--bundles" "nsis"

    $nsisRoot = Join-Path $repo "target\release\bundle\nsis"
    $installerFile = Get-ChildItem -LiteralPath $nsisRoot -Filter "*.exe" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if ($null -eq $installerFile) {
        throw "NSIS bundle command completed but no installer executable was found under $nsisRoot."
    }

    $artifactRoot = Join-Path $repo "Artifacts\Windows"
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    $artifact = Join-Path $artifactRoot $installerFile.Name
    Copy-Item -LiteralPath $installerFile.FullName -Destination $artifact -Force
    Write-OsOk "Installer ready: $artifact"
}
