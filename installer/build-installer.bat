@echo off
setlocal enabledelayedexpansion

title UniPath Windows Installer Builder

set "ROOT=%~dp0.."
set "INSTALLER_DIR=%~dp0"

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║      UniPath Windows Installer Builder        ║
echo  ╚═══════════════════════════════════════════════╝
echo.

rem ── Step 1: Build frontend + Electron ──
echo [1/6] Building frontend and Electron app...
call npm run build
if %errorlevel% neq 0 (
  echo ERROR: Frontend build failed.
  exit /b 1
)
echo   OK - Frontend built.

rem ── Step 2: Build backend binary ──
echo [2/6] Building backend binary with PyInstaller...
call python scripts/build_backend.py
if %errorlevel% neq 0 (
  echo ERROR: Backend build failed.
  exit /b 1
)
echo   OK - Backend binary built.

rem ── Step 3: Package with electron-builder ──
echo [3/6] Packaging Electron app with electron-builder...
call npx electron-builder --win --publish=never --config.extraMetadata.version=%npm_package_version%
if %errorlevel% neq 0 (
  echo WARNING: electron-builder packaging failed, will use raw files as fallback.
  echo   The installer will bundle the raw dist/ and dist-electron/ directories.
)

rem ── Step 4: Check for VC++ Redistributable ──
echo [4/6] Checking for VC++ Redistributable installer...
set "VCREDIST_URL=https://aka.ms/vs/17/release/vc_redist.x64.exe"
set "VCREDIST_PATH=%INSTALLER_DIR%redist\vc_redist.x64.exe"

if not exist "%INSTALLER_DIR%redist\" mkdir "%INSTALLER_DIR%redist"

if not exist "%VCREDIST_PATH%" (
  echo   Downloading VC++ Redistributable...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%VCREDIST_URL%' -OutFile '%VCREDIST_PATH%' -UseBasicParsing"
  if !errorlevel! neq 0 (
    echo   WARNING: Could not download VC++ Redistributable.
    echo   The installer will skip VC++ install if already present on target system.
  ) else (
    echo   OK - VC++ Redistributable downloaded.
  )
) else (
  echo   OK - VC++ Redistributable already present.
)

rem ── Step 5: Find Inno Setup ──
echo [5/6] Looking for Inno Setup compiler...

set "ISCC="
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 5\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
if exist "C:\Program Files\Inno Setup 5\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 5\ISCC.exe"

for /f "delims=" %%a in ('where ISCC.exe 2^>nul') do if not defined ISCC set "ISCC=%%a"

if not defined ISCC (
  echo   Inno Setup not found. Install from https://jrsoftware.org/isdl.php
  echo   Download Inno Setup 6+ and re-run this script.
  echo.
  echo   Alternatively, use the electron-builder output directly:
  echo     dist-setup\UniPath Setup *.exe
  exit /b 1
)

echo   Found Inno Setup at: !ISCC!

rem ── Step 6: Compile Inno Setup installer ──
echo [6/6] Compiling Windows installer...
if not exist "%ROOT%\dist-installer" mkdir "%ROOT%\dist-installer"

set "ISCC_OPTS=/Qp"
if "%1"=="/verbose" set "ISCC_OPTS="

"!ISCC!" !ISCC_OPTS! "%INSTALLER_DIR%UniPath.iss"
if %errorlevel% neq 0 (
  echo ERROR: Inno Setup compilation failed.
  exit /b 1
)

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║  UniPath Windows Installer Built!             ║
echo  ╚═══════════════════════════════════════════════╝
echo.
echo  Output: %ROOT%\dist-installer\
echo.
echo  Look for: UniPath-Setup-*.exe

dir "%ROOT%\dist-installer\UniPath-Setup-*.exe" 2>nul

echo.
echo  Done.
