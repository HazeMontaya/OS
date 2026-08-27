@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OS - Automatic Setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\setup.ps1" %*
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [OS] Setup failed with exit code %RC%.
  pause
)
exit /b %RC%
