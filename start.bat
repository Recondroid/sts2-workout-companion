@echo off
REM Slay the Spire 2 Workout Companion -- Windows launcher.
REM Double-click this file to start the app. Needs Python 3 installed.
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
    py serve.py
    goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
    python serve.py
    goto :done
)

echo Python was not found. Install Python 3 from https://www.python.org/downloads/
echo and make sure to check "Add Python to PATH" during install.

:done
echo.
pause
