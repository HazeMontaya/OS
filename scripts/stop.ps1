$ErrorActionPreference = "SilentlyContinue"

foreach ($name in @("runtime.pid","dashboard.pid")) {
    $path = ".os\$name"
    if (Test-Path $path) {
        $pid = [int](Get-Content $path)
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pid -Force
            Write-Host "Stopped PID $pid"
        }
        Remove-Item $path -Force
    }
}

Write-Host "JAMES stop complete."
