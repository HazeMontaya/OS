@echo off
setlocal EnableExtensions
cd /d S:\OS
if errorlevel 1 goto ERROR

REM Git LFS muss fuer grosse OS-Dateien verfuegbar sein
git lfs version >nul 2>&1
if errorlevel 1 goto LFS_MISSING
git lfs install --local >nul
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

REM Git-Push laedt LFS-Objekte ueber den LFS-pre-push-Hook mit hoch
git push origin main
if errorlevel 1 goto ERROR

git status
git lfs status
echo.
echo OS erfolgreich nach GitHub main hochgeladen und synchronisiert.
pause
exit /b 0

:LFS_MISSING
echo.
echo FEHLER: Git LFS ist nicht installiert oder nicht verfuegbar.
echo Installiere Git LFS und starte dieses Skript erneut.
pause
exit /b 3

:ERROR
echo.
echo FEHLER: Git-Synchronisierung abgebrochen.
git status
pause
exit /b 1
