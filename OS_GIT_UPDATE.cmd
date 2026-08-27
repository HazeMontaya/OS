@echo off
cd /d S:\OS

git add -A

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "OS update"
)

git pull --rebase origin main
if errorlevel 1 goto ERROR

git push origin main
if errorlevel 1 goto ERROR

git status
echo.
echo OS erfolgreich mit GitHub main synchronisiert.
pause
exit /b 0

:ERROR
echo.
echo FEHLER: Git-Synchronisierung abgebrochen.
git status
pause
exit /b 1
pause