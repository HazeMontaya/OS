$ErrorActionPreference = "Stop"

Write-Host "HazeMontaya OS / JAMES bootstrap"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Rust/Cargo not found. Install Rust from https://rustup.rs/ and reopen PowerShell."
}

New-Item -ItemType Directory -Force -Path ".os" | Out-Null
New-Item -ItemType Directory -Force -Path "workspaces" | Out-Null

Write-Host "Rust:"
cargo --version

Write-Host "Building workspace..."
$env:CARGO_INCREMENTAL = "0"
cargo build --workspace

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Start with: .\scripts\start.ps1"
Write-Host "Stop with:  .\scripts\stop.ps1"
