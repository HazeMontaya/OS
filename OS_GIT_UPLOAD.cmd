@echo off
setlocal EnableExtensions
cd /d S:\OS
if errorlevel 1 goto ERROR

REM Schutz: lokale, noch nicht gespeicherte Aenderungen nicht ueberschreiben
git status --porcelain > "%TEMP%\os_git_status.tmp"
for %%A in ("%TEMP%\os_git_status.tmp") do if %%~zA GTR 0 goto DIRTY
del /q "%TEMP%\os_git_status.tmp" >nul 2>&1

REM GitHub-main laden
git fetch origin main
if errorlevel 1 goto ERROR

git switch main
if errorlevel 1 goto ERROR

REM Nur Fast-Forward: keine automatische Merge-Historie erzeugen
git pull --ff-only origin main
if errorlevel 1 goto ERROR

git status
echo.
echo OS erfolgreich von GitHub main nach S:\OS heruntergeladen.
pause
exit /b 0

:DIRTY
del /q "%TEMP%\os_git_status.tmp" >nul 2>&1
echo.
echo ABBRUCH: In S:\OS liegen lokale Aenderungen vor.
echo Erst OS_GIT_UPDATE.cmd ausfuehren oder die Aenderungen sichern.
git status
pause
exit /b 2

:ERROR
del /q "%TEMP%\os_git_status.tmp" >nul 2>&1
echo.
echo FEHLER: Download/Synchronisierung von GitHub abgebrochen.
git status
pause
exit /b 1
