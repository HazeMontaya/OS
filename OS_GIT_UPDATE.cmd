@echo off
setlocal EnableExtensions
cd /d S:\OS
if errorlevel 1 goto ERROR

REM Alle nicht als Secret ausgeschlossenen OS-Dateien aufnehmen
git add -A
if errorlevel 1 goto ERROR

REM Nur committen, wenn es Aenderungen gibt
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "OS update"
    if errorlevel 1 goto ERROR
)

REM Remote-Stand sauber integrieren
git pull --rebase origin main
if errorlevel 1 goto ERROR

REM Lokalen main nach GitHub hochladen
git push origin main
if errorlevel 1 goto ERROR

git status
echo.
echo OS erfolgreich nach GitHub main hochgeladen und synchronisiert.
pause
exit /b 0

:ERROR
echo.
echo FEHLER: Git-Synchronisierung abgebrochen.
git status
pause
exit /b 1
