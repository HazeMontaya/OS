@echo off
title PersonalJarvis Reference Setup for OS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP_PERSONALJARVIS_REFERENCE.ps1"
if errorlevel 1 pause
