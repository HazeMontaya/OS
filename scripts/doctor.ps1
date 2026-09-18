$ErrorActionPreference = "Stop"

Write-Host "JAMES OS doctor" -ForegroundColor Cyan
$checks = @(
    @{ Name = "Git"; Command = "git" },
    @{ Name = "Rust/Cargo"; Command = "cargo" }
)

foreach ($check in $checks) {
    if (Get-Command $check.Command -ErrorAction SilentlyContinue) {
        $version = & $check.Command --version 2>$null
        Write-Host "[OK] $($check.Name): $version"
    } else {
        Write-Host "[MISSING] $($check.Name)" -ForegroundColor Yellow
    }
}

if (Test-Path ".env") {
    Write-Host "[OK] .env present"
} else {
    Write-Host "[INFO] .env not present; runtime will use safe defaults."
}

if (Test-Path ".os/state.tsv") {
    Write-Host "[OK] persistent state present"
} else {
    Write-Host "[INFO] no persistent state yet; first run will create it."
}

if (Test-Path "target/debug/os-cli.exe") {
    Write-Host "[OK] CLI binary present"
} else {
    Write-Host "[INFO] binaries not built yet."
}

Write-Host ""
Write-Host "Running workspace tests..."
$env:CARGO_INCREMENTAL = "0"
cargo test --workspace
Write-Host ""
Write-Host "Doctor complete." -ForegroundColor Green


Write-Host "Checking runtime configuration..."
$required = @("OS_MODEL_PROVIDER","OS_MODEL","OS_HEARTBEAT_SECONDS","OS_WORKSPACE_ROOT")
foreach ($name in $required) {
  $line = Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$name=" }
  if ($line) { Write-Host "[OK] $name" } else { Write-Host "[WARN] $name not set in .env" }
}
