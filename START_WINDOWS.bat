@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Error: install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" call npm install
if errorlevel 1 goto :failed
if not exist "server\node_modules" call npm --prefix server install
if errorlevel 1 goto :failed

call npm run start:user
set "LAUNCH_EXIT_CODE=%ERRORLEVEL%"
if not "%LAUNCH_EXIT_CODE%"=="0" echo Startup failed with exit code %LAUNCH_EXIT_CODE%.
echo.
echo Press any key to close this window.
pause >nul
exit /b %LAUNCH_EXIT_CODE%

:failed
echo Installation failed. Check the messages above.
pause
exit /b 1
