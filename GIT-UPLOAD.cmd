@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OS - S:\OS ersetzt GitHub main

set "REPO_URL=https://github.com/HazeMontaya/OS.git"
set "LOCAL_DIR=S:\OS"
set "BRANCH=main"
set "MAX_GITHUB_BYTES=99614720"
set "REPORT=%LOCAL_DIR%\.os-sync-excluded-local.txt"
set "TMP_INDEX=%TEMP%\os-upload-index-%RANDOM%-%RANDOM%.tmp"
set "TMP_LIST=%TEMP%\os-upload-files-%RANDOM%-%RANDOM%.txt"
set "TMP_LARGE=%TEMP%\os-upload-large-%RANDOM%-%RANDOM%.txt"

echo ============================================================
echo  OS MIRROR: %LOCAL_DIR% -^> ONLINE GITHUB
echo  S:\OS ersetzt den kompletten Datei-Stand von origin/%BRANCH%.
echo  Build-, Runtime-, Modell- und uebergrosse Dateien bleiben lokal.
echo ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [FEHLER] Git wurde nicht gefunden.
    echo Installiere Git for Windows und starte diese Datei erneut.
    pause
    exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
    echo [FEHLER] Windows PowerShell wurde nicht gefunden.
    pause
    exit /b 1
)

if not exist "%LOCAL_DIR%\.git" (
    echo [FEHLER] %LOCAL_DIR% ist kein Git-Repository.
    echo Fuehre zuerst GIT-DOWNLOAD.cmd aus.
    pause
    exit /b 1
)

cd /d "%LOCAL_DIR%"
if errorlevel 1 goto :git_error

git config core.longpaths true
if errorlevel 1 goto :git_error

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "%REPO_URL%"
) else (
    git remote set-url origin "%REPO_URL%"
)
if errorlevel 1 goto :git_error

git config user.name >nul 2>&1
if errorlevel 1 git config user.name "OS Repository Sync"
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "os-sync@localhost"

echo [1/8] Lade den aktuellen Online-Stand als sichere Basis ...
git fetch --prune origin "%BRANCH%"
if errorlevel 1 goto :git_error

set "REMOTE_SHA="
for /f "delims=" %%S in ('git rev-parse "refs/remotes/origin/%BRANCH%" 2^>nul') do set "REMOTE_SHA=%%S"
if not defined REMOTE_SHA (
    echo [FEHLER] origin/%BRANCH% konnte nicht ermittelt werden.
    goto :git_error
)

echo [2/8] Erzeuge einen frischen Git-Index nur aus dem aktuellen S:\OS-Dateisystem ...
if exist "%TMP_INDEX%" del /f /q "%TMP_INDEX%" >nul 2>&1
set "GIT_INDEX_FILE=%TMP_INDEX%"
git read-tree --empty
if errorlevel 1 goto :git_error
git add -A -- .
if errorlevel 1 goto :git_error

echo [3/8] Pruefe alle Upload-Dateien auf GitHub-Groessenlimits ...
git ls-files > "%TMP_LIST%"
if errorlevel 1 goto :git_error
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=[IO.Path]::GetFullPath('%LOCAL_DIR%'); $max=%MAX_GITHUB_BYTES%; $out='%TMP_LARGE%'; Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue; Get-Content -LiteralPath '%TMP_LIST%' | ForEach-Object { $rel=$_; if(-not [string]::IsNullOrWhiteSpace($rel)){ $p=Join-Path $root $rel; if(Test-Path -LiteralPath $p -PathType Leaf){ $f=Get-Item -LiteralPath $p; if($f.Length -ge $max){ Add-Content -LiteralPath $out -Value $rel -Encoding UTF8 } } } }"
if errorlevel 1 goto :git_error

>"%REPORT%" echo OS repository sync exclusions
>>"%REPORT%" echo Generated automatically by GIT-UPLOAD.cmd
>>"%REPORT%" echo Files at or above 95 MiB are excluded from normal GitHub source sync.
>>"%REPORT%" echo Runtime, databases, model weights, build outputs, archives and installers are excluded by .gitignore.

