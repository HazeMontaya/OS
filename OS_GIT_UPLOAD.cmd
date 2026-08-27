@echo off
setlocal EnableExtensions
set "ROOT=S:\OS"
set "EXITCODE=0"
title OS Git Upload - GitHub nach Lokal

cd /d "%ROOT%" 2>nul
if errorlevel 1 goto PATH_ERROR

echo ============================================================
echo  OS GIT UPLOAD  -  GitHub origin/main  ^>  S:\OS
echo ============================================================
echo.

REM Git pruefen
where git >nul 2>&1
if errorlevel 1 goto GIT_MISSING

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto NOT_REPO

git remote get-url origin >nul 2>&1
if errorlevel 1 goto NO_ORIGIN

REM Keine laufende Git-Operation automatisch ueberschreiben
if exist ".git\rebase-merge" goto GIT_IN_PROGRESS
if exist ".git\rebase-apply" goto GIT_IN_PROGRESS
if exist ".git\MERGE_HEAD" goto GIT_IN_PROGRESS
if exist ".git\CHERRY_PICK_HEAD" goto GIT_IN_PROGRESS
if exist ".git\REVERT_HEAD" goto GIT_IN_PROGRESS

REM Nur main synchronisieren
set "BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if /I not "%BRANCH%"=="main" goto WRONG_BRANCH

REM Doppelte Tracking-Eintraege bereinigen und main eindeutig an origin/main binden
git config --unset-all branch.main.remote >nul 2>&1
git config --unset-all branch.main.merge >nul 2>&1
git config branch.main.remote origin
if errorlevel 1 goto ERROR
git config branch.main.merge refs/heads/main
if errorlevel 1 goto ERROR

REM Git LFS pruefen und fuer dieses Repository aktivieren
git lfs version >nul 2>&1
if errorlevel 1 goto LFS_MISSING
git lfs install --local >nul 2>&1
if errorlevel 1 goto ERROR

REM Programme beenden, damit Git Dateien problemlos ersetzen kann
echo Schliesse laufende OS-/Obsidian-Prozesse fuer eine konsistente Wiederherstellung ...
taskkill /F /T /IM Obsidian.exe >nul 2>&1
taskkill /F /T /IM OS.exe >nul 2>&1
timeout /t 1 /nobreak >nul

REM Lokale, nicht gespeicherte Aenderungen niemals automatisch ueberschreiben
for /f "delims=" %%S in ('git status --porcelain --untracked-files^=all') do goto DIRTY

REM Aktuellen Remote-Stand holen
echo.
echo Lade origin/main ...
git fetch origin main
if errorlevel 1 goto ERROR

REM Lokale, noch nicht hochgeladene Commits ebenfalls schuetzen
set "AHEAD=0"
for /f "delims=" %%N in ('git rev-list --count origin/main..main') do set "AHEAD=%%N"
if not "%AHEAD%"=="0" goto LOCAL_COMMITS

REM Nur Fast-Forward; keine unerwarteten Merge-Commits erzeugen
echo Aktualisiere lokalen main per Fast-Forward ...
git merge --ff-only origin/main
if errorlevel 1 goto DIVERGED

REM Alle Git-LFS-Dateien vollstaendig lokal materialisieren
echo Lade Git-LFS-Dateien ...
git lfs pull origin main
if errorlevel 1 goto ERROR
git lfs checkout
if errorlevel 1 goto ERROR

REM Abschlusskontrolle
echo.
git status
git lfs status
echo.
echo ============================================================
echo  ERFOLG: GitHub origin/main ist nach S:\OS heruntergeladen.
echo ============================================================
set "EXITCODE=0"
goto FINISH

:DIRTY
echo.
echo ABBRUCH: In S:\OS liegen lokale, nicht gespeicherte Aenderungen vor.
echo Dadurch wird nichts ueberschrieben.
echo Fuehre zuerst OS_GIT_UPDATE.cmd aus oder sichere die Aenderungen manuell.
git status
set "EXITCODE=2"
goto FINISH

:LOCAL_COMMITS
echo.
echo ABBRUCH: Der lokale main besitzt %AHEAD% Commit^(s^), die noch nicht in origin/main liegen.
echo Dadurch wird nichts ueberschrieben.
echo Fuehre zuerst OS_GIT_UPDATE.cmd aus.
git status
set "EXITCODE=8"
goto FINISH

:DIVERGED
echo.
echo ABBRUCH: main kann nicht per Fast-Forward auf origin/main aktualisiert werden.
echo Die Historien sind unerwartet auseinander gelaufen. Keine Daten wurden ueberschrieben.
git status
set "EXITCODE=9"
goto FINISH

:GIT_IN_PROGRESS
echo.
echo ABBRUCH: Eine Git-Operation ist bereits aktiv ^(Rebase/Merge/Cherry-Pick/Revert^).
echo Erst diese Operation abschliessen oder kontrolliert abbrechen.
git status
set "EXITCODE=11"
goto FINISH

:WRONG_BRANCH
echo.
echo ABBRUCH: Aktueller Branch ist "%BRANCH%". Dieses Skript arbeitet ausschliesslich mit main.
echo Wechsle zuerst kontrolliert auf main.
set "EXITCODE=12"
goto FINISH

:LFS_MISSING
echo.
echo FEHLER: Git LFS ist nicht installiert oder nicht im PATH.
echo Erwartet wird ein funktionierendes "git lfs version".
set "EXITCODE=3"
goto FINISH

:GIT_MISSING
echo.
echo FEHLER: Git wurde nicht gefunden.
set "EXITCODE=4"
goto FINISH

:NOT_REPO
echo.
echo FEHLER: %ROOT% ist kein gueltiges Git-Repository.
set "EXITCODE=5"
goto FINISH

:NO_ORIGIN
echo.
echo FEHLER: Git-Remote "origin" ist nicht konfiguriert.
set "EXITCODE=6"
goto FINISH

:PATH_ERROR
echo.
echo FEHLER: %ROOT% konnte nicht geoeffnet werden.
set "EXITCODE=7"
goto FINISH

:ERROR
echo.
echo FEHLER: Download/Synchronisierung von GitHub wurde abgebrochen.
git status 2>nul
set "EXITCODE=1"
goto FINISH

:FINISH
echo.
echo Ende. Exit-Code: %EXITCODE%
echo.
pause
exit /b %EXITCODE%
pause
