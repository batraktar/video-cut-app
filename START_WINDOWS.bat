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
exit /b %errorlevel%

:failed
echo Installation failed. Check the messages above.
pause
exit /b 1
