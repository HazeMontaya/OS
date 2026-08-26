[CmdletBinding()]
param(
  [string]$NodeRoot = "",
  [string]$ElectronMirror = ""
)
$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "app-src"
if(-not (Test-Path (Join-Path $project "package.json"))){ throw "Sandbox-Projekt fehlt: $project" }
if($NodeRoot){ $env:Path = "$NodeRoot;$env:Path" }
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if(-not $node -or -not $npm){ throw "Node.js und npm werden benoetigt." }
if($ElectronMirror){
  $env:ELECTRON_MIRROR = $ElectronMirror.TrimEnd('/') + '/'
  Write-Output "Electron-Mirror: $env:ELECTRON_MIRROR"
}
Push-Location $project
try {
  & $npm.Source install --prefer-online
  if($LASTEXITCODE -ne 0){
    throw "npm install fehlgeschlagen. npm ist erreichbar, aber Electron benoetigt zusaetzlich einen erreichbaren GitHub-Download oder -ElectronMirror."
  }
  & $npm.Source test
  if($LASTEXITCODE -ne 0){ throw "Smoke-Test fehlgeschlagen." }
  & $npm.Source run build
  if($LASTEXITCODE -ne 0){ throw "Candidate-Build fehlgeschlagen." }
  Write-Output "Candidate erfolgreich gebaut: $(Join-Path $project 'dist')"
} finally {
  Pop-Location
}
