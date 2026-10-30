@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required on this computer. Install Node.js LTS from https://nodejs.org/
 pause
 exit /b 1
)
if not exist node_modules (
 echo Installing app dependencies for first run...
 call npm install
 if errorlevel 1 (pause & exit /b 1)
)
echo.
echo Starting Escova on your home network...
echo Find your PC's IPv4 address with ipconfig and open http://YOUR-IP:5173 on your phone.
echo Keep this window open while playing.
call npm run dev
pause
