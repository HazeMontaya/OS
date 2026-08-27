@echo off
setlocal EnableExtensions
title OS - GitHub nach S:\OS

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "BRANCH=main"
set "STASH_CREATED=0"

echo ============================================================
echo  OS SYNC: ONLINE GITHUB -^> %LOCAL_DIR%
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

if not exist "%LOCAL_DIR%\.git" (
    if exist "%LOCAL_DIR%" (
        dir /b "%LOCAL_DIR%" 2>nul | findstr . >nul
        if not errorlevel 1 (
            echo [FEHLER] %LOCAL_DIR% existiert, ist aber kein Git-Repository und nicht leer.
            echo Verschiebe oder leere den Ordner und starte erneut.
            pause
            exit /b 1
        )
    )

    echo [INFO] Lokales Repository fehlt. Klone %REPO_URL% ...
    git clone --branch "%BRANCH%" --single-branch "%REPO_URL%" "%LOCAL_DIR%"
    if errorlevel 1 goto :git_error

    echo.
    echo [OK] Repository wurde nach %LOCAL_DIR% geklont.
    goto :success
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

for /f %%A in ('git status --porcelain') do set "HAS_CHANGES=1"
if defined HAS_CHANGES (
    echo [INFO] Lokale, noch nicht synchronisierte Aenderungen erkannt.
    echo [INFO] Sichere sie automatisch als Git-Stash ...
    git stash push --include-untracked -m "OS auto-backup before online download"
    if errorlevel 1 goto :git_error
    set "STASH_CREATED=1"
)

echo [INFO] Lade aktuellen Stand von GitHub ...
git fetch --prune origin
if errorlevel 1 goto :git_error

echo [INFO] Setze lokalen Branch %BRANCH% exakt auf origin/%BRANCH% ...
git checkout -B "%BRANCH%" "origin/%BRANCH%"
if errorlevel 1 goto :git_error

git reset --hard "origin/%BRANCH%"
if errorlevel 1 goto :git_error

git submodule update --init --recursive
if errorlevel 1 goto :git_error

:success
echo.
echo ============================================================
echo [OK] ONLINE -^> LOKAL abgeschlossen.
echo      Ziel: %LOCAL_DIR%
echo      Branch: %BRANCH%
if "%STASH_CREATED%"=="1" (
    echo.
    echo [HINWEIS] Vorherige lokale Aenderungen wurden gesichert.
    echo           Anzeigen: cd /d %LOCAL_DIR% ^&^& git stash list
    echo           Wiederherstellen: git stash pop
)
echo ============================================================
pause
exit /b 0

:git_error
echo.
echo [FEHLER] Git-Vorgang fehlgeschlagen. Es wurde kein Force-Push ausgefuehrt.
echo Pruefe Netzwerk, GitHub-Anmeldung und die Meldungen oberhalb.
pause
exit /b 1
