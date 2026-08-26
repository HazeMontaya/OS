@echo off
setlocal EnableExtensions
title OS - Installation

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================================
echo  OS Installation / Verification
echo  %ROOT%
echo ============================================================
echo.

if exist "%ROOT%\Apps\PowerShell\pwsh.exe" (
  set "PWSH=%ROOT%\Apps\PowerShell\pwsh.exe"
) else (
  set "PWSH=powershell.exe"
)

"%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Core\Scripts\Setup\Install-OS.ps1" -Root "%ROOT%"
if errorlevel 1 (
  echo.
  echo Installation verification failed. See output above.
  pause
  exit /b 1
)

echo.
echo OS is ready. Start with START_OS.cmd
endlocal
