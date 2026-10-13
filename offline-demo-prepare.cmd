@echo off
rem Run once with internet before the event: saves the satellite and depth map tiles into dist\offline-tiles\.
rem Guide: docs\offline-demo.md
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\offline\prepare-offline.ps1" %*
pause
