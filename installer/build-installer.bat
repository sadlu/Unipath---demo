@echo off
setlocal enabledelayedexpansion

title UniPath Installer Compiler

set "INSTALLER_DIR=%~dp0"
set "ROOT=%INSTALLER_DIR%.."

echo Looking for Inno Setup compiler...

set ISCC=
for %%p in (
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
  "C:\Program Files\Inno Setup 6\ISCC.exe"
  "C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
  "C:\Program Files\Inno Setup 5\ISCC.exe"
  "%PROGRAMFILES%\Inno Setup 6\ISCC.exe"
  "%PROGRAMFILES(X86)%\Inno Setup 6\ISCC.exe"
  "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
  "%PROGRAMDATA%\chocolatey\lib\innosetup\tools\ISCC.exe"
  "%ChocolateyInstall%\lib\innosetup\tools\ISCC.exe"
  "C:\ProgramData\chocolatey\bin\ISCC.exe"
  "%PROGRAMDATA%\chocolatey\bin\ISCC.exe"
) do if exist %%p set "ISCC=%%~p"

if not defined ISCC for /f "delims=" %%a in ('where ISCC.exe 2^>nul') do set "ISCC=%%a"

if not defined ISCC for /r "%PROGRAMDATA%\chocolatey" %%a in (ISCC.exe) do if exist "%%a" set "ISCC=%%a"
if not defined ISCC for /r "%PROGRAMFILES%" %%a in (ISCC.exe) do if exist "%%a" set "ISCC=%%a"
if not defined ISCC for /r "%PROGRAMFILES(X86)%" %%a in (ISCC.exe) do if exist "%%a" set "ISCC=%%a"

if not defined ISCC (
  echo ERROR: Inno Setup not found.
  echo Tried: Chocolatey, Program Files, Program Files (x86), Local AppData
  exit /b 1
)

echo Found: %ISCC%

if not exist "%ROOT%\dist-installer" mkdir "%ROOT%\dist-installer"

"%ISCC%" /Qp "%INSTALLER_DIR%UniPath.iss"
if %errorlevel% neq 0 (
  echo ERROR: Compilation failed.
  exit /b 1
)

echo.
echo Done! Installer at:
dir "%ROOT%\dist-installer\UniPath-Setup-*.exe" /b
