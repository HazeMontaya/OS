@echo off
setlocal EnableExtensions
set "ROOT=S:\OS"
set "EXITCODE=0"
title OS Git Update - Lokal nach GitHub

cd /d "%ROOT%" 2>nul
if errorlevel 1 goto PATH_ERROR

echo ============================================================
echo  OS GIT UPDATE  -  S:\OS  ^>  GitHub origin/main
echo ============================================================
echo.

REM Git pruefen
where git >nul 2>&1
if errorlevel 1 goto GIT_MISSING

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto NOT_REPO

git remote get-url origin >nul 2>&1
if errorlevel 1 goto NO_ORIGIN

REM Keine laufende Git-Operation automatisch zerstoeren
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

REM OS/Obsidian beenden, damit EXE/DLL/PAK/Logs beim Rebase nicht gesperrt sind
echo Schliesse laufende OS-/Obsidian-Prozesse fuer eine konsistente Sicherung ...
taskkill /F /T /IM Obsidian.exe >nul 2>&1
taskkill /F /T /IM OS.exe >nul 2>&1
timeout /t 1 /nobreak >nul

REM Neue grosse, nicht ignorierte Dateien ab 90 MB automatisch mit Git LFS erfassen
set "LARGE_LIST=%TEMP%\os_git_large_files_%RANDOM%.tmp"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=(Resolve-Path '.').Path; Get-ChildItem -LiteralPath $root -File -Recurse -Force | Where-Object { $_.FullName -notlike ($root + '\.git\*') -and $_.Length -ge 90MB } | ForEach-Object { $rel=$_.FullName.Substring($root.Length+1).Replace('\','/'); git check-ignore -q -- $rel 2>$null; if ($LASTEXITCODE -ne 0) { $rel } }" > "%LARGE_LIST%"
if errorlevel 1 goto ERROR
for /f "usebackq delims=" %%F in ("%LARGE_LIST%") do (
    echo Git LFS pruefen: %%F
    git lfs track "%%F" >nul 2>&1
    if errorlevel 1 goto ERROR
)
del /q "%LARGE_LIST%" >nul 2>&1

REM Wirklich alle nicht ignorierten lokalen Aenderungen aufnehmen
echo.
echo Erfasse lokale Aenderungen ...
git add -A
if errorlevel 1 goto ERROR

REM Nur committen, wenn der Index Aenderungen enthaelt
git diff --cached --quiet
if errorlevel 1 (
    echo Erstelle lokalen Commit ...
    git commit -m "OS update"
    if errorlevel 1 goto ERROR
) else (
    echo Keine neuen lokalen Aenderungen zu committen.
)

REM Remote aktualisieren und lokale Commits sauber darauf neu aufsetzen
echo.
echo Lade origin/main ...
git fetch origin main
if errorlevel 1 goto ERROR

echo Integriere origin/main per Rebase ...
git rebase origin/main
if errorlevel 1 goto REBASE_ERROR

REM LFS-Objekte und Git-Commit hochladen
echo.
echo Lade Git-LFS-Objekte und main nach GitHub hoch ...
git lfs push origin main
if errorlevel 1 goto ERROR
git push -u origin main
if errorlevel 1 goto ERROR

REM Abschlusskontrolle
git fetch origin main >nul 2>&1
echo.
git status
git lfs status
echo.
echo ============================================================
echo  ERFOLG: S:\OS ist nach GitHub origin/main hochgeladen.
echo ============================================================
set "EXITCODE=0"
goto FINISH

:REBASE_ERROR
echo.
echo FEHLER: Rebase auf origin/main konnte nicht automatisch abgeschlossen werden.
echo Loese den Konflikt und verwende danach: git rebase --continue
git status
set "EXITCODE=10"
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
echo FEHLER: Git-Synchronisierung wurde abgebrochen.
if exist "%LARGE_LIST%" del /q "%LARGE_LIST%" >nul 2>&1
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
