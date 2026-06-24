@echo off
setlocal enabledelayedexpansion

title UniPath Setup

echo.
echo    _    _       _ _   _       ____  _     _
echo   ^| ^|  ^| ^|     ^| ^| ^| ^(_)     ^|  _ \^| ^|__ ^(_)_ __
echo   ^| ^|  ^| ^|_ __ ^| ^| ^|_ _  __ _^| ^|_)^| '_ \^| ^| '_ \
echo   ^| ^|  ^| ^| '_ \^| ^| __^| ^|/ _` ^|  __/^| ^| ^| ^| ^| ^|_^) ^|
echo   ^| ^|__^| ^| ^| ^| ^| ^| ^|_^| ^| ^(_^| ^| ^|   ^| ^| ^| ^| ^| .__/
echo    \____/^|_^| ^|_^|_^|\__^|_|\__,_^|_^|   ^|_^| ^|_^|_^|_^|
echo.
echo UniPath -- Setup Script
echo.

set MISSING=

rem ---- Check Node.js ----
echo [1/5] Checking Node.js ...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
    for /f "tokens=1 delims=." %%a in ("%NODE_VER%") do set NODE_MAJOR=%%a
    if !NODE_MAJOR! geq 18 (
        echo   Node.js !NODE_VER! found
    ) else (
        echo   Node.js !NODE_VER! found, but ^>= 18 required
        set MISSING=!MISSING! nodejs
    )
) else (
    echo   Node.js not found
    set MISSING=!MISSING! nodejs
)

rem ---- Check npm ----
echo [2/5] Checking npm ...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   npm found
) else (
    echo   npm not found (will be installed with Node.js)
)

rem ---- Check Python ----
echo [3/5] Checking Python ...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=2" %%a in ('python --version 2^>^&1') do set PY_VER=%%a
    for /f "tokens=1 delims=." %%a in ("%PY_VER%") do set PY_MAJOR=%%a
    for /f "tokens=2 delims=." %%a in ("%PY_VER%") do set PY_MINOR=%%a
    if !PY_MAJOR! geq 3 (
        if !PY_MINOR! geq 10 (
            echo   Python !PY_VER! found
        ) else (
            echo   Python !PY_VER! found, but ^>= 3.10 required
            set MISSING=!MISSING! python
        )
    )
) else (
    echo   Python not found
    set MISSING=!MISSING! python
)

rem ---- Check venv ----
echo [4/5] Checking Python venv ...
python -c "import venv" >nul 2>&1
if %errorlevel% equ 0 (
    echo   venv module available
) else (
    echo   venv module not available
    set MISSING=!MISSING! venv
)

rem ---- Install missing ----
if not "%MISSING%"=="" (
    echo.
    echo  The following are missing: %MISSING%
    set /p CONFIRM="  Install them now? [Y/n] "
    if /i "!CONFIRM!"=="n" goto :abort
    if /i "!CONFIRM!"=="N" goto :abort

    for %%d in (%MISSING%) do (
        if "%%d"=="nodejs" (
            echo   Opening Node.js download page ...
            start https://nodejs.org
            echo   Please download and install Node.js LTS, then re-run setup.bat
            pause
            exit /b
        )
        if "%%d"=="python" (
            echo   Opening Python download page ...
            start https://www.python.org/downloads/
            echo   Please download and install Python 3.10+, then re-run setup.bat
            pause
            exit /b
        )
        if "%%d"=="venv" (
            echo   venv is included with Python 3.10+ on Windows -- reinstall Python if missing
        )
    )
) else (
    echo.
    echo All dependencies satisfied!
)

rem ---- Setup steps ----
echo.
echo [5/5] Installing frontend dependencies ...
call npm install
if %errorlevel% neq 0 (
    echo npm install failed
    pause
    exit /b 1
)

echo.
echo Setting up Python backend ...
cd backend
if not exist ".venv" (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -r requirements.txt
cd ..

echo.
echo Building the app ...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed
    pause
    exit /b 1
)

echo.
echo ================================
echo  UniPath setup complete!
echo  Run it with:  npm start
echo ================================

set /p LAUNCH="Launch UniPath now? [Y/n] "
if /i not "!LAUNCH!"=="n" (
    if /i not "!LAUNCH!"=="N" (
        call npm start
    )
)
goto :eof

:abort
echo Aborted.
pause
