@echo off
set "PATH=S:\OS\Runtime\Node;S:\OS\Tools\npm-global;S:\OS\Tools\Git\cmd;%PATH%"
set "CLAUDE_CONFIG_DIR=S:\OS\Config\Claude"
set "CODEX_HOME=S:\OS\Config\Codex"
set "OPENCODE_CONFIG_DIR=S:\OS\Config\OpenCode"
set "OPENCODE_CONFIG=S:\OS\Config\OpenCode\opencode.json"
cd /d S:\OS\AI-Brain
echo.
echo 1) Claude startet jetzt zur einmaligen Anmeldung.
echo 2) Danach Codex.
echo 3) Danach OpenCode.
echo.
start "Claude Login" cmd.exe /k "cd /d S:\OS\AI-Brain && claude"
start "Codex Login" cmd.exe /k "cd /d S:\OS\AI-Brain && codex"
start "OpenCode Login" cmd.exe /k "cd /d S:\OS\AI-Brain && opencode"
start "" "https://chatgpt.com/"
