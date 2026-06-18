@echo off
echo Starting FlowMind Server...
echo Please keep this window open. Close it to stop the server.
echo.

start "" "http://localhost:3000"
node server/index.js

pause
