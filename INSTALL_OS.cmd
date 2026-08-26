@echo off
setlocal
title AI Brain - Installation - S:\OS

echo ============================================================
echo  AI Brain Installation - S:\OS
echo ============================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell.exe -Command "Start-Process cmd.exe -ArgumentList '/c %~f0' -Verb RunAs"
    exit /b
)

:: Set up environment
set "ROOT=S:\OS"
set "PATH=S:\OS\Runtime\Node;S:\OS\Tools\npm-global;S:\OS\Tools\Git\cmd;S:\OS\Apps\PowerShell;%PATH%"

:: Run portable bootstrap
echo Starting installation...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Core\Scripts\Setup\Install-OS.ps1"

if errorlevel 1 (
    echo.
    echo Installation failed. Check logs: S:\OS\Logs\setup.log
    pause
) else (
    echo.
    echo Installation completed successfully!
    echo.
    echo Next steps:
    echo 1. Run S:\OS\START_OS.cmd to start the AI Brain
    echo 2. Complete first-time login for Claude/Codex/OpenCode
)

endlocal
