@echo off
setlocal enabledelayedexpansion

title UniPath

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "BACKEND_DIR=%APP_DIR%\backend-bin"
set "DATA_DIR=%APPDATA%\UniPath"

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

rem ── Detect free port ──
set "PORT_FILE=%TEMP%\unipath-port.txt"
if exist "%PORT_FILE%" del "%PORT_FILE%"

set "PS_SCRIPT=^
  $start = 8000;^
  for ($i = 0; $i -lt 50; $i++) {^
    $port = $start + $i;^
    $l = $null;^
    try { $l = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $port); $l.Start(); Write-Output $port; exit 0 }^
    catch { continue }^
    finally { if ($l) { $l.Stop() } }^
  }^
  Write-Error 'no port'; exit 1"

for /f "delims=" %%p in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "%PS_SCRIPT%"') do set "UNIPATH_PORT=%%p"

if not defined UNIPATH_PORT (
  echo [UniPath] WARNING: Could not detect free port, using 8000
  set "UNIPATH_PORT=8000"
)

set "BACKEND_URL=http://localhost:%UNIPATH_PORT%"
set "UNIPATH_DATA_DIR=%DATA_DIR%"

rem ── Start backend ──
set "BACKEND_EXE=%BACKEND_DIR%\unipath-backend.exe"
if exist "!BACKEND_EXE!" (
  echo [UniPath] Starting backend on port !UNIPATH_PORT! ...
  start "UniPath Backend" /B "!BACKEND_EXE!" --port !UNIPATH_PORT!
) else (
  echo [UniPath] Backend binary not found at !BACKEND_EXE!
  echo [UniPath] This is a broken installation. Please reinstall UniPath.
  echo [UniPath] Press any key to exit...
  pause >nul
  exit /b 1
)

rem ── Wait for backend ──
echo [UniPath] Waiting for backend to be ready...
set "WAIT_MAX=30"
set "WAIT_COUNT=0"

:wait_loop
if !WAIT_COUNT! geq !WAIT_MAX! (
  echo [UniPath] WARNING: Backend did not respond in time, launching anyway...
  goto :launch_app
)

rem Use PowerShell to check health
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:!UNIPATH_PORT!/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if !errorlevel! equ 0 (
  echo [UniPath] Backend is ready!
  goto :launch_app
)

set /a WAIT_COUNT+=1
ping -n 2 127.0.0.1 >nul 2>&1
goto :wait_loop

:launch_app
rem ── Launch Electron app ──
set "ELECTRON_EXE=%APP_DIR%\UniPath.exe"
if exist "!ELECTRON_EXE!" (
  start "" "!ELECTRON_EXE!"
) else (
  echo [UniPath] App not found at !ELECTRON_EXE!
  echo [UniPath] Launching via npm fallback...
  start "UniPath" cmd /c "cd /d \"%APP_DIR%\" && npm start"
)

rem ── Cleanup on exit ──
echo [UniPath] UniPath is running.
echo [UniPath] Backend port: !UNIPATH_PORT!
echo [UniPath] Data directory: !DATA_DIR!
echo [UniPath] Close this window to stop the backend server.

:wait_loop2
timeout /t 5 /nobreak >nul 2>&1

rem Check if Electron is still running
tasklist /FI "IMAGENAME eq UniPath.exe" /NH 2>nul | find /I "UniPath.exe" >nul
if !errorlevel! neq 0 (
  rem Check if electron.exe is still running
  tasklist /FI "IMAGENAME eq electron.exe" /NH 2>nul | find /I "electron.exe" >nul
  if !errorlevel! neq 0 (
    echo [UniPath] App closed. Shutting down backend...
    taskkill /F /IM "unipath-backend.exe" >nul 2>&1
    exit /b 0
  )
)
goto :wait_loop2
