@echo off
cd /d "%~dp0"
echo Structure Viewer - http://127.0.0.1:4377
echo Keep this window open while using the viewer. Ctrl+C stops it.
node server.mjs
pause
