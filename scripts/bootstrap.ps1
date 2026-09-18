$ErrorActionPreference = "Stop"

Write-Host "HazeMontaya OS / JAMES bootstrap" -ForegroundColor Cyan

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name not found. $InstallHint"
    }
}

Require-Command "cargo" "Install Rust from https://rustup.rs/ and reopen PowerShell."
Require-Command "git" "Install Git for Windows and reopen PowerShell."

New-Item -ItemType Directory -Force -Path ".os" | Out-Null
New-Item -ItemType Directory -Force -Path "workspaces" | Out-Null
New-Item -ItemType Directory -Force -Path ".os/logs" | Out-Null

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
}

Write-Host ""
Write-Host "Toolchain:"
cargo --version
git --version

Write-Host ""
Write-Host "Running tests..."
$env:CARGO_INCREMENTAL = "0"
cargo test --workspace

Write-Host ""
Write-Host "Building workspace..."
cargo build --workspace

Write-Host ""
Write-Host "Running CI smoke cycle..."
$env:OS_CI = "1"
cargo run -p os-cli
Remove-Item Env:OS_CI -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Green
Write-Host "Run doctor: .\scripts\doctor.ps1"
Write-Host "Start JAMES: .\scripts\start.ps1"
Write-Host "Stop JAMES:  .\scripts\stop.ps1"
