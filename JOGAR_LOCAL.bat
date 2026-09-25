@echo off
cd /d "%~dp0"
title A Lenda de Camutanga - Mundo Vivo V3
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_local.ps1"
