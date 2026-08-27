param(
    [switch]$RuntimeOnly
)

. (Join-Path $PSScriptRoot "common.ps1")

$repo = Get-OsRepoRoot
Set-Location $repo
Refresh-OsPath
Set-OsRuntimeDefaults
Write-OsHeader "DOCTOR"

$checks = New-Object System.Collections.Generic.List[object]
function Add-Check([string]$Name, [bool]$Ok, [string]$Detail, [bool]$Critical = $true) {
    $checks.Add([pscustomobject]@{ Name = $Name; Ok = $Ok; Detail = $Detail; Critical = $Critical })
}

$exe = Get-ReleaseExecutablePath
Add-Check "Release executable" (Test-Path -LiteralPath $exe) $exe $false
Add-Check "WebView2" (Test-WebView2Runtime) "Required by Tauri desktop" $true

$ollamaCommand = Test-OsCommand "ollama"
Add-Check "Ollama command" $ollamaCommand "Local-first model runtime" $true
$ollamaOnline = $false
if ($ollamaCommand) {
    $ollamaOnline = Ensure-OllamaServer
}
Add-Check "Ollama API" $ollamaOnline "http://127.0.0.1:11434" $true

if ($ollamaOnline) {
    $models = (& ollama list 2>$null | Out-String)
    Add-Check "Chat model" ($models -match [regex]::Escape($env:OS_LLAMA_MODEL)) $env:OS_LLAMA_MODEL $true
    Add-Check "Embedding model" ($models -match [regex]::Escape($env:OS_EMBED_MODEL)) $env:OS_EMBED_MODEL $true
} else {
    Add-Check "Chat model" $false $env:OS_LLAMA_MODEL $true
    Add-Check "Embedding model" $false $env:OS_EMBED_MODEL $true
}

if (-not $RuntimeOnly) {
    Add-Check "Git" (Test-OsCommand "git") "Source synchronization" $true
    Add-Check "Node.js" (Test-OsCommand "node") "React/Tauri frontend toolchain" $true
    Add-Check "pnpm" (Test-OsCommand "pnpm") "Workspace package manager" $true
    Add-Check "Rust/Cargo" (Test-OsCommand "cargo") "Native core toolchain" $true
    Add-Check "protoc" (Test-OsCommand "protoc") "Protocol Buffers compiler" $true
    Add-Check "MSVC Build Tools" (Test-MsvcBuildTools) "Microsoft C++ toolchain" $true
    Add-Check "node_modules" (Test-Path -LiteralPath (Join-Path $repo "node_modules")) "Workspace dependencies installed" $false
}

$width = ($checks | ForEach-Object { $_.Name.Length } | Measure-Object -Maximum).Maximum
foreach ($check in $checks) {
    $status = if ($check.Ok) { "OK" } else { if ($check.Critical) { "FAIL" } else { "WARN" } }
    $color = if ($check.Ok) { "Green" } else { if ($check.Critical) { "Red" } else { "Yellow" } }
    Write-Host (("{0,-" + $width + "}  {1,-4}  {2}") -f $check.Name, $status, $check.Detail) -ForegroundColor $color
}

$criticalFailures = @($checks | Where-Object { $_.Critical -and -not $_.Ok })
Write-Host ""
if ($criticalFailures.Count -gt 0) {
    Write-OsWarn ("Doctor found " + $criticalFailures.Count + " blocking issue(s). Run OS-SETUP.cmd to repair the local installation.")
    exit 2
}

if (-not (Test-Path -LiteralPath $exe)) {
    Write-OsWarn "Runtime is ready, but no release executable exists yet. OS-START.cmd will build it automatically."
} else {
    Write-OsOk "OS runtime is launch-ready."
}
exit 0
