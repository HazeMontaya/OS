$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path ".os" | Out-Null
$env:CARGO_INCREMENTAL = "0"

if (-not (Test-Path ".\target\debug\os-dashboard.exe") -or -not (Test-Path ".\target\debug\os-cli.exe")) {
    cargo build -p os-dashboard -p os-cli
}

$dashboard = Start-Process -FilePath ".\target\debug\os-dashboard.exe" -PassThru -WindowStyle Hidden
$runtime = Start-Process -FilePath ".\target\debug\os-cli.exe" -PassThru

Set-Content -Path ".os\dashboard.pid" -Value $dashboard.Id
Set-Content -Path ".os\runtime.pid" -Value $runtime.Id

Write-Host "JAMES started."
Write-Host "Dashboard: http://127.0.0.1:8787"
Write-Host "Runtime PID: $($runtime.Id)"
Write-Host "Dashboard PID: $($dashboard.Id)"
Write-Host "Stop: .\scripts\stop.ps1"
