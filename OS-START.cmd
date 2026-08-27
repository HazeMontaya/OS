@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OS - Start
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start.ps1" %*
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [OS] Start failed with exit code %RC%.
  pause
)
exit /b %RC%
