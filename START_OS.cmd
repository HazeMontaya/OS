@echo off
setlocal
title AI Brain - S:\OS

:: ============================================================
:: AI Brain Start Script
:: ============================================================

:: Detect OS root (this script's location)
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

:: Validate root
if not exist "%ROOT%\AI-Brain" (
    echo ERROR: AI-Brain vault not found at %ROOT%\AI-Brain
    echo Please run INSTALL_OS.cmd first.
    pause
    exit /b 1
)

:: Set up environment
set "VAULT=%ROOT%\AI-Brain"
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

:: Run Structure Guard (check-only)
echo Checking structure...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Core\Scripts\Maintenance\StructureGuard.ps1" -LogFile "%ROOT%\Logs\structure-guard.log"
if errorlevel 1 (
    echo.
    echo Structure issues detected. Run with -Enforce to fix:
    echo powershell.exe -File "%ROOT%\Core\Scripts\Maintenance\StructureGuard.ps1" -Enforce
    echo.
)

:: Check for required components
echo Checking components...
set "missing=0"

if not exist "%ROOT%\Runtime\Node\node.exe" (
    echo [MISSING] Node.js runtime
    set /a missing+=1
)

if not exist "%ROOT%\Tools\Git\cmd\git.exe" (
    echo [MISSING] Git
    set /a missing+=1
)

if not exist "%ROOT%\Tools\npm-global\opencode.cmd" (
    echo [MISSING] OpenCode CLI
    set /a missing+=1
)

if %missing% gtr 0 (
    echo.
    echo %missing% components missing. Run INSTALL_OS.cmd to install.
    pause
    exit /b 1
)

:: Start OpenCode in AI Brain vault
echo.
echo Starting AI Brain...
echo.
cd /d "%VAULT%"
start "OpenCode - AI Brain" cmd.exe /k "cd /d "%VAULT%" && opencode --auto"

endlocal
