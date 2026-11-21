@echo off
setlocal
cd /d "%~dp0"
title KAMANJAMIX VIDEO STUDIO - Build Windows installer
echo ================================================
echo   KAMANJAMIX VIDEO STUDIO - Windows EXE builder
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 goto :nonode
where npm >nul 2>nul
if errorlevel 1 goto :nonode

echo Node.js version:
node -v
echo.
echo [1/4] Installing build tools - needs internet, first time only...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/4] Building the installer...
call npm run dist
if errorlevel 1 goto :fail

echo.
echo [3/4] Self-test of the built app...
if not exist "dist\win-unpacked\KAMANJAMIX VIDEO STUDIO.exe" goto :fail
start /wait "" "dist\win-unpacked\KAMANJAMIX VIDEO STUDIO.exe" --smoke-test="%~dp0dist\smoke-test-result.json"
if errorlevel 1 goto :selftestfail
echo Self-test PASSED.

echo.
echo [4/4] Done. Your installer is in the dist folder:
dir /b dist\*.exe
start "" "%~dp0dist"
echo.
pause
exit /b 0

:selftestfail
echo.
echo [!] The installer was built, but the self-test FAILED.
echo     Details: dist\smoke-test-result.json
if exist "dist\smoke-test-result.json" type "dist\smoke-test-result.json"
echo.
pause
exit /b 2

:nonode
echo [!] Node.js was not found on this PC.
echo     It is needed ONLY to build the installer. The finished app does not need it.
echo.
echo     Option 1: install Node.js LTS from https://nodejs.org then run BUILD.bat again.
echo     Option 2: no Node.js at all - build online with GitHub Actions. See README.md.
echo.
pause
exit /b 1

:fail
echo.
echo [!] Build failed. Read the messages above. See README.md, section Troubleshooting.
echo.
pause
exit /b 1
