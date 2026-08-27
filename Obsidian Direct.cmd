@echo off
cd /d "%~dp0"
start "" "Obsidian\Obsidian.exe" --user-data-dir="Data\Obsidian" %*
