@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OS - S:\OS ersetzt GitHub main

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "BRANCH=main"

echo ============================================================
echo  OS MIRROR: %LOCAL_DIR% -^> ONLINE GITHUB
echo  Der lokale Stand ersetzt origin/%BRANCH%.
echo ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [FEHLER] Git wurde nicht gefunden.
    echo Installiere Git for Windows und starte diese Datei erneut.
    pause
    exit /b 1
)

if not exist "%LOCAL_DIR%\.git" (
    echo [FEHLER] %LOCAL_DIR% ist kein Git-Repository.
    echo Fuehre zuerst GIT-DOWNLOAD-ONLINE-NACH-S-OS.cmd aus.
    pause
    exit /b 1
)

cd /d "%LOCAL_DIR%"
if errorlevel 1 (
    echo [FEHLER] Wechsel nach %LOCAL_DIR% fehlgeschlagen.
    pause
    exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "%REPO_URL%"
) else (
    git remote set-url origin "%REPO_URL%"
)
if errorlevel 1 goto :git_error

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="%BRANCH%" (
    echo [INFO] Wechsle auf lokalen Branch %BRANCH% ...
    git checkout "%BRANCH%"
    if errorlevel 1 goto :git_error
)

echo [INFO] Erfasse den kompletten lokalen Repository-Stand ...
git add -A
if errorlevel 1 goto :git_error

git diff --cached --quiet
if errorlevel 1 (
    echo [INFO] Erstelle Mirror-Commit mit allen lokalen Aenderungen und Loeschungen ...
    git commit -m "sync: replace online main with S:\OS state"
    if errorlevel 1 goto :git_error
) else (
    echo [INFO] Keine uncommitteten lokalen Aenderungen vorhanden.
)

echo [INFO] Ermittle aktuellen Online-Stand fuer sicheren Force-Lease ...
git fetch --prune origin "%BRANCH%"
if errorlevel 1 goto :git_error

set "REMOTE_SHA="
for /f "delims=" %%S in ('git rev-parse "refs/remotes/origin/%BRANCH%" 2^>nul') do set "REMOTE_SHA=%%S"

if defined REMOTE_SHA (
    echo [INFO] Ersetze origin/%BRANCH% exakt durch den lokalen Stand ...
    git push --force-with-lease=refs/heads/%BRANCH%:!REMOTE_SHA! origin HEAD:refs/heads/%BRANCH%
) else (
    echo [INFO] Online-Branch fehlt. Erstelle origin/%BRANCH% aus dem lokalen Stand ...
    git push origin HEAD:refs/heads/%BRANCH%
)
if errorlevel 1 goto :git_error

echo [INFO] Aktualisiere lokalen Remote-Zeiger ...
git fetch --prune origin "%BRANCH%" >nul 2>&1

echo.
echo ============================================================
echo [OK] LOKAL -^> ONLINE SPIEGELUNG ABGESCHLOSSEN.
echo      origin/%BRANCH% entspricht jetzt dem lokalen Git-Stand.
echo      Online-Dateien, die lokal geloescht wurden, sind ebenfalls entfernt.
echo ============================================================
pause
exit /b 0

:git_error
echo.
echo [FEHLER] Git-Vorgang fehlgeschlagen.
echo Der Online-Stand wurde nicht blind ueberschrieben.
echo --force-with-lease verhindert das Ueberschreiben eines zwischenzeitlich geaenderten Remote-Stands.
echo Pruefe Git-Status, Netzwerk und GitHub-Anmeldung.
pause
exit /b 1
