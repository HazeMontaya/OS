@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OS - Build
set "ARGS=%*"
if /I "%~1"=="--installer" (
  shift
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\build.ps1" -Installer %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\build.ps1" %*
)
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [OS] Build failed with exit code %RC%.
  pause
)
exit /b %RC%
