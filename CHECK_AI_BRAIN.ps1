$checks = @(
    @("Node","S:\OS\Runtime\Node\node.exe"),
    @("npm","S:\OS\Runtime\Node\npm.cmd"),
    @("Git","S:\OS\Tools\Git\cmd\git.exe"),
    @("Claude","S:\OS\Tools\npm-global\claude.cmd"),
    @("Codex","S:\OS\Tools\npm-global\codex.cmd"),
    @("OpenCode","S:\OS\Tools\npm-global\opencode.cmd"),
    @("VS Code","S:\OS\Apps\VSCode\Code.exe"),
    @("Vault","S:\OS\AI-Brain\SYSTEM.md")
)
Write-Host "AI Brain Health Check — S:\OS" -ForegroundColor Cyan
$failCount = 0
foreach($c in $checks){
    if(Test-Path $c[1]){ Write-Host ("[OK]    " + $c[0]) -ForegroundColor Green }
    else { Write-Host ("[FEHLT] " + $c[0] + " -> " + $c[1]) -ForegroundColor Red; $failCount++ }
}
if(Test-Path "S:\OS\Apps\Obsidian\Obsidian.exe"){
    Write-Host "[OK]    Obsidian" -ForegroundColor Green
}else{
    Write-Host "[PRUEFEN] Obsidian" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Noch einmalig interaktiv: Claude-/OpenAI-Login sowie optionale Cloud-OAuth-Freigaben." -ForegroundColor Yellow
exit $failCount
