$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path ".os" | Out-Null
New-Item -ItemType Directory -Force -Path ".os/logs" | Out-Null
$env:CARGO_INCREMENTAL = "0"

if (Test-Path ".os/runtime.pid") {
    $existing = Get-Process -Id ([int](Get-Content ".os/runtime.pid")) -ErrorAction SilentlyContinue
    if ($existing) { throw "JAMES runtime is already running (PID $($existing.Id))." }
    Remove-Item ".os/runtime.pid" -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".os/dashboard.pid") {
    $existing = Get-Process -Id ([int](Get-Content ".os/dashboard.pid")) -ErrorAction SilentlyContinue
    if ($existing) { throw "JAMES dashboard is already running (PID $($existing.Id))." }
    Remove-Item ".os/dashboard.pid" -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path ".\target\debug\os-dashboard.exe") -or -not (Test-Path ".\target\debug\os-cli.exe")) {
    cargo build -p os-dashboard -p os-cli
}

$dashboardLog = Join-Path (Resolve-Path ".os/logs") "dashboard.log"
$runtimeLog = Join-Path (Resolve-Path ".os/logs") "runtime.log"

$dashboard = Start-Process -FilePath ".\target\debug\os-dashboard.exe" -RedirectStandardOutput $dashboardLog -RedirectStandardError $dashboardLog -PassThru -WindowStyle Hidden
$runtime = Start-Process -FilePath ".\target\debug\os-cli.exe" -RedirectStandardOutput $runtimeLog -RedirectStandardError $runtimeLog -PassThru -WindowStyle Hidden

Set-Content -Path ".os\dashboard.pid" -Value $dashboard.Id
Set-Content -Path ".os\runtime.pid" -Value $runtime.Id

Start-Sleep -Milliseconds 500

if ($dashboard.HasExited) { throw "Dashboard exited immediately. See $dashboardLog" }
if ($runtime.HasExited) { throw "Runtime exited immediately. See $runtimeLog" }

Write-Host "JAMES started." -ForegroundColor Green
Write-Host "Dashboard: http://127.0.0.1:8787"
Write-Host "Runtime PID: $($runtime.Id)"
Write-Host "Dashboard PID: $($dashboard.Id)"
Write-Host "Logs: .os\logs"
Write-Host "Stop: .\scripts\stop.ps1"
