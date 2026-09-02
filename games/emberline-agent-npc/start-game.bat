@echo off
rem Dev launcher for Windows: installs deps on first run, opens the browser,
rem starts the Vite dev server. Port must match vite.config.js server.port.
cd /d "%~dp0"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
start http://localhost:5183
npm run dev
