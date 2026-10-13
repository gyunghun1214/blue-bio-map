@echo off
rem Blue-bio Value Map offline demo: serves dist\ on this computer only (127.0.0.1) and opens the browser.
rem Close this window to stop. Guide: docs\offline-demo.md
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\offline\serve.ps1" %*
if errorlevel 1 pause
