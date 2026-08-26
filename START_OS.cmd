@echo off
setlocal EnableExtensions
title OS - Local AI Runtime

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\Core\Runtime\src\server.mjs" (
  echo ERROR: OS runtime not found. Run INSTALL_OS.cmd first.
  pause
  exit /b 1
)

set "PATH=%ROOT%\Runtime\Node;%ROOT%\Tools\npm-global;%ROOT%\Tools\Git\cmd;%ROOT%\Apps\PowerShell;%ROOT%\Apps\VSCode\bin;%PATH%"
set "NPM_CONFIG_USERCONFIG=%ROOT%\Config\npmrc"
set "NPM_CONFIG_PREFIX=%ROOT%\Tools\npm-global"
set "NPM_CONFIG_CACHE=%ROOT%\Temp\npm-cache"
set "CLAUDE_CONFIG_DIR=%ROOT%\Config\Claude"
set "CLAUDE_CODE_TMPDIR=%ROOT%\Temp\Claude"
set "CODEX_HOME=%ROOT%\Config\Codex"
set "OPENCODE_CONFIG_DIR=%ROOT%\Config\OpenCode"
set "OPENCODE_CONFIG=%ROOT%\Config\OpenCode\opencode.json"
set "GIT_CONFIG_GLOBAL=%ROOT%\Config\gitconfig"
set "OPENCODE_GIT_BASH_PATH=%ROOT%\Tools\Git\bin\bash.exe"
set "TEMP=%ROOT%\Temp"
set "TMP=%ROOT%\Temp"

if exist "%ROOT%\Apps\PowerShell\pwsh.exe" (
  set "PWSH=%ROOT%\Apps\PowerShell\pwsh.exe"
) else (
  set "PWSH=powershell.exe"
)

"%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Core\Scripts\Maintenance\StructureGuard.ps1" -Root "%ROOT%" -LogFile "%ROOT%\Logs\structure-guard.log"
if errorlevel 2 (
  echo ERROR: OS structure has blocking errors. See Logs\structure-guard.log
  pause
  exit /b 2
)

set "NODE=%ROOT%\Runtime\Node\node.exe"
if not exist "%NODE%" set "NODE=node.exe"
where "%NODE%" >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Run INSTALL_OS.cmd or place Node under Runtime\Node.
  pause
  exit /b 1
)

echo Starting OS Runtime...
cd /d "%ROOT%"
"%NODE%" "%ROOT%\Core\Runtime\src\server.mjs"
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%
