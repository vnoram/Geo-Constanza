@echo off
REM Apaga Geo Constanza local. Conserva la base de datos local.
cd /d "%~dp0.."
docker compose down
echo.
echo Apagado. Los datos de prueba se conservan.
pause