if exist "%TMP_LARGE%" (
    echo [INFO] Folgende Dateien sind fuer normales GitHub-Git zu gross und werden NICHT hochgeladen:
    for /f "usebackq delims=" %%F in ("%TMP_LARGE%") do (
        echo        %%F
        >>"%REPORT%" echo LARGE: %%F
        git rm --cached --ignore-unmatch -- "%%F" >nul 2>&1
        if errorlevel 1 goto :git_error
        >>".git\info\exclude" echo /%%F
    )
)

rem Der lokale Diagnosebericht gehoert nie in das Online-Repository.
git rm --cached --ignore-unmatch -- ".os-sync-excluded-local.txt" >nul 2>&1

echo [4/8] Erzeuge den exakten bereinigten Repository-Baum ...
set "TREE_SHA="
for /f "delims=" %%T in ('git write-tree') do set "TREE_SHA=%%T"
if not defined TREE_SHA goto :git_error

echo [5/8] Erzeuge einen neuen Mirror-Commit direkt auf origin/%BRANCH% ...
set "MIRROR_COMMIT="
for /f "delims=" %%C in ('echo sync: replace online main with clean S:\OS mirror^| git commit-tree "%TREE_SHA%" -p "%REMOTE_SHA%"') do set "MIRROR_COMMIT=%%C"
if not defined MIRROR_COMMIT goto :git_error

echo [6/8] Ersetze den kompletten Online-Dateibaum ...
git push origin "%MIRROR_COMMIT%:refs/heads/%BRANCH%"
if errorlevel 1 (
    echo.
    echo [HINWEIS] origin/%BRANCH% wurde seit dem Fetch veraendert oder GitHub hat den Push abgelehnt.
    echo Es wird NICHT blind ueber einen neueren Online-Stand geschrieben. Starte die CMD erneut.
    goto :git_error
)

echo [7/8] Aktualisiere den lokalen main-Zeiger auf denselben Mirror-Commit ...
set "GIT_INDEX_FILE="
git update-ref "refs/heads/%BRANCH%" "%MIRROR_COMMIT%"
if errorlevel 1 goto :git_error
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"
if /I "!CURRENT_BRANCH!"=="%BRANCH%" (
    git reset --mixed "%MIRROR_COMMIT%" >nul
    if errorlevel 1 goto :git_error
)

echo [8/8] Verifiziere Online- und Mirror-Commit ...
git fetch --prune origin "%BRANCH%" >nul 2>&1
set "VERIFY_SHA="
for /f "delims=" %%V in ('git rev-parse "refs/remotes/origin/%BRANCH%" 2^>nul') do set "VERIFY_SHA=%%V"
if /I not "!VERIFY_SHA!"=="%MIRROR_COMMIT%" (
    echo [FEHLER] Online-Verifikation stimmt nicht mit dem erzeugten Mirror-Commit ueberein.
    goto :git_error
)

call :cleanup_temp

echo.
echo ============================================================
echo [OK] LOKAL -^> ONLINE VOLLSTAENDIG ERSETZT.
echo      Alte Online-Dateien, die in S:\OS fehlen, wurden entfernt.
echo      Der Online-Dateibaum stammt neu aus dem aktuellen S:\OS.
echo      Problematische Runtime-/Build-/Modelldateien bleiben lokal.
echo      Ausschlussbericht: %REPORT%
echo ============================================================
pause
exit /b 0

:cleanup_temp
set "GIT_INDEX_FILE="
if exist "%TMP_INDEX%" del /f /q "%TMP_INDEX%" >nul 2>&1
if exist "%TMP_LIST%" del /f /q "%TMP_LIST%" >nul 2>&1
if exist "%TMP_LARGE%" del /f /q "%TMP_LARGE%" >nul 2>&1
exit /b 0

:git_error
call :cleanup_temp
echo.
echo [FEHLER] Upload/Mirror wurde nicht vollstaendig abgeschlossen.
echo Pruefe Netzwerk, GitHub-Anmeldung, Dateinamen und die Meldungen oberhalb.
pause
exit /b 1
