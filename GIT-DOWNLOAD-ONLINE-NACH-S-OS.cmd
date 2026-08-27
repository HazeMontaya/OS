@echo off
setlocal EnableExtensions
title OS - GitHub ersetzt S:\OS

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "BRANCH=main"

echo ============================================================
echo  OS MIRROR: ONLINE GITHUB -^> %LOCAL_DIR%
echo  Der Online-Stand ersetzt den lokalen Repository-Inhalt.
echo ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [FEHLER] Git wurde nicht gefunden.
    echo Installiere Git for Windows und starte diese Datei erneut.
    pause
    exit /b 1
)

if not exist "S:\" (
    echo [FEHLER] Laufwerk S: ist nicht verfuegbar.
    pause
    exit /b 1
)

if not exist "%LOCAL_DIR%" mkdir "%LOCAL_DIR%"
if errorlevel 1 (
    echo [FEHLER] %LOCAL_DIR% konnte nicht angelegt werden.
    pause
    exit /b 1
)

cd /d "%LOCAL_DIR%"
if errorlevel 1 (
    echo [FEHLER] Wechsel nach %LOCAL_DIR% fehlgeschlagen.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [INFO] Initialisiere vorhandenen Ordner als Git-Repository ...
    git init
    if errorlevel 1 goto :git_error
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "%REPO_URL%"
) else (
    git remote set-url origin "%REPO_URL%"
)
if errorlevel 1 goto :git_error

echo [INFO] Lade den aktuellen Online-Stand ...
git fetch --prune origin "%BRANCH%"
if errorlevel 1 goto :git_error

echo [INFO] Ersetze lokalen Branch durch origin/%BRANCH% ...
git checkout -B "%BRANCH%" "origin/%BRANCH%"
if errorlevel 1 goto :git_error

git reset --hard "origin/%BRANCH%"
if errorlevel 1 goto :git_error

echo [INFO] Entferne ALLE lokalen Dateien, die nicht zum Online-Repository gehoeren ...
git clean -ffdx
if errorlevel 1 goto :git_error

echo [INFO] Synchronisiere Submodule exakt ...
git submodule sync --recursive
if errorlevel 1 goto :git_error
git submodule update --init --recursive --force
if errorlevel 1 goto :git_error
git submodule foreach --recursive "git reset --hard && git clean -ffdx" >nul 2>&1

echo.
echo ============================================================
echo [OK] ONLINE -^> LOKAL SPIEGELUNG ABGESCHLOSSEN.
echo      %LOCAL_DIR% entspricht jetzt origin/%BRANCH%.
echo      Alte lokale Aenderungen und Zusatzdateien wurden entfernt.
echo ============================================================
pause
exit /b 0

:git_error
echo.
echo [FEHLER] Git-Vorgang fehlgeschlagen.
echo Der lokale Stand konnte nicht vollstaendig ersetzt werden.
echo Pruefe Netzwerk, GitHub-Anmeldung und die Meldungen oberhalb.
pause
exit /b 1
