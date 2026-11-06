@echo off
title Discord Kaitun ^& Monitor Bot
echo ==============================================
echo    Starting Discord Kaitun ^& Monitor Bot...
echo ==============================================

for /f %%i in ('docker ps --filter "name=ouroboros-discord-bot" --filter "status=running" -q 2^>nul') do (
    echo [WARNING] Container 'ouroboros-discord-bot' is ALREADY running in Docker!
    echo Running another instance here will cause bot token conflicts and 'Application Did Not Respond' errors.
    echo.
)

cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    call .venv\Scripts\python.exe bot.py
) else (
    python bot.py
)
pause
