@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OS - GitHub ersetzt S:\OS komplett

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "INCOMING=S:\OS.__incoming__"
set "BACKUP=S:\OS.__old__"
set "BRANCH=main"

if /I "%~1"=="--worker" goto :worker

rem Diese CMD kann aus S:\OS heraus gestartet werden. Deshalb wird eine
rem temporaere Kopie ausgefuehrt, bevor S:\OS als Ganzes ersetzt wird.
set "SELF_COPY=%TEMP%\OS-GIT-DOWNLOAD-%RANDOM%-%RANDOM%.cmd"
copy /y "%~f0" "%SELF_COPY%" >nul
if errorlevel 1 (
    echo [FEHLER] Temporaere Arbeitskopie der CMD konnte nicht erstellt werden.
    pause
    exit /b 1
)
call "%SELF_COPY%" --worker
set "RC=%ERRORLEVEL%"
del /f /q "%SELF_COPY%" >nul 2>&1
exit /b %RC%

:worker
cd /d "%TEMP%" >nul 2>&1

echo ============================================================
echo  OS MIRROR: ONLINE GITHUB -^> %LOCAL_DIR%
echo  Das alte lokale Repository wird komplett durch einen Fresh Clone ersetzt.
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

echo [1/7] Entferne alte temporaere Mirror-Verzeichnisse ...
if exist "%INCOMING%" rmdir /s /q "%INCOMING%"
if exist "%INCOMING%" (
    echo [FEHLER] %INCOMING% konnte nicht bereinigt werden.
    pause
    exit /b 1
)
if exist "%BACKUP%" rmdir /s /q "%BACKUP%"
if exist "%BACKUP%" (
    echo [FEHLER] %BACKUP% konnte nicht bereinigt werden.
    pause
    exit /b 1
)

echo [2/7] Erzeuge einen vollstaendig neuen Clone von origin/%BRANCH% ...
git -c core.longpaths=true clone --branch "%BRANCH%" --single-branch --recurse-submodules "%REPO_URL%" "%INCOMING%"
if errorlevel 1 goto :clone_error

echo [3/7] Erzwinge den exakten Online-Stand im neuen Clone ...
git -C "%INCOMING%" config core.longpaths true
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" fetch --prune origin "%BRANCH%"
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" checkout -B "%BRANCH%" "origin/%BRANCH%"
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" reset --hard "origin/%BRANCH%"
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" clean -ffdx
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" submodule sync --recursive
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" submodule update --init --recursive --force
if errorlevel 1 goto :clone_error
git -C "%INCOMING%" submodule foreach --recursive "git reset --hard && git clean -ffdx" >nul 2>&1

echo [4/7] Verifiziere neuen Clone ...
set "LOCAL_SHA="
set "REMOTE_SHA="
for /f "delims=" %%L in ('git -C "%INCOMING%" rev-parse HEAD 2^>nul') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git -C "%INCOMING%" rev-parse "refs/remotes/origin/%BRANCH%" 2^>nul') do set "REMOTE_SHA=%%R"
if not defined LOCAL_SHA goto :clone_error
if not defined REMOTE_SHA goto :clone_error
if /I not "!LOCAL_SHA!"=="!REMOTE_SHA!" (
    echo [FEHLER] Der Fresh Clone entspricht nicht exakt origin/%BRANCH%.
    goto :clone_error
)

echo [5/7] Verschiebe das bisherige S:\OS aus dem Weg ...
if exist "%LOCAL_DIR%" (
    move /y "%LOCAL_DIR%" "%BACKUP%" >nul
    if errorlevel 1 (
        echo [FEHLER] Das alte %LOCAL_DIR% konnte nicht umbenannt werden.
        echo Schliesse Programme, Terminals oder Editoren, die Dateien in S:\OS offen halten.
        goto :clone_error
    )
)

echo [6/7] Aktiviere den neuen Clone als S:\OS ...
move /y "%INCOMING%" "%LOCAL_DIR%" >nul
if errorlevel 1 (
    echo [FEHLER] Der neue Clone konnte nicht nach %LOCAL_DIR% verschoben werden.
    if exist "%BACKUP%" move /y "%BACKUP%" "%LOCAL_DIR%" >nul 2>&1
    pause
    exit /b 1
)

echo [7/7] Entferne das alte lokale Repository endgueltig ...
if exist "%BACKUP%" rmdir /s /q "%BACKUP%"
if exist "%BACKUP%" (
    echo [WARNUNG] Der neue Clone ist aktiv, aber %BACKUP% konnte nicht vollstaendig geloescht werden.
    echo Entferne diesen Backup-Ordner nach dem Schliessen blockierender Programme manuell.
)

echo.
echo ============================================================
echo [OK] ONLINE -^> LOKAL VOLLSTAENDIG ERSETZT.
echo      %LOCAL_DIR% ist ein neuer verifizierter Clone von origin/%BRANCH%.
echo      Alte lokale Dateien, Ignoriertes und alte .git-Reste wurden entfernt.
echo ============================================================
pause
exit /b 0

:clone_error
if exist "%INCOMING%" rmdir /s /q "%INCOMING%" >nul 2>&1
echo.
echo [FEHLER] Der neue Online-Clone konnte nicht sicher vorbereitet werden.
echo Das bestehende S:\OS wurde nicht ersetzt, sofern der Swap noch nicht begonnen hatte.
echo Pruefe Netzwerk, GitHub-Anmeldung, lange Pfade und die Meldungen oberhalb.
pause
exit /b 1
