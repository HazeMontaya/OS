$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path ".os" | Out-Null

Write-Host "JAMES recovery"

foreach ($name in @("runtime.pid","dashboard.pid")) {
    $path = ".os\$name"
    if (Test-Path $path) {
        $pid = [int](Get-Content $path)
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
            Stop-Process -Id $pid -Force
        }
        Remove-Item $path -Force
    }
}

$state = ".os\state.tsv"
$events = ".os\events.log"
$memory = ".os\memory.log"

Write-Host "Persistent files:"
foreach ($path in @($state,$events,$memory)) {
    if (Test-Path $path) {
        Write-Host ("  {0}  {1} bytes" -f $path,(Get-Item $path).Length)
    } else {
        Write-Host "  $path  missing (runtime will initialize)"
    }
}

& ".\scripts\start.ps1"
