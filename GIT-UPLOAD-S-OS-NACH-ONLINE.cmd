@echo off
setlocal EnableExtensions
title OS - S:\OS nach GitHub

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "BRANCH=main"

echo ============================================================
echo  OS SYNC: %LOCAL_DIR% -^> ONLINE GITHUB
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
    echo [FEHLER] Aktiver Branch ist "%CURRENT_BRANCH%", erwartet wird "%BRANCH%".
    echo Wechsle bewusst auf main, bevor du den Upload erneut startest.
    pause
    exit /b 1
)

echo [INFO] Erfasse lokale Aenderungen ...
git add -A
if errorlevel 1 goto :git_error

git diff --cached --quiet
if errorlevel 1 (
    echo [INFO] Erstelle lokalen Sync-Commit ...
    git commit -m "sync: local S:\OS changes"
    if errorlevel 1 goto :git_error
) else (
    echo [INFO] Keine uncommitteten lokalen Aenderungen vorhanden.
)

echo [INFO] Lade aktuellen Online-Stand ...
git fetch origin "%BRANCH%"
if errorlevel 1 goto :git_error

echo [INFO] Rebase lokalen Stand auf origin/%BRANCH% ...
git rebase "origin/%BRANCH%"
if errorlevel 1 (
    echo.
    echo [FEHLER] Rebase-Konflikt erkannt. Upload wird abgebrochen.
    echo [INFO] Der Rebase wird automatisch zurueckgesetzt; dein lokaler Commit bleibt erhalten.
    git rebase --abort >nul 2>&1
    pause
    exit /b 1
)

echo [INFO] Lade lokalen Branch nach GitHub hoch ...
git push origin "%BRANCH%"
if errorlevel 1 goto :git_error

echo.
echo ============================================================
echo [OK] LOKAL -^> ONLINE abgeschlossen.
echo      Quelle: %LOCAL_DIR%
echo      Ziel: %REPO_URL%
echo      Branch: %BRANCH%
echo ============================================================
pause
exit /b 0

:git_error
echo.
echo [FEHLER] Git-Vorgang fehlgeschlagen.
echo Es wurde kein Force-Push verwendet.
echo Pruefe Git-Status, Netzwerk und GitHub-Anmeldung.
pause
exit /b 1
