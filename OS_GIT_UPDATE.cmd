@echo off
setlocal

cd /d S:\OS
set "GIT_CONFIG_GLOBAL=S:\OS\Config\gitconfig"

git add -A

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "OS update"
)

git pull --rebase origin main
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

git status
endlocal
pause