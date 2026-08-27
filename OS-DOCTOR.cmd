@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OS - Doctor
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\doctor.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
